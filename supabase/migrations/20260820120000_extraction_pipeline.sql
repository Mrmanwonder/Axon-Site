-- ============================================================================
-- 0009 · The extraction pipeline
-- ============================================================================
-- SCANNING_SYSTEM.md stages 3–10, given a schema. It extends the academic model
-- rather than replacing it: `student_attempt` stays the atomic unit and the four
-- hard rules stay enforced where they already are. What this adds is everything
-- that exists *before* an attempt is real — the run, the regions it found, the
-- teacher marks it bound to them, and the arithmetic that says whether any of it
-- can be trusted.
--
-- Three things in the specification become constraints here, because each is a
-- rule the pipeline would otherwise be free to break quietly:
--
--   · A field without provenance does not exist. Every extracted value carries
--     the box on the page it was read from, and a value with no box cannot be
--     stored. This is the primary defence against a vision model producing
--     plausible fiction, and it is what makes the review screen possible at all:
--     every field can be shown against its own crop.
--
--   · Review is mandatory. `commit_extraction_run()` refuses while any region
--     still needs the student's eyes. Not skippable, not defaulted-to-accept —
--     that is earned with measured accuracy, not assumed at launch.
--
--   · Reconciliation is never forced. There is no path, here or anywhere, that
--     adjusts a mark to make a total add up. A clean-looking paper that is
--     quietly fictional is the worst thing this system could produce.
--
-- One deliberate divergence from the specification. §10 says an unsure field is
-- "included in analytics but tagged". CLAUDE.md hard rule 3 says unsure data
-- never reaches analytics until a student confirms it, and that rule is enforced
-- by the analytics views rather than by convention. The hard rule wins: an
-- unsure region commits as `unsure`, which attempt_analytics excludes until
-- student_confirmed_at is set. Tagging it and counting it anyway is exactly the
-- silent compounding rule 3 exists to prevent.
-- ============================================================================

-- ── enums ──────────────────────────────────────────────────────────────────

create type public.region_type as enum ('prose', 'math', 'diagram', 'table', 'mcq', 'mixed');

-- What the device can tell from geometry alone. It knows a component encloses
-- background; it does not know that means a circled deduction.
create type public.mark_shape as enum ('stroke', 'crossing', 'enclosure', 'glyph', 'blob', 'unknown');

-- What the mark means once stage 5 has bound it to a question region.
create type public.mark_class as enum (
  'marginal_number', 'tick', 'half_tick', 'cross', 'strikethrough',
  'circle', 'underline', 'comment', 'unknown');

-- The pipeline's own three tiers, which are not the same thing as the database's
-- `confidence` enum: `unreadable` means recognition failed or provenance is
-- missing, and such a field has no business becoming an attempt at all.
create type public.confidence_tier as enum ('confident', 'unsure', 'unreadable');

create type public.extraction_status as enum (
  'queued', 'structure', 'content', 'attribution', 'reconciliation',
  'needs_review', 'committed', 'failed');

comment on type public.confidence_tier is
  'Composite over four independent signals — recognition, structural, arithmetic, plausibility — never the model''s token probability, which is overconfident on handwriting and correlates poorly with being right.';

-- ── what the page turned out to be like ────────────────────────────────────
-- Scored at capture, while the paper is still in front of the student, and
-- carried here so review and the harness can both see why a page was hard.

alter table public.paper_page
  add column quality_verdict    text
    check (quality_verdict in ('ok', 'warn', 'fail')),
  add column quality_signals    jsonb  not null default '{}'::jsonb,
  add column conditioning_meta  jsonb  not null default '{}'::jsonb,
  add column layer_fallback     text
    check (layer_fallback in ('non_red_marking', 'student_wrote_red')),
  add column teacher_mark_count smallint not null default 0
    check (teacher_mark_count >= 0);

comment on column public.paper_page.layer_fallback is
  'Set when the page broke the colour assumption: the teacher marked in green, black or pencil, or the student wrote in red. Neither fails the scan — the page takes the colour-agnostic path and every field on it drops one confidence tier.';

