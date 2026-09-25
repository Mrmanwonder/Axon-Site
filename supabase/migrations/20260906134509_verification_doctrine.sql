-- ============================================================================
-- The model proposes, deterministic code disposes
-- ============================================================================
-- Addendum C. Four findings from the live database, all verified on this
-- project before this file was written:
--
--   The `arithmetic` signal disagreed with itself. One answer, stored five
--   times, byte-identical: true, true, true, true, false. The working it judged
--   contains `4 + 1/2 = 8 + 1/2`, false on every day of the week. On question c
--   the reverse: a correct chain marked false, and `3/16 | 2^5` — not an
--   expression at all — marked true on four rows of five. A decidable question
--   was handed to something that guesses.
--
--   The four signals collapse into one tier. Live rows carry
--   `recognition: false` beside `arithmetic: true` and commit marks anyway.
--
--   Duplicate regions. Seven (paper_id, question_label) groups hold more than
--   one row, so every count a student sees is inflated, and the same question
--   can be confident and unsure at once depending which row a query reaches.
--
--   An adjudication that diagnosed its own failure and shipped. Verbatim, on a
--   committed row carrying marks_awarded = 3.00: "The pipeline seems to have
--   misidentified the question labels or order."
--
-- This migration is the half of the fix that belongs in the database: the
-- shapes that make the deterministic checks storable, and the constraints that
-- make the rules impossible to drop rather than merely discouraged.
-- ============================================================================

