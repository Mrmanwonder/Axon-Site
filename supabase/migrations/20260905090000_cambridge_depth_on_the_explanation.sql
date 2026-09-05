-- ============================================================================
-- Cambridge depth on the explanation
-- ============================================================================
-- The explain stage has been producing one flat cause, one mark count and one
-- line of advice. For a Cambridge student that is the smallest useful fraction
-- of what a lost mark can teach, and it collapses a two-part mistake into one
-- averaged verdict where the half they could have fixed on the day disappears.
--
-- Four additions, each of which renders nothing when the model cannot produce
-- it honestly:
--
--   command_word       the Cambridge command word the question was built around
--   command_word_note  one line on what that word requires of an answer
--   model_answer       the corrected working, in the student's own step shape
--   loss_reasons       the deduction broken into its distinct parts
--
-- On hard rule 1 and the mark types. Spec §3 asks each loss reason to carry a
-- Cambridge mark type — M for method, A for accuracy, B for independent. That
-- notation is marking-scheme vocabulary, and every paper reaching this table
-- today is Tier 1, which by definition has no scheme in the library. Writing
-- "you lost M1" without one is reconstructing scheme language, which rule 2
-- forbids in the same breath as inventing the scheme itself. So the shape is
-- here and the field is in the jsonb, and the Tier 1 prompt is not asked for it
-- and cannot set it: it is null on every row until a Tier 2 prompt grounded in
-- a real canonical_question.marking_scheme exists to fill it.
--
-- The marks constraint below is rule 1 at the schema level, in the same spirit
-- as marks_source having no enum value for the model. A decomposition that
-- accounts for more marks than the teacher actually took is not a
-- decomposition, it is a second opinion on the mark, and it is unstorable
-- rather than merely discouraged.
-- ============================================================================

-- Immutable so a CHECK can call it. Sums the marks across a loss_reasons array,
-- ignoring anything that is not a positive number — the constraint's job is to
-- catch a total that overruns the teacher, not to re-validate every element.
create or replace function private.loss_reasons_marks(p_reasons jsonb)
returns numeric
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(sum((r->>'marks')::numeric), 0)
  from jsonb_array_elements(coalesce(p_reasons, '[]'::jsonb)) r
  where jsonb_typeof(r) = 'object'
    and jsonb_typeof(r->'marks') = 'number'
    and (r->>'marks')::numeric > 0;
$$;

comment on function private.loss_reasons_marks(jsonb) is
  'Total marks accounted for by a loss_reasons array. Exists so hard rule 1 can be a CHECK: the parts may never add up to more than the teacher took.';

do $$
declare
  t text;
begin
  foreach t in array array['region_explanation', 'mark_loss_event'] loop
    execute format('alter table public.%I add column if not exists command_word text', t);
    execute format('alter table public.%I add column if not exists command_word_note text', t);
    execute format('alter table public.%I add column if not exists model_answer text', t);
    execute format(
      'alter table public.%I add column if not exists loss_reasons jsonb not null default ''[]''::jsonb', t);

    -- An object would silently read as zero reasons rather than as the mistake
    -- it is, so the shape is required rather than assumed.
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_loss_reasons_is_array');
    execute format(
      'alter table public.%I add constraint %I check (jsonb_typeof(loss_reasons) = ''array'')',
      t, t || '_loss_reasons_is_array');

    -- Hard rule 1, enforced rather than trusted.
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_loss_reasons_within_marks_lost');
    execute format($f$
      alter table public.%I add constraint %I check (
        case
          when jsonb_array_length(loss_reasons) = 0 then true
          when marks_lost is null then false
          else private.loss_reasons_marks(loss_reasons) <= marks_lost
        end
      )$f$, t, t || '_loss_reasons_within_marks_lost');

    -- A note explaining a command word we did not accept is a caption on a
    -- missing picture.
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_command_word_note_needs_word');
    execute format(
      'alter table public.%I add constraint %I check (command_word_note is null or command_word is not null)',
      t, t || '_command_word_note_needs_word');
  end loop;
end $$;

comment on column public.mark_loss_event.command_word is
  'The Cambridge command word this question was built around, from a closed list. Null when the stem was unreadable or the word was not one we recognise — never a guess.';
comment on column public.mark_loss_event.model_answer is
  'The corrected working, in the same steps as the student''s answer. A demonstration of how the question is answered, never a claim about what this attempt was worth.';
comment on column public.mark_loss_event.loss_reasons is
  'The deduction broken into distinct parts. Empty is normal: a single-cause question has nothing to decompose, and the flat cause carries it.';

-- ============================================================================
-- The bridge insert carries the four across.
--
-- Everything else in this function is the live body, verified against
-- pg_get_functiondef() on the production project before editing and unchanged
-- line for line. Only the mark_loss_event insert differs.
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
      command_word, command_word_note, model_answer, loss_reasons
    )
    select v_attempt, e.student_id, e.cause, e.marks_lost, e.body, e.do_this_next,
           case when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
                else 'unsure'::public.confidence end,
           coalesce(e.concepts, '{}'),
           -- The four lines this migration exists for. Everything above is
           -- carried over from the live body unchanged.
           e.command_word, e.command_word_note, e.model_answer,
           coalesce(e.loss_reasons, '[]'::jsonb)
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
