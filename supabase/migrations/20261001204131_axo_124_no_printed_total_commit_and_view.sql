-- AXO-124 (part 2 of 2): commit + paper_progress view. Split from the single repo file on
-- 2026-10-02 to match the production ledger, which recorded the two halves separately
-- (20261001204112 schema, 20261001204131 commit_and_view). Content unchanged.

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
  v_skipped   integer := 0;
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
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_region.marks_awarded is null or v_region.marks_available is null then
      v_skipped := v_skipped + 1;
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
  -- The paper's totals are the sum of the marks the student confirmed. When the paper printed no
  -- total the figure is Axon's own addition (total_basis = 'added_up'), and it is a lower bound
  -- (total_partial) when a question's mark could not be read. Left alone when nothing committed.
  update public.paper p
     set total_awarded   = s.awarded,
         total_available = s.available,
         total_basis     = case when v_paper.reported_total is not null then 'printed' else 'added_up' end,
         total_partial   = v_skipped > 0
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

-- ── progress view: expose the new facts ────────────────────────────────────
-- Columns are appended, so existing readers are unaffected.

create or replace view public.paper_progress with (security_invoker = true) as
select
  r.id            as run_id,
  r.paper_id,
  r.student_id,
  r.status,
  r.status_reason,
  r.started_at,
  r.finished_at,
  (select count(*) from public.paper_page p where p.paper_id = r.paper_id)          as pages_total,
  (select count(*) from public.paper_page p
    where p.paper_id = r.paper_id and p.structure_status = 'done')                  as pages_done,
  c.questions_total::bigint                                                         as questions_total,
  (select count(*) from public.question_region q
    where q.run_id = r.id and q.extract_status = 'done')                            as questions_done,
  (select count(*) from public.question_region q
    where q.run_id = r.id and q.needs_review and q.student_confirmed_at is null)    as questions_needing_you,
  nullif(btrim(r.tier_routing #>> '{triage,subject}'), '')                          as suggested_subject,
  nullif(btrim(r.tier_routing #>> '{triage,confidence}'), '')                       as suggested_confidence,
  c.parts_total::bigint                                                             as parts_total,
  c.unassigned_parts::bigint                                                        as unassigned_parts,
  c.raw_region_count::bigint                                                        as raw_region_count,
  r.reconciled                                                                      as reconciled,
  r.status_reason_code                                                              as status_reason_code
from public.extraction_run r
cross join lateral public.question_count_contract(r.id) c;

grant select on public.paper_progress to authenticated;