-- ── what the paper says about itself ───────────────────────────────────────
-- The reported total is usually on the front page, usually circled. It is the
-- only ground truth the system gets for free, which is what makes stage 6 able
-- to know when it is wrong.

alter table public.paper
  add column subject          text,
  add column reported_total   numeric(6,2) check (reported_total >= 0),
  add column stated_maximum   numeric(6,2) check (stated_maximum > 0),
  add column total_awarded    numeric(6,2) check (total_awarded >= 0),
  add column total_available  numeric(6,2) check (total_available > 0),
  add column reconciled       boolean;

comment on column public.paper.subject is
  'INFERRED: SCANNING_SYSTEM.md §14 carries subject on the paper and Tier 2 matching needs it, but CLAUDE.md''s data model does not list it. Nullable until confirmed.';
comment on column public.paper.reported_total is
  'The total as the teacher wrote it. Kept as written even when our per-question reading disagrees — the app never tells a student their teacher cannot add.';
comment on column public.paper.reconciled is
  'NULL until stage 6 has run. False is a real and useful state: it routes the paper to review with the delta shown, and it is never resolved by adjusting a mark.';

-- ── extraction_run ─────────────────────────────────────────────────────────
-- Not optional. Without per-run versioning and correction counts there is no way
-- to tell whether a pipeline change improved anything, and this system will be
-- changed constantly for its first year.

create table public.extraction_run (
  id               uuid                     primary key default gen_random_uuid(),
  paper_id         uuid                     not null,
  student_id       uuid                     not null,
  pipeline_version text                     not null check (length(btrim(pipeline_version)) > 0),
  model_versions   jsonb                    not null default '{}'::jsonb,
  stage_timings    jsonb                    not null default '{}'::jsonb,
  status           public.extraction_status not null default 'queued',

  reconciled       boolean,
  -- Signed: our sum minus the teacher's reported total. A delta of exactly one
  -- question's typical value points straight at a missed or double-counted
  -- question, which is why the number is kept rather than just a flag.
  reconcile_delta  numeric(6,2),

  corrections_count integer                 not null default 0 check (corrections_count >= 0),
  -- Instrumented from day one. It is the number that decides whether the pricing
  -- model works, and it is much harder to retrofit than to log.
  cost_paise       integer                  not null default 0 check (cost_paise >= 0),

  -- How stage 7 routed this paper, and why. A Tier 2 candidate that found no
  -- scheme falls back to Tier 1 and says so; an approximated scheme is a
  -- fabricated authority and is worse than none.
  tier_routing     jsonb                    not null default '{}'::jsonb,

  failure_reason   text,
  started_at       timestamptz              not null default now(),
  finished_at      timestamptz,
  committed_at     timestamptz,

  unique (id, student_id),
  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade,

  constraint failed_runs_say_why check (status <> 'failed' or failure_reason is not null)
);

comment on table public.extraction_run is
  'One pass of the pipeline over one paper, with the versions and timings that make a change measurable. A paper may have several: a rescan of one page starts a new run.';

-- Extraction is processing, so it is gated on the consent that permits it.
-- Withdrawal has to stop new work, not merely hide existing rows.
create or replace function private.enforce_extraction_consent_gate()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_guardian uuid;
begin
  select s.guardian_id into v_guardian from public.student s where s.id = new.student_id;
  if v_guardian is null then
    raise exception 'unknown student %', new.student_id using errcode = '23503';
  end if;
  if not private.consent_is_granted(v_guardian, new.student_id, 'extract_text') then
    raise exception 'cannot start extraction: extract_text consent is not currently granted'
      using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger extraction_run_consent_gate before insert on public.extraction_run
  for each row execute function private.enforce_extraction_consent_gate();

-- ── question_region ────────────────────────────────────────────────────────
-- Stage 3 finds these, stage 4 fills them in, stage 9 lets the student fix them,
-- and stage 10 turns each one into a student_attempt. Until that last step they
-- are staging: nothing here is ever aggregated, and the analytics views do not
-- know this table exists.

