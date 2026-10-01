-- AXO-124: a paper's stored totals follow what was actually committed.
--
-- paper.total_awarded / total_available are written by the reconcile worker from the regions as
-- first read. The student then corrects marks in review (and the adjudicator may), and nothing
-- rewrote the paper totals afterwards: paper 073a1b4e shows 22 / 29 while its 12 committed
-- attempts sum to 23 / 29. Library then shows a total that the questions underneath do not add
-- up to, a number we cannot source to a teacher.
--
-- commit_extraction_run now sets both totals from the attempts it just wrote. Nothing else about
-- the function changes. Existing committed papers are backfilled once.
--
-- (The `reconciled` flag is untouched: it still means "the reading matched the printed total",
-- and is false when the paper printed no total to check against. That is recorded on AXO-124.)

create or replace function public.commit_extraction_run(p_run_id uuid)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
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

  select count(*) into v_pending
  from public.question_region r
  where r.run_id = p_run_id
    and r.needs_review
    and r.student_confirmed_at is null;

  if v_pending > 0 then
    raise exception '% question(s) still need review before this paper can be saved', v_pending
      using errcode = '42501';
  end if;

  if coalesce((v_run.adjudication ->> 'blocks_commit')::boolean, false) then
    raise exception 'this paper needs a person to look at it first: %',
      coalesce(v_run.adjudication ->> 'blocked_reason', 'the adjudication reported a structural problem')
      using errcode = '42501';
  end if;

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
    if v_region.confidence_tier = 'unreadable' then
      continue;
    end if;
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
      case when v_paper.tier = 'tier_2' then v_region.canonical_question_id end,
      coalesce(v_region.question_label, 'Q' || (v_region.order_index + 1)),
      v_region.question_text, v_region.student_answer, v_region.answer_block,
      v_region.marks_awarded, v_region.marks_available,
      'teacher_pen',
      v_region.teacher_remark,
      case when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
           else 'unsure'::public.confidence end,
      v_region.student_confirmed_at
    )
    returning id into v_attempt;

    update public.question_region
       set committed_attempt_id = v_attempt, updated_at = now()
     where id = v_region.id;

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

  -- The paper's totals are the sum of the marks the student confirmed, which may differ from the
  -- first reading. Left null when nothing was committed rather than shown as zero.
  update public.paper p
     set total_awarded   = s.awarded,
         total_available = s.available
    from (select sum(marks_awarded) awarded, sum(max_marks) available
            from public.student_attempt where paper_id = v_run.paper_id) s
   where p.id = v_run.paper_id and v_committed > 0;

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
$function$;

-- One-off backfill: papers committed before this migration.
update public.paper p
   set total_awarded = s.awarded, total_available = s.available
  from (select paper_id, sum(marks_awarded) awarded, sum(max_marks) available
          from public.student_attempt group by paper_id) s
 where p.id = s.paper_id
   and (p.total_awarded is distinct from s.awarded or p.total_available is distinct from s.available);
