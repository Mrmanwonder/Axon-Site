-- AXO-154: an exam date is a student-supplied fact, separate from added-on history.
-- No backfill: date_taken on an old paper does not establish an exam date.
alter table public.paper add column exam_date date;
alter table public.paper add constraint paper_exam_date_calendar
  check (exam_date between date '0001-01-01' and date '9999-12-31');
comment on column public.paper.exam_date is
  'Optional exam date supplied or corrected by the student. NULL means unknown; date_taken remains the added/upload date.';

create or replace function public.set_paper_exam_date(p_paper_id uuid, p_exam_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Both SELECT and UPDATE use the active Student Mode RLS policies.
  update public.paper set exam_date = p_exam_date where id = p_paper_id;
  if not found then
    raise exception 'That paper is not open in this profile.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.set_paper_exam_date(uuid, date) from public, anon;
grant execute on function public.set_paper_exam_date(uuid, date) to authenticated, service_role;

-- Existing share-token validation, withholding and the privacy allowlist are unchanged.

create or replace function public.resolve_academic_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'extensions', 'pg_temp'
as $function$
declare
  v_share private.academic_share%rowtype;
  v_result jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('found', false);
  end if;

  select *
    into v_share
    from private.academic_share
   where token_hash = digest(p_token, 'sha256')
     and revoked_at is null
     and expires_at > now()
   limit 1;

  if v_share.id is null then
    return jsonb_build_object('found', false);
  end if;

  -- Only parts that may reach analytics are shared (hard rule 3): an unsure part the student has
  -- not checked is withheld, and so is the total when any part is withheld.
  if v_share.resource_type = 'paper' then
    select jsonb_build_object(
      'found', true,
      'kind', 'paper',
      'expires_at', v_share.expires_at,
      'paper', jsonb_build_object(
        'type', p.type,
        'tier', p.tier,
        'date_taken', p.date_taken,
        'exam_date', p.exam_date,
        'subject', p.subject,
        'total_awarded', case when totals.withheld = 0 then totals.total_awarded end,
        'total_available', case when totals.withheld = 0 then totals.total_available end,
        'reconciled', p.reconciled
      ),
      'withheld_parts', totals.withheld,
      'questions', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'question_label', a.question_label,
            'question_text', a.question_text,
            'student_answer', a.student_answer,
            'marks_awarded', a.marks_awarded,
            'max_marks', a.max_marks,
            'marks_source', a.marks_source,
            'teacher_remark', a.teacher_remark,
            'extraction_confidence', a.extraction_confidence,
            'feedback', case when loss.id is null then null else jsonb_build_object(
              'cause', loss.cause,
              'marks_lost', loss.marks_lost,
              'explanation', loss.ai_explanation,
              'do_this_next', loss.do_this_next,
              'command_word', loss.command_word,
              'command_word_note', loss.command_word_note,
              'loss_reasons', private.share_loss_reasons(loss.loss_reasons),
              'corrected_answer',
                case
                  when loss.model_answer is not null
                   and loss.grounding_status = 'complete'
                   and loss.model_answer_source is not null
                   and coalesce(cardinality(loss.unresolved_parts), 0) = 0
                    then loss.model_answer
                  else null
                end,
              'corrected_answer_state',
                case
                  when loss.model_answer is not null
                   and loss.grounding_status = 'complete'
                   and loss.model_answer_source is not null
                   and coalesce(cardinality(loss.unresolved_parts), 0) = 0
                    then 'available'
                  when loss.grounding_status <> 'complete'
                    or loss.model_answer_source is null
                    or coalesce(cardinality(loss.unresolved_parts), 0) > 0
                    then 'withheld'
                  else 'unavailable'
                end
            ) end
          )
          order by coalesce(qr.order_index, 32767), a.question_label nulls last, a.id
        )
        from public.student_attempt a
        left join lateral (
          select min(q.order_index) as order_index
            from public.question_region q
           where q.committed_attempt_id = a.id
        ) qr on true
        left join lateral (
          select m.*
            from public.mark_loss_event m
           where m.attempt_id = a.id
             and m.student_id = a.student_id
             and m.student_rejected_at is null
           order by m.created_at desc, m.id
           limit 1
        ) loss on true
        where a.paper_id = v_share.paper_id
          and a.student_id = v_share.student_id
          and (a.extraction_confidence <> 'unsure' or a.student_confirmed_at is not null)
      ), '[]'::jsonb)
    )
    into v_result
    from public.paper p
    left join lateral (
      select sum(a.marks_awarded) as total_awarded,
             sum(a.max_marks) as total_available,
             count(*) filter (where a.extraction_confidence = 'unsure' and a.student_confirmed_at is null) as withheld
        from public.student_attempt a
       where a.paper_id = p.id
         and a.student_id = p.student_id
    ) totals on true
    where p.id = v_share.paper_id
      and p.student_id = v_share.student_id;
  else
    select case
      when a.extraction_confidence = 'unsure' and a.student_confirmed_at is null then jsonb_build_object(
        'found', true,
        'kind', 'question',
        'withheld', true,
        'expires_at', v_share.expires_at,
        'paper', jsonb_build_object(
          'type', p.type,
          'tier', p.tier,
          'date_taken', p.date_taken,
        'exam_date', p.exam_date,
          'subject', p.subject
        )
      )
      else jsonb_build_object(
      'found', true,
      'kind', 'question',
      'expires_at', v_share.expires_at,
      'paper', jsonb_build_object(
        'type', p.type,
        'tier', p.tier,
        'date_taken', p.date_taken,
        'exam_date', p.exam_date,
        'subject', p.subject
      ),
      'question', jsonb_build_object(
        'question_label', a.question_label,
        'question_text', a.question_text,
        'student_answer', a.student_answer,
        'marks_awarded', a.marks_awarded,
        'max_marks', a.max_marks,
        'marks_source', a.marks_source,
        'teacher_remark', a.teacher_remark,
        'extraction_confidence', a.extraction_confidence,
        'feedback', case when loss.id is null then null else jsonb_build_object(
          'cause', loss.cause,
          'marks_lost', loss.marks_lost,
          'explanation', loss.ai_explanation,
          'do_this_next', loss.do_this_next,
          'command_word', loss.command_word,
          'command_word_note', loss.command_word_note,
          'loss_reasons', private.share_loss_reasons(loss.loss_reasons),
          'corrected_answer',
            case
              when loss.model_answer is not null
               and loss.grounding_status = 'complete'
               and loss.model_answer_source is not null
               and coalesce(cardinality(loss.unresolved_parts), 0) = 0
                then loss.model_answer
              else null
            end,
          'corrected_answer_state',
            case
              when loss.model_answer is not null
               and loss.grounding_status = 'complete'
               and loss.model_answer_source is not null
               and coalesce(cardinality(loss.unresolved_parts), 0) = 0
                then 'available'
              when loss.grounding_status <> 'complete'
                or loss.model_answer_source is null
                or coalesce(cardinality(loss.unresolved_parts), 0) > 0
                then 'withheld'
              else 'unavailable'
            end
        ) end
      )
    ) end
    into v_result
    from public.student_attempt a
    join public.paper p
      on p.id = a.paper_id and p.student_id = a.student_id
    left join lateral (
      select m.*
        from public.mark_loss_event m
       where m.attempt_id = a.id
         and m.student_id = a.student_id
         and m.student_rejected_at is null
       order by m.created_at desc, m.id
       limit 1
    ) loss on true
    where a.id = v_share.attempt_id
      and a.paper_id = v_share.paper_id
      and a.student_id = v_share.student_id;
  end if;

  return coalesce(v_result, jsonb_build_object('found', false));
end;
$function$;

revoke all on function public.resolve_academic_share(text) from public;
grant execute on function public.resolve_academic_share(text) to anon, authenticated;
