-- ============================================================================
-- 0001 · Guardian, student, and the consent ledger
-- ============================================================================
-- Account model (fixed by DPDP Act 2023 / DPDP Rules 2025, not by preference):
-- the guardian is the only auth principal. The student is a *profile* under the
-- guardian's session and deliberately has no row in auth.users in v1.
--
-- The ordering constraint that shapes this file: no student personal data may
-- be written before a consent_event exists granting every required purpose.
-- That is enforced in the database by a trigger, not only in application code,
-- because an application bug must not be able to produce an unlawful write.
-- ============================================================================

-- ── consent purposes ───────────────────────────────────────────────────────
-- A lookup table rather than an enum: the required/optional split is data the
-- consent gate reads at runtime, and adding a purpose must not need a type
-- rewrite. Purposes and their required/optional status come from the Privacy
-- Policy's "Why we process it" section.

create table public.consent_purpose (
  purpose      text primary key,
  label        text        not null,
  is_required  boolean     not null,
  created_at   timestamptz not null default now()
);

comment on table public.consent_purpose is
  'Catalogue of processing purposes. is_required = product cannot function without it; optional purposes default off and are never pre-ticked.';

insert into public.consent_purpose (purpose, label, is_required) values
  ('store_papers',            'Storing and reading uploaded papers',              true),
  ('extract_text',            'Extracting text from uploaded papers',             true),
  ('generate_explanations',   'Generating explanations of where marks were lost', true),
  ('track_progress',          'Tracking progress over time',                      true),
  ('weekly_parent_digest',    'Weekly summary to the parent',                     false),
  ('improve_extraction',      'Improving extraction accuracy from corrections',   false);

-- ── guardian ───────────────────────────────────────────────────────────────
-- The only table linked to auth.users. Verification stores a *reference* and a
-- method, never an identity document: there is deliberately no column that
-- could hold a scan, an image, or a document number.

create table public.guardian (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid        not null unique references auth.users (id) on delete cascade,
  name                 text        not null check (length(btrim(name)) > 0),
  contact              text        not null check (length(btrim(contact)) > 0),
  verified_at          timestamptz,
  verification_method  text        check (verification_method in ('digilocker', 'stub')),
  verification_ref     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- A verification is only meaningful with both its method and its reference.
  -- Either all three are present or none are; no half-recorded verification.
  constraint guardian_verification_complete check (
    (verified_at is null and verification_method is null and verification_ref is null)
    or
    (verified_at is not null and verification_method is not null and verification_ref is not null)
  )
);

comment on table public.guardian is
  'Parent or lawful guardian: the account holder, payer, and sole auth principal.';
comment on column public.guardian.verification_ref is
  'Opaque reference proving verification occurred (Rule 10). Never an identity document, image, or document number.';
comment on column public.guardian.contact is
  'Email address or phone number used for OTP. Single field because Supabase Auth treats them as alternative identifiers.';

-- ── student ────────────────────────────────────────────────────────────────
-- Fields are exactly those ONBOARDING.md step 6 permits: first name for
-- display, board, class, age band. No school, no address, no date of birth
-- beyond the band, no photograph.

