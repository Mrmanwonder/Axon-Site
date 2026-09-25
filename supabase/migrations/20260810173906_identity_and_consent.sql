-- ============================================================================
-- 0001 · Identity and consent
-- ============================================================================
-- Account model from CLAUDE.md: the parent is account holder and payer, the
-- student is the daily user. Verifiable guardian consent is required under the
-- DPDP Act 2023 for under-18s regardless of who pays, and since the audience is
-- classes 9-12, effectively every student is a child under that Act.
--
-- Consequence: the guardian is the only auth principal. The student is a profile
-- under the guardian's session, not a row in auth.users.
--
-- Onboarding order is: parent signs up -> verify and consent -> plan and payment
-- -> create student profile. The gate at the end of this file enforces the part
-- that matters legally: no student personal data before consent exists.
-- ============================================================================

create type public.board          as enum ('CBSE');
create type public.age_band       as enum ('under_18', '18_plus');
create type public.consent_method as enum ('in_app_itemised', 'in_app_withdrawal');
create type public.verify_method  as enum ('digilocker', 'stub');

-- ── consent purposes ───────────────────────────────────────────────────────
-- A table, not an enum: the gate reads is_required at runtime, and optional
-- purposes must be off unless a row says otherwise.

create table public.consent_purpose (
  purpose     text primary key,
  label       text        not null,
  is_required boolean     not null,
  sort_order  smallint    not null,
  created_at  timestamptz not null default now()
);

insert into public.consent_purpose (purpose, label, is_required, sort_order) values
  ('store_papers',          'Storing and reading uploaded papers',              true,  1),
  ('extract_text',          'Extracting text from uploaded papers',             true,  2),
  ('generate_explanations', 'Explaining where marks were lost',                 true,  3),
  ('track_progress',        'Tracking progress over time',                      true,  4),
  ('weekly_parent_digest',  'Weekly summary to the parent',                     false, 5),
  ('improve_extraction',    'Improving extraction accuracy from corrections',   false, 6);

comment on table public.consent_purpose is
  'Itemised processing purposes. A single blanket agreement is not compliant, so consent is recorded per purpose. Optional purposes default off.';

-- ── guardian ───────────────────────────────────────────────────────────────

create table public.guardian (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid          not null unique references auth.users (id) on delete cascade,
  name                text          not null check (length(btrim(name)) > 0),
  contact             text          not null check (length(btrim(contact)) > 0),
  verified_at         timestamptz,
  verification_method public.verify_method,
  verification_ref    text,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),

  constraint guardian_verification_complete check (
    (verified_at is null and verification_method is null and verification_ref is null)
    or
    (verified_at is not null and verification_method is not null and verification_ref is not null)
  )
);

comment on table public.guardian is
  'Parent or lawful guardian: account holder, payer, and the only auth principal.';
comment on column public.guardian.verification_ref is
  'Opaque reference proving verification happened. Never an identity document, image, or document number — there is deliberately no column that could hold one.';

-- ── student ────────────────────────────────────────────────────────────────
-- Fields are those CLAUDE.md's data model lists, plus age_band (needed to pick
-- the consent path) and subjects (collected at profile creation). Nothing more:
-- no school, no address, no date of birth beyond the band, no photograph.

create table public.student (
  id           uuid primary key default gen_random_uuid(),
  guardian_id  uuid           not null references public.guardian (id) on delete cascade,
  first_name   text           not null check (length(btrim(first_name)) > 0),
  board        public.board   not null default 'CBSE',
  class_level  smallint       not null check (class_level between 9 and 12),
  age_band     public.age_band not null,
  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now(),

  -- lets child tables carry a composite FK and so never cross students
  unique (id, guardian_id)
);

comment on table public.student is
  'Student profile under a guardian. Not an auth user in v1 — the student works inside the guardian''s session.';

create table public.student_subject (
  student_id uuid not null references public.student (id) on delete cascade,
  subject    text not null,
  primary key (student_id, subject)
);

comment on table public.student_subject is
  'Subjects selected at profile creation. INFERRED: CLAUDE.md''s student entity lists board and class_level only, but the onboarding step collects subjects too.';