create table public.question_region (
  id             uuid    primary key default gen_random_uuid(),
  run_id         uuid    not null,
  paper_id       uuid    not null,
  student_id     uuid    not null,
  order_index    smallint not null check (order_index >= 0),

  -- A question can straddle pages, so the region is a list of page-plus-box
  -- pairs, never a single box. Long answers in classes 11–12 routinely run two
  -- to three pages, and treating that as a failure would fail most of them.
  page_spans     jsonb   not null default '[]'::jsonb,

  question_label      text,
  question_label_box  jsonb,
  question_text       text,
  question_text_box   jsonb,
  student_answer      text,
  student_answer_box  jsonb,
  region_type         public.region_type,

  -- Fact fields, read off the page. Hard rule 1 lives one table over, where
  -- these become an attempt with marks_source = 'teacher_pen'; the model has no
  -- writable column anywhere in this table.
  marks_awarded       numeric(5,2) check (marks_awarded >= 0),
  marks_awarded_box   jsonb,
  marks_available     numeric(5,2) check (marks_available > 0),
  marks_available_box jsonb,
  teacher_remark      text,
  teacher_remark_box  jsonb,

  confidence_tier     public.confidence_tier not null default 'unsure',
  confidence_signals  jsonb   not null default '{}'::jsonb,
  needs_review        boolean not null default true,

  -- The student's verdict at stage 9. Correcting a transcription is accepted
  -- instantly and without verification — the student is the authority on what
  -- their own paper says.
  student_confirmed_at timestamptz,
  student_corrected    boolean not null default false,

  -- Set only on a confident Tier 2 match. Hard rule 2 is enforced one table
  -- over: student_attempt refuses a canonical question on a Tier 1 paper, so a
  -- fallback to Tier 1 cannot drag a scheme reference along with it.
  canonical_question_id uuid references public.canonical_question (id) on delete restrict,

  committed_attempt_id uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (id, student_id),
  unique (run_id, order_index),
  foreign key (run_id, student_id)   references public.extraction_run (id, student_id) on delete cascade,
  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade,
  -- Single-column on purpose. A composite (id, student_id) reference would need
  -- ON DELETE SET NULL to null both columns, and student_id is NOT NULL, so the
  -- first deleted attempt would fail instead of clearing the pointer. The only
  -- writer is commit_extraction_run(), which sets this from a row it has just
  -- inserted for this very student.
  foreign key (committed_attempt_id) references public.student_attempt (id) on delete set null,

  -- A field without provenance does not exist. If the extractor produced a value
  -- it cannot point at, the value is discarded and the field is marked unsure —
  -- so there is deliberately nowhere to store one.
  constraint label_has_provenance     check ((question_label  is null) = (question_label_box  is null)),
  constraint question_has_provenance  check ((question_text   is null) = (question_text_box   is null)),
  constraint answer_has_provenance    check ((student_answer  is null) = (student_answer_box  is null)),
  constraint awarded_has_provenance   check ((marks_awarded   is null) = (marks_awarded_box   is null)),
  constraint available_has_provenance check ((marks_available is null) = (marks_available_box is null)),
  constraint remark_has_provenance    check ((teacher_remark  is null) = (teacher_remark_box  is null)),

  -- Plausibility, checked where it cannot be argued with.
  constraint awarded_within_available check (
    marks_awarded is null or marks_available is null or marks_awarded <= marks_available),

  -- An unreadable region has nothing anyone could confirm, so it can never be
  -- silently marked reviewed and carried forward.
  constraint unreadable_stays_unreviewed check (
    confidence_tier <> 'unreadable' or committed_attempt_id is null)
);

comment on table public.question_region is
  'Pre-commit staging for one question found on one paper. Never aggregated: nothing reads this table for analytics, and a region only becomes a fact when stage 10 writes it into student_attempt.';
comment on column public.question_region.page_spans is
  'Ordered [{page, box}] pairs. A question that runs across pages is normal, not a failure.';
