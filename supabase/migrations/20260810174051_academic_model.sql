-- ============================================================================
-- 0002 · Academic model
-- ============================================================================
-- The atomic unit is an attempt at a question, not a paper.
--
-- Each of CLAUDE.md's four hard rules is enforced structurally here, because a
-- rule that lives only in a prompt or a code review is a rule that eventually
-- gets violated:
--
--   1. Marks are never assigned by the model — student_attempt.marks_source is
--      NOT NULL and can only name a human origin, so a mark with no human
--      provenance cannot be stored at all. The model's only writable field is
--      mark_loss_event.ai_explanation.
--   2. Never fabricate a scheme — a Tier 1 attempt cannot reference a
--      canonical_question (composite FK plus CHECK), and scheme text cannot be
--      stored without its source and version.
--   3. Unsure data never reaches analytics — the analytics views in 0003 read
--      only confirmed rows; unsure rows are excluded until a student confirms.
--   4. Fail visibly — page_unreadable records the failure as a first-class row
--      rather than dropping content silently.
-- ============================================================================

create type public.paper_type    as enum ('unit_test', 'mid_term', 'final_exam', 'pyq', 'sample_paper');
create type public.paper_tier    as enum ('tier_1', 'tier_2');
create type public.loss_cause    as enum ('conceptual_gap', 'procedural_slip', 'misread_question',
                                          'incomplete', 'presentation', 'keyword_miss', 'timed_out');
create type public.confidence    as enum ('confirmed', 'likely', 'unsure');
create type public.marks_source  as enum ('teacher_pen', 'official_scheme');

comment on type public.loss_cause is
  'Fixed enum. CLAUDE.md: no new cause value until data says otherwise.';
comment on type public.confidence is
  'Three values only. Never a percentage — there is no calibration to justify one.';
comment on type public.marks_source is
  'Where a mark came from. Both values are human origins; the model is not one, which is what makes hard rule 1 unfalsifiable at the schema level.';

-- ── curriculum ─────────────────────────────────────────────────────────────
-- INFERRED: CLAUDE.md's concept entity carries chapter_id but no chapter entity
-- is listed. Chapter is modelled minimally here; confirm the shape.

create table public.chapter (
  id          uuid primary key default gen_random_uuid(),
  board       public.board not null default 'CBSE',
  class_level smallint     not null check (class_level between 9 and 12),
  subject     text         not null,
  name        text         not null,
  sort_order  smallint     not null default 0,
  unique (board, class_level, subject, name)
);

create table public.concept (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapter (id) on delete cascade,
  name       text not null,
  unique (chapter_id, name)
);

-- ── canonical_question ─────────────────────────────────────────────────────
-- Shared reference data for Tier 2: extracted and verified once, reused across
-- all students. Not student data — no student_id, and readable by everyone.

create table public.canonical_question (
  id              uuid primary key default gen_random_uuid(),
  board           public.board not null default 'CBSE',
  exam_year       smallint     not null check (exam_year between 2000 and 2100),
  subject         text         not null,
  question_text   text         not null check (length(btrim(question_text)) > 0),
  max_marks       smallint     not null check (max_marks > 0),
  marking_scheme  text,
  scheme_source   text,
  scheme_version  text,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),

  -- Hard rule 2: scheme detail cannot exist without an attributable source and
  -- version, so there is nowhere to put a reconstructed or approximated scheme.
  constraint scheme_is_attributable check (
    (marking_scheme is null  and scheme_source is null and scheme_version is null)
    or
    (marking_scheme is not null and scheme_source is not null and scheme_version is not null)
  )
);

comment on column public.canonical_question.marking_scheme is
  'Paraphrased mark allocation in our own words, never reproduced scheme text. NULL means no official scheme is held — in which case the paper is Tier 1 and no scheme detail may be shown.';

create table public.canonical_question_concept (
  canonical_question_id uuid not null references public.canonical_question (id) on delete cascade,
  concept_id            uuid not null references public.concept (id) on delete cascade,
  primary key (canonical_question_id, concept_id)
);

