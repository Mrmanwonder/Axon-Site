-- ============================================================================
-- 0002 · Paper / attempt / loss_event / canonical_question — OWNERSHIP ONLY
-- ============================================================================
-- ⚠ INCOMPLETE BY DESIGN. These four tables come from the data model in
-- CLAUDE.md, which is not present in this repository (CLAUDE.md is an 11-byte
-- pointer to AGENTS.md and contains no data model). Rather than invent the
-- domain semantics of children's exam data, this migration creates ONLY the
-- columns that ownership and RLS depend on.
--
-- That split is deliberate: getting ownership and RLS right is the part that is
-- dangerous to get wrong and hard to retrofit. Adding domain columns afterwards
-- is an additive migration with no security consequences. So the security layer
-- is complete and provable today, and the columns land when the model does.
--
-- student_id is carried on all three content tables rather than reached through
-- a join chain. Two reasons: every policy becomes a single-hop comparison
-- (cheap, and obviously correct on inspection), and the composite foreign keys
-- below make it impossible for a child row to reference a parent belonging to a
-- different student — so the denormalisation cannot drift.
-- ============================================================================

-- ── paper ──────────────────────────────────────────────────────────────────

create table public.paper (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.student (id) on delete cascade,
  created_at  timestamptz not null default now(),

  unique (id, student_id)
  -- PENDING CLAUDE.md: subject, paper type (the Tier 1 vs Tier 2 decision from
  -- ONBOARDING step 8), date taken, page count, storage path, extraction
  -- status, scheme citation + version.
);

comment on table public.paper is
  'An uploaded exam paper belonging to one student. OWNERSHIP COLUMNS ONLY — domain columns pending the data model in CLAUDE.md.';

-- ── attempt ────────────────────────────────────────────────────────────────

create table public.attempt (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.student (id) on delete cascade,
  paper_id    uuid not null,
  created_at  timestamptz not null default now(),

  unique (id, student_id),
  -- Composite FK: an attempt cannot point at a paper owned by another student.
  foreign key (paper_id, student_id)
    references public.paper (id, student_id) on delete cascade
  -- PENDING CLAUDE.md: question ref, extracted answer, confidence, marks
  -- awarded, teacher remark, correction state.
);

comment on table public.attempt is
  'One answered question on a paper. OWNERSHIP COLUMNS ONLY — domain columns pending CLAUDE.md.';

-- ── loss_event ─────────────────────────────────────────────────────────────

create table public.loss_event (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.student (id) on delete cascade,
  attempt_id  uuid not null,
  created_at  timestamptz not null default now(),

  unique (id, student_id),
  foreign key (attempt_id, student_id)
    references public.attempt (id, student_id) on delete cascade
  -- PENDING CLAUDE.md: cause category, marks lost, explanation, confidence
  -- tier, scheme citation + version.
);

comment on table public.loss_event is
  'A specific place marks were lost on an attempt. OWNERSHIP COLUMNS ONLY — domain columns pending CLAUDE.md.';

-- ── canonical_question ─────────────────────────────────────────────────────
-- Shared reference data, not student data: no student_id, no owner. Readable by
-- every authenticated user, writable only by the service role (which bypasses
-- RLS, so the absence of a write policy is the whole mechanism).

create table public.canonical_question (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now()
  -- PENDING CLAUDE.md: board, class, subject, topic, question text, marks
  -- available, scheme reference + version.
);

comment on table public.canonical_question is
  'Board question bank — shared reference data, read-only to authenticated users, written only by the service role. OWNERSHIP COLUMNS ONLY — domain columns pending CLAUDE.md.';

-- ── consent gate on content writes ─────────────────────────────────────────
-- The student gate in 0001 covers profile creation. Papers need their own gate,
-- because consent can be withdrawn later and withdrawal must stop new
-- processing — not merely hide it.

create or replace function public.enforce_paper_consent_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_guardian uuid;
begin
  select s.guardian_id into v_guardian
  from public.student s where s.id = new.student_id;

  if v_guardian is null then
    raise exception 'unknown student %', new.student_id using errcode = '23503';
  end if;

  if not public.consent_is_granted(v_guardian, new.student_id, 'store_papers') then
    raise exception
      'cannot store a paper: consent for store_papers is not currently granted for student %',
      new.student_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger paper_consent_gate
  before insert on public.paper
  for each row execute function public.enforce_paper_consent_gate();

-- ── indexes ────────────────────────────────────────────────────────────────

create index paper_student_id_idx      on public.paper      (student_id);
create index attempt_student_id_idx    on public.attempt    (student_id);
create index attempt_paper_id_idx      on public.attempt    (paper_id);
create index loss_event_student_id_idx on public.loss_event (student_id);
create index loss_event_attempt_id_idx on public.loss_event (attempt_id);
