-- ============================================================================
-- AXO-95 / AXO-98 / AXO-99 — authenticated academic actions + useful shares
-- ============================================================================
-- The Axon account is guardian-owned. Paper/question Share and Delete already
-- require an authenticated guardian and exact resource ownership. Requiring a
-- second "Parent Mode" ceremony for those four actions duplicated the account
-- boundary without adding a different principal.
--
-- This migration removes ONLY that freshness check. Consent changes, billing,
-- account erasure and every other Parent Mode boundary are deliberately
-- untouched.
--
-- It also expands the anonymous bearer-capability resolver with the same
-- student-facing learning feedback already saved on the selected question.
-- Account/contact data, internal ids, page assets and rejected diagnoses remain
-- excluded.
-- ============================================================================

-- ── destructive row policies: ownership stays, auth freshness does not ─────

drop policy if exists paper_delete_own on public.paper;
create policy paper_delete_own on public.paper for delete to authenticated
  using (exists (
    select 1
      from public.student s
     where s.id = paper.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

comment on policy paper_delete_own on public.paper is
  'AXO-98. Paper deletion requires the authenticated owning guardian. No redundant Parent Mode re-authentication is required.';

drop policy if exists attempt_delete_own on public.student_attempt;
create policy attempt_delete_own on public.student_attempt for delete to authenticated
  using (exists (
    select 1
      from public.student s
     where s.id = student_attempt.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

drop policy if exists question_region_delete_own on public.question_region;
create policy question_region_delete_own on public.question_region for delete to authenticated
  using (exists (
    select 1
      from public.student s
     where s.id = question_region.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

comment on policy attempt_delete_own on public.student_attempt is
  'AXO-98 defence in depth. Direct browser DELETE remains revoked; an owning authenticated guardian is the destructive authority.';
comment on policy question_region_delete_own on public.question_region is
  'AXO-98 defence in depth. Direct browser DELETE remains revoked; an owning authenticated guardian is the destructive authority.';

-- ── question deletion privileged body ──────────────────────────────────────
-- The public facade remains SECURITY INVOKER. This private SECURITY DEFINER
-- body still proves the caller maps to the guardian who owns the attempt before
-- bypassing archive-depth RLS for erasure.

create or replace function private.delete_question(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_student  uuid;
  v_paper    uuid;
  v_regions        integer := 0;
  v_deleted        integer := 0;
  v_total_awarded  numeric(6,2);
  v_total_available numeric(6,2);
begin
  if v_guardian is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select a.student_id, a.paper_id
    into v_student, v_paper
    from public.student_attempt a
    join public.student s on s.id = a.student_id
   where a.id = p_attempt_id
     and s.guardian_id = v_guardian;

  if v_student is null then
    raise exception 'no such question' using errcode = 'P0002';
  end if;

  delete from public.question_region
   where committed_attempt_id = p_attempt_id
     and student_id = v_student
     and paper_id = v_paper;
  get diagnostics v_regions = row_count;

  delete from public.student_attempt
   where id = p_attempt_id
     and student_id = v_student
     and paper_id = v_paper;
  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'question deletion did not affect exactly one attempt'
      using errcode = 'P0001';
  end if;

  select sum(a.marks_awarded), sum(a.max_marks)
    into v_total_awarded, v_total_available
    from public.student_attempt a
   where a.paper_id = v_paper
     and a.student_id = v_student;

  update public.paper p
     set total_awarded = v_total_awarded,
         total_available = v_total_available,
         reconciled = case
           when v_total_awarded is null or p.reported_total is null then null
           else v_total_awarded = p.reported_total
         end
   where p.id = v_paper
     and p.student_id = v_student;

  return jsonb_build_object(
    'deleted', true,
    'attempt_id', p_attempt_id,
    'paper_id', v_paper,
    'regions_deleted', v_regions,
    'total_awarded', v_total_awarded,
    'total_available', v_total_available
  );
end;
$$;

revoke all on function private.delete_question(uuid) from public, anon;
grant execute on function private.delete_question(uuid) to authenticated;

-- ── share create/revoke privileged bodies ──────────────────────────────────

create or replace function private.create_academic_share(
  p_resource_type text,
  p_resource_id uuid,
  p_expires_minutes integer default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_student  uuid;
  v_paper    uuid;
  v_attempt  uuid;
  v_token    text;
  v_share    uuid;
  v_expires  timestamptz;
begin
  if v_guardian is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_resource_type not in ('paper', 'question') then
    raise exception 'unknown share resource' using errcode = '22023';
  end if;
  if p_expires_minutes < 5 or p_expires_minutes > 10080 then
    raise exception 'share expiry must be between 5 minutes and 7 days'
      using errcode = '22023';
  end if;

  if p_resource_type = 'paper' then
    select p.student_id, p.id
      into v_student, v_paper
      from public.paper p
      join public.student s on s.id = p.student_id
     where p.id = p_resource_id
       and s.guardian_id = v_guardian;
  else
    select a.student_id, a.paper_id, a.id
      into v_student, v_paper, v_attempt
      from public.student_attempt a
      join public.student s on s.id = a.student_id
     where a.id = p_resource_id
       and s.guardian_id = v_guardian;
  end if;

  if v_student is null or v_paper is null then
    raise exception 'no such resource' using errcode = 'P0002';
  end if;

  update private.academic_share
     set revoked_at = now()
   where guardian_id = v_guardian
     and resource_type = p_resource_type
     and paper_id = v_paper
     and (
       (p_resource_type = 'paper' and attempt_id is null)
       or
       (p_resource_type = 'question' and attempt_id = v_attempt)
     )
     and revoked_at is null;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(mins => p_expires_minutes);

  insert into private.academic_share (
    guardian_id, student_id, resource_type, paper_id, attempt_id,
    token_hash, expires_at
  ) values (
    v_guardian, v_student, p_resource_type, v_paper, v_attempt,
    digest(v_token, 'sha256'), v_expires
  )
  returning id into v_share;

  return jsonb_build_object(
    'share_id', v_share,
    'resource_type', p_resource_type,
    'token', v_token,
    'expires_at', v_expires
  );
end;
$$;

create or replace function private.revoke_academic_share(p_share_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_count integer;
begin
  if v_guardian is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update private.academic_share
     set revoked_at = coalesce(revoked_at, now())
   where id = p_share_id
     and guardian_id = v_guardian;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function private.create_academic_share(text, uuid, integer) from public, anon;
revoke all on function private.revoke_academic_share(uuid) from public, anon;
grant execute on function private.create_academic_share(text, uuid, integer) to authenticated;
grant execute on function private.revoke_academic_share(uuid) to authenticated;

comment on function public.create_academic_share(text, uuid, integer) is
  'AXO-98 public SECURITY INVOKER facade. Authenticated guardian ownership is enforced by the private body; no redundant Parent Mode re-authentication.';
comment on function public.revoke_academic_share(uuid) is
  'AXO-98 public SECURITY INVOKER facade. Only the authenticated guardian who owns the share can revoke it.';

-- ── public share resolver ───────────────────────────────────────────────────
-- One accepted mark-loss row is included per question. A student-rejected
-- diagnosis is never shared. Corrected working is emitted only when the same
-- grounding contract used by the authenticated UI says it is safe to show.

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
              'loss_reasons', coalesce(loss.loss_reasons, '[]'::jsonb),
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
          'loss_reasons', coalesce(loss.loss_reasons, '[]'::jsonb),
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
  'AXO-99 public capability resolver. Returns the selected academic snapshot plus accepted safe learning feedback; excludes account/contact data, ids, assets, rejected diagnoses and ungrounded corrected working.';