comment on column public.question_region.confidence_signals is
  'The four signals behind the tier, kept separately: {recognition, structural, arithmetic, plausibility}. A field can be read cleanly and still be structurally suspect, and the review screen orders by which signal failed.';

-- ── teacher_mark ───────────────────────────────────────────────────────────
-- The stage 2 map, joined to regions at stage 5. Every row is something a human
-- put on the page with a pen.

create table public.teacher_mark (
  id           uuid     primary key default gen_random_uuid(),
  run_id       uuid     not null,
  paper_id     uuid     not null,
  student_id   uuid     not null,
  region_id    uuid,
  page_number  smallint not null check (page_number > 0),

  box          jsonb    not null,
  shape        public.mark_shape not null default 'unknown',
  mark_class   public.mark_class not null default 'unknown',
  -- Present only on a marginal number: the awarded mark for the region, and the
  -- highest-weight signal there is. Where a marginal number and the tick pattern
  -- disagree, the number wins — the teacher wrote it deliberately.
  value        numeric(5,2),
  -- Free text, transcribed verbatim. Never paraphrased and never summarised: the
  -- teacher's own words are the best explanation anchor in the product.
  comment_text text,
  metrics      jsonb    not null default '{}'::jsonb,
  confidence_tier public.confidence_tier not null default 'unsure',
  created_at   timestamptz not null default now(),

  unique (id, student_id),
  foreign key (run_id, student_id)   references public.extraction_run (id, student_id) on delete cascade,
  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade,
  foreign key (region_id, student_id) references public.question_region (id, student_id) on delete set null,

  constraint only_numbers_carry_a_value check (
    value is null or mark_class = 'marginal_number'),
  constraint only_comments_carry_text check (
    comment_text is null or mark_class = 'comment')
);

comment on table public.teacher_mark is
  'One mark the teacher made, with the box it occupies. A circle or underline is retained even though it carries no number: it is the teacher pointing directly at what went wrong, which is the highest-value input the explanation stage gets.';

-- ── region_explanation ─────────────────────────────────────────────────────
-- Stage 8's output, held against the region until stage 10 turns it into a
-- mark_loss_event. It cannot be written straight to mark_loss_event because that
-- table hangs off an attempt, and an attempt does not exist until the student
-- has reviewed the reading it would be built from.
--
-- This is the only table in the schema whose text the model authors. It holds no
-- mark: marks_lost is arithmetic over two fact fields, and there is no column
-- here that could carry an opinion about what the mark should have been.

create table public.region_explanation (
  id             uuid primary key default gen_random_uuid(),
  region_id      uuid not null,
  run_id         uuid not null,
  student_id     uuid not null,

  tier           public.paper_tier not null,
  cause          public.loss_cause,
  marks_lost     numeric(5,2) check (marks_lost > 0),
  body           text,
  do_this_next   text,
  concepts       text[] not null default '{}',

  -- Hard rule 2: scheme detail cannot be shown without naming where it came
  -- from, so it cannot be stored without naming it either.
  scheme_source  text,
  scheme_version text,

  model_version  text not null,
  prompt_version text not null,
  generated_at   timestamptz not null default now(),

  unique (id, student_id),
  unique (region_id),
  foreign key (region_id, student_id) references public.question_region (id, student_id) on delete cascade,
  foreign key (run_id, student_id)    references public.extraction_run (id, student_id) on delete cascade,

  constraint tier_1_cites_no_scheme check (
    tier = 'tier_2' or (scheme_source is null and scheme_version is null)),
  constraint scheme_citation_is_complete check (
    (scheme_source is null) = (scheme_version is null)),
  -- An explanation that names a cause has to say how many marks it accounts for,
  -- and one that accounts for marks has to name a cause. Half of either is a row
  -- nothing downstream can use.
  constraint cause_and_loss_travel_together check (
    (cause is null) = (marks_lost is null))
);

comment on table public.region_explanation is
  'Stage 8. The model''s only authored prose in the schema. Never contradicts marks_awarded — it explains the deduction, it does not evaluate it.';
