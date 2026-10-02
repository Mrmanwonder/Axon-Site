-- AXO-105: the anonymous share resolver must never serialize anything it has not
-- explicitly chosen. Until now it copied mark_loss_event.loss_reasons (jsonb) into
-- the public payload wholesale, so any key a future pipeline version adds to a
-- reason (provider traces, prompt fragments, mark_type scheme notation, internal
-- ids) would have been published to whoever holds a share link.
--
-- private.share_loss_reasons() is the allowlist: exactly error_type, marks,
-- cause, note, each only if it has the expected JSON type, in original order.
-- mark_type is deliberately NOT shared: it is scheme vocabulary (hard rule 2),
-- is null on every Tier 1 row, and the recipient view never renders it.
-- The two resolver branches (paper and question) both call it.

create or replace function private.share_loss_reasons(p_reasons jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'error_type', case when jsonb_typeof(r->'error_type') = 'string' then r->'error_type' end,
      'marks',      case when jsonb_typeof(r->'marks')      = 'number' then r->'marks'      end,
      'cause',      case when jsonb_typeof(r->'cause')      = 'string' then r->'cause'      end,
      'note',       case when jsonb_typeof(r->'note')       = 'string' then r->'note'       end
    ) order by ord
  ), '[]'::jsonb)
  from jsonb_array_elements(
         case when jsonb_typeof(p_reasons) = 'array' then p_reasons else '[]'::jsonb end
       ) with ordinality as t(r, ord)
  where jsonb_typeof(r) = 'object';
$$;

revoke all on function private.share_loss_reasons(jsonb) from public;

comment on function private.share_loss_reasons(jsonb) is
  'Allowlist projection of mark_loss_event.loss_reasons for the anonymous share resolver: error_type, marks, cause, note only.';

create or replace function public.resolve_academic_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
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

  if v_share.resource_type = 'paper' then
    select jsonb_build_object(
      'found', true,
      'kind', 'paper',
      'expires_at', v_share.expires_at,
      'paper', jsonb_build_object(
        'type', p.type,
        'tier', p.tier,
        'date_taken', p.date_taken,
        'subject', p.subject,
        'total_awarded', totals.total_awarded,
        'total_available', totals.total_available,
        'reconciled', p.reconciled
      ),
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
      ), '[]'::jsonb)
    )
    into v_result
    from public.paper p
    left join lateral (
      select sum(a.marks_awarded) as total_awarded,
             sum(a.max_marks) as total_available
        from public.student_attempt a
       where a.paper_id = p.id
         and a.student_id = p.student_id
    ) totals on true
    where p.id = v_share.paper_id
      and p.student_id = v_share.student_id;
  else
    select jsonb_build_object(
      'found', true,
      'kind', 'question',
      'expires_at', v_share.expires_at,
      'paper', jsonb_build_object(
        'type', p.type,
        'tier', p.tier,
        'date_taken', p.date_taken,
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
    )
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
$$;

revoke all on function public.resolve_academic_share(text) from public;
grant execute on function public.resolve_academic_share(text) to anon, authenticated;

comment on function public.resolve_academic_share(text) is
  'AXO-99 public capability resolver. Returns the selected academic snapshot plus accepted safe learning feedback; excludes account/contact data, ids, assets, rejected diagnoses and ungrounded corrected working. AXO-105: loss_reasons pass through private.share_loss_reasons() (field allowlist).';