-- ── paper ──────────────────────────────────────────────────────────────────

create table public.paper (
  id          uuid              primary key default gen_random_uuid(),
  student_id  uuid              not null references public.student (id) on delete cascade,
  type        public.paper_type not null,
  tier        public.paper_tier not null,
  date_taken  date              not null,
  created_at  timestamptz       not null default now(),

  unique (id, student_id),
  -- Carried so student_attempt can enforce the tier rule via a composite FK.
  unique (id, tier),

  -- School tests have no official scheme, so they can never be Tier 2.
  -- Board papers may still be Tier 1 if the scheme is not in the library yet.
  constraint school_tests_are_tier_1 check (
    tier = 'tier_1' or type in ('pyq', 'sample_paper')
  )
);

comment on column public.paper.tier is
  'tier_1 = no official scheme; explanation is grounded in the teacher''s marks and remarks only. tier_2 = matched to a canonical_question carrying the scheme.';

-- Hard rule 4: an unreadable page is recorded, not dropped. The crop reference
-- is kept so the UI can show the student exactly what failed.
create table public.page_unreadable (
  id           uuid        primary key default gen_random_uuid(),
  paper_id     uuid        not null,
  student_id   uuid        not null,
  page_number  smallint    not null check (page_number > 0),
  storage_path text        not null,
  reason       text        not null,
  created_at   timestamptz not null default now(),

  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade,
  unique (paper_id, page_number)
);

comment on table public.page_unreadable is
  'Hard rule 4, fail visibly: a page OCR could not read is a first-class row, so the UI can show the crop and say so rather than silently omitting content.';

-- ── student_attempt ────────────────────────────────────────────────────────
-- The atomic unit.

create table public.student_attempt (
  id                    uuid                primary key default gen_random_uuid(),
  student_id            uuid                not null,
  paper_id              uuid                not null,
  paper_tier            public.paper_tier   not null,
  canonical_question_id uuid                references public.canonical_question (id) on delete restrict,

  question_label        text                not null,
  question_text         text,
  student_answer        text,

  -- Fact fields. Sourced from the teacher's pen or an official scheme, never
  -- from the model.
  marks_awarded         numeric(5,2)        not null check (marks_awarded >= 0),
  max_marks             numeric(5,2)        not null check (max_marks > 0),
  marks_source          public.marks_source not null,
  teacher_remark        text,

  -- Transcription confidence, and the student's confirmation of it.
  extraction_confidence public.confidence   not null,
  student_confirmed_at  timestamptz,

  created_at            timestamptz         not null default now(),
  updated_at            timestamptz         not null default now(),

  unique (id, student_id),
  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade,
  -- Ties the attempt's tier to its paper's actual tier; it cannot drift.
  foreign key (paper_id, paper_tier) references public.paper (id, tier) on delete cascade,

  constraint marks_within_max check (marks_awarded <= max_marks),

  -- Hard rule 2: a Tier 1 attempt has no scheme to point at.
  constraint tier_1_has_no_canonical_question check (
    paper_tier = 'tier_2' or canonical_question_id is null
  )
);

comment on table public.student_attempt is
  'One attempt at one question — the atomic unit of the product.';
comment on column public.student_attempt.marks_awarded is
  'FACT FIELD. Hard rule 1: sourced only from the teacher''s pen or an official scheme. The model must never write here, and must never contradict this number in any phrasing.';
comment on column public.student_attempt.student_confirmed_at is
  'Set when the student confirms or corrects the transcription. Until then, an unsure extraction is excluded from analytics.';

-- ── mark_loss_event ────────────────────────────────────────────────────────