comment on column public.region_explanation.do_this_next is
  'Must name something specific to this answer and performable during an exam. NULL when the model could not clear that bar; an empty slot is honest and generic advice is not.';

alter table public.region_explanation enable row level security;
create policy region_explanation_all_own on public.region_explanation for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = region_explanation.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = region_explanation.student_id and s.guardian_id = private.current_guardian_id()));

-- Explaining is its own processing purpose, and withdrawing it has to stop new
-- explanations rather than merely hide the ones already written.
create or replace function private.enforce_explanation_consent_gate()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_guardian uuid;
begin
  select s.guardian_id into v_guardian from public.student s where s.id = new.student_id;
  if v_guardian is null then
    raise exception 'unknown student %', new.student_id using errcode = '23503';
  end if;
  if not private.consent_is_granted(v_guardian, new.student_id, 'generate_explanations') then
    raise exception 'cannot write an explanation: generate_explanations consent is not currently granted'
      using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger region_explanation_consent_gate before insert on public.region_explanation
  for each row execute function private.enforce_explanation_consent_gate();

-- ── stage 10 · commit ──────────────────────────────────────────────────────
-- Turning reviewed regions into attempts. Runs as the caller, so RLS applies
-- exactly as it does to a direct insert; it exists to make the transition atomic
-- and to enforce the two things a client could otherwise skip.

create or replace function public.commit_extraction_run(p_run_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_run       public.extraction_run;
  v_paper     public.paper;
  v_pending   integer;
  v_region    public.question_region;
  v_attempt   uuid;
  v_committed integer := 0;
begin
  select * into v_run from public.extraction_run where id = p_run_id;
  if v_run.id is null then
    raise exception 'no such extraction run' using errcode = 'P0002';
  end if;
  if v_run.committed_at is not null then
    raise exception 'this run is already committed' using errcode = '23505';
  end if;

  select * into v_paper from public.paper where id = v_run.paper_id;

  -- Review is a required step. A region that still needs the student's eyes has
  -- not had them, and committing it would put an unconfirmed reading into the
  -- record where it starts shaping insights.
  select count(*) into v_pending
  from public.question_region r
  where r.run_id = p_run_id
    and r.needs_review
    and r.student_confirmed_at is null;

  if v_pending > 0 then
    raise exception '% question(s) still need review before this paper can be saved', v_pending
      using errcode = '42501';
  end if;

  for v_region in
    select * from public.question_region
    where run_id = p_run_id
    order by order_index
  loop
    -- Hard rule 4: a region nobody could read is not quietly dropped, and it is
    -- not turned into an attempt with a guessed mark either. It stays visible as
    -- a region and contributes nothing.
    if v_region.confidence_tier = 'unreadable' then
      continue;
    end if;
    -- No mark on the page means no fact to record. The question is real and the
    -- region keeps it; there is simply nothing to aggregate.
    if v_region.marks_awarded is null or v_region.marks_available is null then
      continue;
    end if;

    insert into public.student_attempt (
      student_id, paper_id, paper_tier, canonical_question_id,
      question_label, question_text,
      student_answer, marks_awarded, max_marks, marks_source, teacher_remark,
      extraction_confidence,
      student_confirmed_at
    ) values (
      v_region.student_id, v_region.paper_id, v_paper.tier,
      -- Only a Tier 2 paper may carry one. On a Tier 1 fallback this is null
      -- whatever the region holds, so a stale match cannot survive the
      -- downgrade and trip the constraint instead of being dropped.
      case when v_paper.tier = 'tier_2' then v_region.canonical_question_id end,
      coalesce(v_region.question_label, 'Q' || (v_region.order_index + 1)),
      v_region.question_text, v_region.student_answer,
      v_region.marks_awarded, v_region.marks_available,
      -- Hard rule 1. The number was read off the teacher's pen; the model has no
      -- standing to be its source and there is no enum value that would let it be.
      'teacher_pen',
      v_region.teacher_remark,
      -- The spec's three tiers collapse onto the database's three-value enum
      -- here. `confident` is `likely` — read cleanly, not yet confirmed by the
      -- person who sat the exam — and everything else is `unsure`, which the
      -- analytics views exclude until it is confirmed.
      case when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
           else 'unsure'::public.confidence end,
      v_region.student_confirmed_at
    )
    returning id into v_attempt;

    update public.question_region
       set committed_attempt_id = v_attempt, updated_at = now()
     where id = v_region.id;

    -- Stage 8's output becomes a loss event now that there is an attempt for it
    -- to hang off. Only where the model actually had something to say: a
    -- question it could not explain leaves no row, which is the honest outcome
    -- and keeps the empty slot empty rather than filling it with a shrug.
    insert into public.mark_loss_event (
      attempt_id, student_id, cause, marks_lost, ai_explanation, do_this_next, confidence
    )
    select v_attempt, e.student_id, e.cause, e.marks_lost, e.body, e.do_this_next,
           case when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
                else 'unsure'::public.confidence end
      from public.region_explanation e
     where e.region_id = v_region.id
       and e.cause is not null
       and e.marks_lost is not null
       and e.marks_lost <= v_region.marks_available - v_region.marks_awarded;

    v_committed := v_committed + 1;
  end loop;

  update public.extraction_run
     set status = 'committed', committed_at = now(), finished_at = coalesce(finished_at, now())
   where id = p_run_id;

  return jsonb_build_object(
    'run_id', p_run_id,
    'attempts_committed', v_committed,
    'reconciled', v_run.reconciled,
    'reconcile_delta', v_run.reconcile_delta
  );
end;
$$;

revoke all on function public.commit_extraction_run(uuid) from public, anon;
grant execute on function public.commit_extraction_run(uuid) to authenticated;

comment on function public.commit_extraction_run(uuid) is
  'Stage 10. Refuses while any region still needs review, skips regions nobody could read rather than guessing a mark for them, and never adjusts a number to make a total add up.';

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Single-hop on student_id, matching every other content table.

alter table public.extraction_run enable row level security;
create policy extraction_run_all_own on public.extraction_run for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = extraction_run.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = extraction_run.student_id and s.guardian_id = private.current_guardian_id()));