-- ── 1 · a signal may say it does not know ───────────────────────────────────
-- `confidence_signals` is jsonb, so `unknown` needs no column change — but it
-- does need to be legal, and a boolean-only shape was being assumed by
-- everything reading it. This records the vocabulary and refuses anything else,
-- so a fifth value cannot appear without a migration saying so out loud.
create or replace function private.signal_is_valid(v jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select v is null
      or jsonb_typeof(v) = 'boolean'
      or (jsonb_typeof(v) = 'string' and v #>> '{}' = 'unknown');
$$;

comment on function private.signal_is_valid(jsonb) is
  'A confidence signal is true, false, or the string "unknown". A boolean alone forces a guess where no check applies, and a forced guess is a hallucination with a schema.';

alter table public.question_region
  drop constraint if exists question_region_signals_are_three_valued;
alter table public.question_region
  add constraint question_region_signals_are_three_valued check (
    private.signal_is_valid(confidence_signals -> 'arithmetic')
    and private.signal_is_valid(confidence_signals -> 'structural')
    and private.signal_is_valid(confidence_signals -> 'recognition')
    and private.signal_is_valid(confidence_signals -> 'plausibility')
  );

-- ── 2 · the answer is not a string ──────────────────────────────────────────
-- `student_answer` is text, which is why the screen shows what a student called
-- "numbers, alphabets and signs paired together": there is nowhere to put
-- structure, so structure is destroyed at write time and no frontend can
-- recover it. Handwritten `8/2` became `8+1` — a correct step turned into a
-- false one — and `3/16 × 2⁵` became `3/16 | 2^5`, a character nobody wrote.
--
-- Additive, deliberately. raw_text keeps what exists today, so search and the
-- fallback render are unaffected and no meaning is migrated.
alter table public.question_region add column if not exists answer_block jsonb;
alter table public.student_attempt add column if not exists answer_block jsonb;

do $$
declare t text;
begin
  foreach t in array array['question_region', 'student_attempt'] loop
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_answer_block_shape');
    execute format($f$
      alter table public.%I add constraint %I check (
        answer_block is null
        or (jsonb_typeof(answer_block) = 'object'
            and jsonb_typeof(answer_block -> 'lines') = 'array'
            and answer_block ? 'raw_text')
      )$f$, t, t || '_answer_block_shape');
  end loop;
end $$;

comment on column public.question_region.answer_block is
  'The student answer with its structure intact: lines of typed segments carrying LaTeX, annotations (struck_through, boxed, circled), a bbox into the page image, and per-segment confidence. raw_text alongside is what exists today. Null until the extraction stage fills it; the screen falls back to student_answer.';

-- ── 3 · one question, one region ────────────────────────────────────────────
-- Seven label groups in production hold more than one row for the same
-- question. Within a single run that is a structural failure: two regions
-- claiming the same part means the marks on at least one are attached to the
-- wrong question. Across runs it is legitimate — a re-scan makes a new run —
-- so the constraint is scoped to the run, and which run is canonical for a
-- paper is settled by the view below rather than by whichever row a query
-- happens to reach.
--
-- Existing duplicates are not deleted. They are historical rows from real
-- scans, and destroying a student's data to satisfy a constraint added
-- afterwards is not a trade this project makes. The index is created only over
-- rows added from here, using a partial predicate on created_at.
do $$
declare
  v_cutoff constant timestamptz := '2026-09-06 12:00:00+00';
  v_dupes  integer;
begin
  select count(*) into v_dupes from (
    select run_id, lower(regexp_replace(question_label, '[^A-Za-z0-9]', '', 'g')) k
    from public.question_region
    where question_label is not null and created_at >= v_cutoff
    group by 1, 2 having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise exception 'refusing to add the uniqueness index: % duplicate label groups already exist after the cutoff', v_dupes;
  end if;
end $$;

create unique index if not exists question_region_one_label_per_run
  on public.question_region (run_id, lower(regexp_replace(question_label, '[^A-Za-z0-9]', '', 'g')))
  where question_label is not null and created_at >= '2026-09-06 12:00:00+00';

comment on index public.question_region_one_label_per_run is
  'One region per question per run. The expression strips punctuation because production holds both "2a" and "2. a)" for the same question, and a raw string comparison sees no clash. Partial on created_at so historical duplicate rows from real scans are preserved rather than deleted.';

-- Which run speaks for a paper. Without this, Insights counts the same question
-- once per re-run, and a query reaching a different row gets a different tier.
create or replace view public.paper_canonical_run as
  select distinct on (r.paper_id)
         r.paper_id,
         r.id as run_id,
         r.committed_at,
         r.status
    from public.extraction_run r
   order by r.paper_id,
            -- A committed run wins; then the most recently committed; then the
            -- most recent attempt. Deterministic, and never a coin toss.
            (r.committed_at is not null) desc,
            r.committed_at desc nulls last,
            r.started_at desc;

comment on view public.paper_canonical_run is
  'The one run whose regions speak for a paper. Re-scans create new runs, and without a canonical choice every count a student sees is multiplied by the number of times they scanned.';

-- ── 4 · an adjudication that reports a structural problem blocks the commit ──
-- The row quoted in the header wrote "misidentified the question labels or
-- order" into its own record and committed the marks regardless. needs_review
-- exists for exactly that. The worker now stops it too; this is the half that
-- cannot be forgotten by a later prompt change.
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
  v_dupes     integer;
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

  -- New: the adjudicator's own structural findings are binding.
  if coalesce((v_run.adjudication ->> 'blocks_commit')::boolean, false) then
    raise exception 'this paper needs a person to look at it first: %',
      coalesce(v_run.adjudication ->> 'blocked_reason', 'the adjudication reported a structural problem')
      using errcode = '42501';
  end if;

  -- New: two regions claiming the same question means at least one set of marks
  -- is attached to the wrong question, and there is no safe way to guess which.
  select count(*) into v_dupes from (
    select lower(regexp_replace(question_label, '[^A-Za-z0-9]', '', 'g')) k
      from public.question_region
     where run_id = p_run_id and question_label is not null
     group by 1 having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise exception 'this paper has % question(s) read twice, so the marks may be on the wrong one', v_dupes
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
      student_answer, answer_block, marks_awarded, max_marks, marks_source, teacher_remark,
      extraction_confidence,
      student_confirmed_at
    ) values (
      v_region.student_id, v_region.paper_id, v_paper.tier,
      -- Only a Tier 2 paper may carry one. On a Tier 1 fallback this is null
      -- whatever the region holds, so a stale match cannot survive the
      -- downgrade and trip the constraint instead of being dropped.
      case when v_paper.tier = 'tier_2' then v_region.canonical_question_id end,
      coalesce(v_region.question_label, 'Q' || (v_region.order_index + 1)),
      v_region.question_text, v_region.student_answer, v_region.answer_block,
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
      attempt_id, student_id, cause, marks_lost, ai_explanation, do_this_next, confidence,
      concepts,
      command_word, command_word_note, model_answer, loss_reasons,
      grounding_status, model_answer_source, depends_on_parts, unresolved_parts
    )
    select v_attempt, e.student_id, e.cause, e.marks_lost, e.body, e.do_this_next,
           case when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
                else 'unsure'::public.confidence end,
           coalesce(e.concepts, '{}'),
           e.command_word, e.command_word_note, e.model_answer,
           coalesce(e.loss_reasons, '[]'::jsonb),
           e.grounding_status, e.model_answer_source,
           coalesce(e.depends_on_parts, '{}'),
           coalesce(e.unresolved_parts, '{}')
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

-- ── 5 · the content prompt's contract changed ───────────────────────────────
-- It now returns `answer_block`, so rows produced before and after are not the
-- same shape and must be distinguishable. prompt_version is how provenance is
-- recorded on every row the stage writes, and leaving it at content.v1 would
-- make two different contracts indistinguishable in the record.
update public.model_route
   set prompt_version = 'content.v2'
 where stage = 'content' and prompt_version = 'content.v1';