create table public.student (
  id           uuid primary key default gen_random_uuid(),
  guardian_id  uuid        not null references public.guardian (id) on delete cascade,
  first_name   text        not null check (length(btrim(first_name)) > 0),
  board        text        not null default 'CBSE' check (board in ('CBSE')),
  class_level  smallint    not null check (class_level between 9 and 12),
  age_band     text        not null check (age_band in ('under_18', '18_plus')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Needed so child tables can carry a composite FK on (id, student_id) and
  -- therefore cannot be attached to a different guardian's student.
  unique (id, guardian_id)
);

comment on table public.student is
  'Student profile under a guardian. Not an auth user in v1 — the student works inside the guardian''s session.';
comment on column public.student.age_band is
  'Coarse band only. under_18 requires the verifiable-consent path; 18_plus can hold their own account (transfer path, not yet built).';

-- ── consent_event ──────────────────────────────────────────────────────────
-- APPEND-ONLY. This table is the compliance evidence. Withdrawal is a new row
-- with granted = false, never an update. Enforcement is threefold: no
-- UPDATE/DELETE grants, no UPDATE/DELETE RLS policy, and a trigger that also
-- stops the service role and the table owner.
--
-- student_id is nullable by necessity: ONBOARDING.md collects consent at step 4
-- but does not create the student profile until step 6, so the consent that
-- authorises the student's creation cannot yet reference it. A NULL means
-- guardian-scope consent, granted before any profile existed.

create table public.consent_event (
  id              uuid        primary key default gen_random_uuid(),
  -- Monotonic ordering key. NOT created_at: now() returns the *transaction*
  -- timestamp, so a grant and a withdrawal written in one transaction share it
  -- exactly and "latest" would fall through to a random uuid tie-break. Wall
  -- clocks can also collide or step backwards. A sequence cannot.
  seq             bigserial   not null unique,
  guardian_id     uuid        not null references public.guardian (id) on delete restrict,
  student_id      uuid        references public.student (id) on delete restrict,
  purpose         text        not null references public.consent_purpose (purpose),
  granted         boolean     not null,
  notice_version  text        not null check (length(btrim(notice_version)) > 0),
  method          text        not null check (method in ('in_app_itemised', 'in_app_withdrawal')),
  created_at      timestamptz not null default clock_timestamp()
);

comment on table public.consent_event is
  'APPEND-ONLY ledger of consent decisions. Never UPDATE or DELETE a row: withdrawal is a new row with granted = false. This log is the evidence of compliance.';
comment on column public.consent_event.student_id is
  'NULL = guardian-scope consent recorded before the student profile existed (onboarding step 4 precedes step 6).';
comment on column public.consent_event.notice_version is
  'Version of the consent notice text shown at the moment of the decision. Required so a historical decision can be tied to what was actually agreed to.';

-- on delete restrict above is deliberate: the evidence log must not be
-- silently emptied by deleting a guardian. Erasure is an explicit, audited
-- operation, not a cascade side effect.

-- ── append-only enforcement ────────────────────────────────────────────────

create or replace function public.consent_event_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'consent_event is append-only: % is not permitted. Record a withdrawal as a new row with granted = false.',
    tg_op
    using errcode = '42501';
end;
$$;

create trigger consent_event_no_update
  before update on public.consent_event
  for each row execute function public.consent_event_is_append_only();

create trigger consent_event_no_delete
  before delete on public.consent_event
  for each row execute function public.consent_event_is_append_only();

-- ── consent state helpers ──────────────────────────────────────────────────
-- Current state is the most recent row per (guardian, student, purpose).
-- SECURITY DEFINER so policies and triggers can evaluate consent without
-- tripping over the caller's own RLS; search_path pinned to defeat hijacking.

-- Scope precedence, most specific first. A student-scoped decision wins over a
-- guardian-scope one rather than the two being merged by recency: otherwise a
-- guardian-scope grant intended for a second student would silently reinstate a
-- purpose that had been withdrawn for the first.
create or replace function public.consent_is_granted(
  p_guardian uuid,
  p_student  uuid,
  p_purpose  text
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    -- 1. the latest decision recorded specifically for this student
    (select ce.granted
       from public.consent_event ce
      where ce.guardian_id = p_guardian
        and ce.purpose     = p_purpose
        and ce.student_id  = p_student
      order by ce.seq desc
      limit 1),
    -- 2. otherwise the latest guardian-scope decision (student_id is null),
    --    which is what onboarding step 4 records before any profile exists
    (select ce.granted
       from public.consent_event ce
      where ce.guardian_id = p_guardian
        and ce.purpose     = p_purpose
        and ce.student_id is null
      order by ce.seq desc
      limit 1),
    -- 3. no decision on record is not consent
    false);
$$;

comment on function public.consent_is_granted is
  'True when the latest consent decision for this purpose is a grant. Always read authoritatively — never cache this client-side.';

create or replace function public.all_required_consents_granted(
  p_guardian uuid,
  p_student  uuid default null
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from public.consent_purpose cp
    where cp.is_required
      and not public.consent_is_granted(p_guardian, p_student, cp.purpose)
  );
$$;

-- ── the consent gate ───────────────────────────────────────────────────────
-- Blocks the first write of student personal data until the ledger authorises
-- it. In the database rather than only in the app, so no application path can
-- bypass it.

create or replace function public.enforce_student_consent_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.all_required_consents_granted(new.guardian_id, new.id) then
    raise exception
      'cannot write student data: guardian % has not granted all required consent purposes',
      new.guardian_id
      using errcode = '42501',
            hint = 'Insert consent_event rows for every purpose where is_required is true before creating a student profile.';
  end if;
  return new;
end;
$$;

create trigger student_consent_gate
  before insert on public.student
  for each row execute function public.enforce_student_consent_gate();

-- ── indexes ────────────────────────────────────────────────────────────────
-- Postgres does not index foreign keys automatically, and every RLS policy
-- added in 0002 filters on one of these columns on each row access.

create index guardian_auth_user_id_idx     on public.guardian      (auth_user_id);
create index student_guardian_id_idx       on public.student       (guardian_id);
create index consent_event_guardian_idx    on public.consent_event (guardian_id);
create index consent_event_student_idx     on public.consent_event (student_id);
-- Serves both scope branches of consent_is_granted.
create index consent_event_lookup_idx
  on public.consent_event (guardian_id, purpose, student_id, seq desc);