-- ── consent_event ──────────────────────────────────────────────────────────
-- APPEND-ONLY. Withdrawal is a new row with granted = false, never an update.
-- This log is the evidence of compliance.
--
-- student_id is nullable of necessity: consent is collected before the student
-- profile is created, so the consent that authorises the creation cannot yet
-- reference it. NULL means guardian-scope.

create table public.consent_event (
  id             uuid                  primary key default gen_random_uuid(),
  -- Ordering key. NOT created_at: now() is the transaction timestamp, so a grant
  -- and a withdrawal written in one transaction share it exactly and "latest"
  -- would be decided by a random uuid. Wall clocks can also step backwards.
  seq            bigserial             not null unique,
  guardian_id    uuid                  not null references public.guardian (id) on delete restrict,
  student_id     uuid                  references public.student (id) on delete restrict,
  purpose        text                  not null references public.consent_purpose (purpose),
  granted        boolean               not null,
  notice_version text                  not null check (length(btrim(notice_version)) > 0),
  method         public.consent_method not null,
  created_at     timestamptz           not null default clock_timestamp()
);

comment on table public.consent_event is
  'APPEND-ONLY consent ledger. Never UPDATE or DELETE: withdrawal is a new row with granted = false.';
comment on column public.consent_event.notice_version is
  'Version of the notice text shown at the moment of the decision, so a historical grant ties to what was actually agreed.';

create or replace function public.consent_event_is_append_only()
returns trigger language plpgsql as $$
begin
  raise exception
    'consent_event is append-only: % is not permitted. Record a withdrawal as a new row with granted = false.', tg_op
    using errcode = '42501';
end;
$$;

create trigger consent_event_no_update before update on public.consent_event
  for each row execute function public.consent_event_is_append_only();
create trigger consent_event_no_delete before delete on public.consent_event
  for each row execute function public.consent_event_is_append_only();

-- ── consent state ──────────────────────────────────────────────────────────
-- Most specific scope wins, rather than merging scopes by recency: otherwise a
-- guardian-scope grant meant for a second student would silently reinstate a
-- purpose withdrawn for the first.

create or replace function public.consent_is_granted(
  p_guardian uuid, p_student uuid, p_purpose text
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select ce.granted from public.consent_event ce
      where ce.guardian_id = p_guardian and ce.purpose = p_purpose and ce.student_id = p_student
      order by ce.seq desc limit 1),
    (select ce.granted from public.consent_event ce
      where ce.guardian_id = p_guardian and ce.purpose = p_purpose and ce.student_id is null
      order by ce.seq desc limit 1),
    false);
$$;

comment on function public.consent_is_granted is
  'Latest decision for a purpose, most specific scope first. Always read authoritatively — consent state is never cached optimistically.';

create or replace function public.all_required_consents_granted(
  p_guardian uuid, p_student uuid default null
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not exists (
    select 1 from public.consent_purpose cp
    where cp.is_required and not public.consent_is_granted(p_guardian, p_student, cp.purpose));
$$;

-- ── the gate ───────────────────────────────────────────────────────────────
-- In the database rather than only in application code, so that no path —
-- including a service-role bug — can produce an unlawful write.

create or replace function public.enforce_student_consent_gate()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.all_required_consents_granted(new.guardian_id, new.id) then
    raise exception 'cannot write student data: guardian % has not granted all required purposes', new.guardian_id
      using errcode = '42501',
            hint = 'Record consent_event rows for every required purpose first.';
  end if;
  return new;
end;
$$;

create trigger student_consent_gate before insert on public.student
  for each row execute function public.enforce_student_consent_gate();

-- ── indexes ────────────────────────────────────────────────────────────────

create index guardian_auth_user_id_idx  on public.guardian      (auth_user_id);
create index student_guardian_id_idx    on public.student       (guardian_id);
create index consent_event_guardian_idx on public.consent_event (guardian_id);
create index consent_event_lookup_idx   on public.consent_event (guardian_id, purpose, student_id, seq desc);