alter table public.question_region enable row level security;
create policy question_region_all_own on public.question_region for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = question_region.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = question_region.student_id and s.guardian_id = private.current_guardian_id()));

alter table public.teacher_mark enable row level security;
create policy teacher_mark_all_own on public.teacher_mark for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = teacher_mark.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = teacher_mark.student_id and s.guardian_id = private.current_guardian_id()));

-- ── review queue ───────────────────────────────────────────────────────────
-- The order the review screen works in: unreadable first, then unsure, then the
-- rest. Ordering it here rather than in the client means the harness and the
-- app agree about what "needs your eyes" means.

create view public.review_queue with (security_invoker = true) as
select
  r.id, r.run_id, r.paper_id, r.student_id, r.order_index,
  r.question_label, r.confidence_tier, r.confidence_signals, r.needs_review,
  r.marks_awarded, r.marks_available, r.page_spans, r.student_confirmed_at,
  case r.confidence_tier when 'unreadable' then 0 when 'unsure' then 1 else 2 end as review_rank
from public.question_region r
where r.committed_attempt_id is null;

grant select on public.review_queue to authenticated;

comment on view public.review_queue is
  'Stage 9''s working order. Unsure and unreadable fields come first, not last — they are the reason the screen exists.';

-- ── indexes ────────────────────────────────────────────────────────────────

create index extraction_run_paper_idx   on public.extraction_run (paper_id, started_at desc);
create index extraction_run_status_idx  on public.extraction_run (student_id, status);
create index question_region_run_idx    on public.question_region (run_id, order_index);
create index question_region_paper_idx  on public.question_region (paper_id);
create index question_region_review_idx on public.question_region (student_id)
  where needs_review and student_confirmed_at is null;
create index teacher_mark_run_idx       on public.teacher_mark (run_id);
create index teacher_mark_region_idx    on public.teacher_mark (region_id);
create index region_explanation_run_idx on public.region_explanation (run_id);