create table public.mark_loss_event (
  id                   uuid              primary key default gen_random_uuid(),
  attempt_id           uuid              not null,
  student_id           uuid              not null,
  cause                public.loss_cause not null,
  marks_lost           numeric(5,2)      not null check (marks_lost > 0),

  -- The only field the model is permitted to write.
  ai_explanation       text,
  do_this_next         text,

  confidence           public.confidence not null,
  student_confirmed_at timestamptz,
  -- Set when the student says "not why I lost it". Accepted immediately; this is
  -- self-knowledge and exactly the signal we want.
  student_rejected_at  timestamptz,

  created_at           timestamptz       not null default now(),

  unique (id, student_id),
  foreign key (attempt_id, student_id) references public.student_attempt (id, student_id) on delete cascade,

  constraint not_both_confirmed_and_rejected check (
    student_confirmed_at is null or student_rejected_at is null
  )
);

comment on column public.mark_loss_event.ai_explanation is
  'The model''s only writable field in the entire schema.';
comment on column public.mark_loss_event.do_this_next is
  'Must name something specific to this answer and performable during an exam. NULL when the model cannot clear that bar — an empty slot is honest, generic advice is not.';

-- Total marks lost on an attempt cannot exceed what was actually lost. A
-- statement-level trigger, so multi-row inserts are checked once as a set.
create or replace function public.check_marks_lost_total()
returns trigger language plpgsql as $$
declare
  bad record;
begin
  select a.id, a.max_marks - a.marks_awarded as forgone, sum(m.marks_lost) as claimed
    into bad
  from public.student_attempt a
  join public.mark_loss_event m on m.attempt_id = a.id
  where a.id in (select attempt_id from changed)
  group by a.id, a.max_marks, a.marks_awarded
  having sum(m.marks_lost) > a.max_marks - a.marks_awarded
  limit 1;

  if bad.id is not null then
    raise exception
      'mark_loss_event total (%) exceeds marks forgone (%) on attempt %',
      bad.claimed, bad.forgone, bad.id
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create trigger mark_loss_total_insert
  after insert on public.mark_loss_event
  referencing new table as changed
  for each statement execute function public.check_marks_lost_total();

create trigger mark_loss_total_update
  after update on public.mark_loss_event
  referencing new table as changed
  for each statement execute function public.check_marks_lost_total();

-- ── concepts per attempt ───────────────────────────────────────────────────
-- INFERRED: CLAUDE.md lists concept but not how an attempt reaches one. The
-- concept view needs a per-attempt link for Tier 1 (which has no canonical
-- question to inherit from), so it is modelled here. Confirm.

create table public.attempt_concept (
  attempt_id uuid not null,
  student_id uuid not null,
  concept_id uuid not null references public.concept (id) on delete cascade,
  primary key (attempt_id, concept_id),
  foreign key (attempt_id, student_id) references public.student_attempt (id, student_id) on delete cascade
);

-- ── consent gate on content ────────────────────────────────────────────────
-- Withdrawal must stop new processing, not merely hide existing rows.

create or replace function public.enforce_paper_consent_gate()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_guardian uuid;
begin
  select s.guardian_id into v_guardian from public.student s where s.id = new.student_id;
  if v_guardian is null then
    raise exception 'unknown student %', new.student_id using errcode = '23503';
  end if;
  if not public.consent_is_granted(v_guardian, new.student_id, 'store_papers') then
    raise exception 'cannot store a paper: store_papers consent is not currently granted for student %', new.student_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger paper_consent_gate before insert on public.paper
  for each row execute function public.enforce_paper_consent_gate();

-- ── indexes ────────────────────────────────────────────────────────────────

create index paper_student_idx            on public.paper                 (student_id, date_taken desc);
create index attempt_student_idx          on public.student_attempt       (student_id);
create index attempt_paper_idx            on public.student_attempt       (paper_id);
create index attempt_canonical_idx        on public.student_attempt       (canonical_question_id);
create index loss_student_idx             on public.mark_loss_event       (student_id);
create index loss_attempt_idx             on public.mark_loss_event       (attempt_id);
create index loss_cause_idx               on public.mark_loss_event       (student_id, cause);
create index page_unreadable_paper_idx    on public.page_unreadable       (paper_id);
create index attempt_concept_concept_idx  on public.attempt_concept       (concept_id);
create index concept_chapter_idx          on public.concept               (chapter_id);
create index cqc_concept_idx              on public.canonical_question_concept (concept_id);
