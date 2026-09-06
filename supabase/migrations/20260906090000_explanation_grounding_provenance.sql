-- ============================================================================
-- Grounding provenance on the explanation
-- ============================================================================
-- On 2026-09-05 the explain stage rendered this, under the heading "See the
-- corrected working", for a Computer Science question reading "(ii) Justify
-- your answer given in part (d)(i)":
--
--   "The answer in (d)(i) is correct because the signal-to-noise ratio remains
--    above the threshold required for accurate signal reconstruction, ensuring
--    the bit error rate stays within acceptable limits."
--
-- The paper was about normalised floating-point representation. Signal-to-noise
-- ratio has nothing to do with it. This was not a wrong answer to the question;
-- it was a plausible sentence generated *without* the question — the model was
-- handed "justify your answer to (d)(i)" and never shown (d)(i).
--
-- (d)(i) was in this database the whole time. Same run, same table, order_index
-- 1 against this question's 2: "State whether the floating-point number given in
-- part (c) is normalised or not normalised", answered "Not Normalized", 1/1. The
-- explain worker selected one region by id and never looked left.
--
-- The worker now resolves the parts a question refers to and puts them in the
-- prompt. These three columns are the other half: what the explanation was
-- actually grounded in, recorded on the row, so a card can be traced back to its
-- evidence instead of taken on trust — and so a corrected working that could not
-- be grounded is stored as *withheld with a reason* rather than silently absent.
-- Hard rule 4: an admitted gap is recoverable, an invisible one is not.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['region_explanation', 'mark_loss_event'] loop
    -- Why the corrected working is not on this row. Null means nothing was
    -- withheld — either one was stored, or the model honestly declined to write
    -- one, which is the outcome the prompt asks for and is not a failure.
    execute format(
      'alter table public.%I add column if not exists model_answer_withheld_reason text', t);

    -- The earlier parts that were resolved and put in front of the model.
    execute format(
      'alter table public.%I add column if not exists depends_on_parts text[] not null default ''{}''', t);

    -- Parts this question points at that could not be found in the run. A
    -- non-empty array is the pipeline saying, on the record, that it explained a
    -- question whose setup it could not read.
    execute format(
      'alter table public.%I add column if not exists unresolved_parts text[] not null default ''{}''', t);

    -- A reason is an account of an absence. Storing one beside a corrected
    -- working that is present would mean both "here it is" and "here is why it
    -- isn't", and the card would have to pick one.
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_withheld_reason_needs_absence');
    execute format(
      'alter table public.%I add constraint %I check (model_answer_withheld_reason is null or model_answer is null)',
      t, t || '_withheld_reason_needs_absence');

    -- A closed list. The point of the column is that the reasons are countable —
    -- "how often do we withhold, and for which of the two causes" is the metric
    -- that says whether the gate is set right, and free text cannot answer it.
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_withheld_reason_known');
    execute format($f$
      alter table public.%I add constraint %I check (
        model_answer_withheld_reason is null
        or model_answer_withheld_reason in ('unresolved_dependency', 'off_topic')
      )$f$, t, t || '_withheld_reason_known');
  end loop;
end $$;

comment on column public.region_explanation.model_answer_withheld_reason is
  'Why no corrected working is stored: unresolved_dependency (the question refers to a part that could not be read) or off_topic (what came back shared no subject vocabulary with the question). Null when nothing was withheld.';
comment on column public.region_explanation.depends_on_parts is
  'Labels of the earlier parts resolved and placed in the explanation prompt. Empty for a question that stands alone.';
comment on column public.region_explanation.unresolved_parts is
  'Parts this question refers to that were not found in the run. Non-empty means the explanation was written without setup the question depends on.';

comment on column public.mark_loss_event.model_answer_withheld_reason is
  'Carried from region_explanation at commit. See that column.';

-- ============================================================================
-- The bridge insert carries the three across.
--
-- Everything else in this function is the live body as of 20260905090000 and is
-- unchanged line for line. Only the mark_loss_event column list differs.
-- ============================================================================
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
      attempt_id, student_id, cause, marks_lost, ai_explanation, do_this_next, confidence,
      concepts,
      command_word, command_word_note, model_answer, loss_reasons,
      model_answer_withheld_reason, depends_on_parts, unresolved_parts
    )
    select v_attempt, e.student_id, e.cause, e.marks_lost, e.body, e.do_this_next,
           case when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
                else 'unsure'::public.confidence end,
           coalesce(e.concepts, '{}'),
           e.command_word, e.command_word_note, e.model_answer,
           coalesce(e.loss_reasons, '[]'::jsonb),
           -- The three this migration exists for. Everything above is carried
           -- over from the live body unchanged.
           e.model_answer_withheld_reason,
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
