-- ============================================================================
-- AXO-87 / AXO-88 — Paper and question deletion actions
-- ============================================================================
-- Paper deletion already exists through public.delete_paper(uuid) and the
-- paper DELETE policy already requires Parent Mode. This migration gives the
-- same "a parent is present now" boundary to individual-question deletion and
-- provides one atomic RPC for the UI.
--
-- A saved question is represented by:
--   · one public.student_attempt row (the committed student-facing record)
--   · one public.question_region row whose committed_attempt_id points at it
--   · mark_loss_event / attempt_concept children under the attempt
--   · optional question-region crop objects, deleted by the existing R2 trigger
--
-- The RPC deletes the region first so its crop-key deletion trigger still has
-- the provenance row available, then deletes the attempt so all attempt
-- children cascade. Nothing is soft-deleted and no client has to remember the
-- cleanup order.
-- ============================================================================

-- ── student_attempt: split FOR ALL so DELETE can carry Parent Mode ──────────

drop policy if exists attempt_all_own on public.student_attempt;
drop policy if exists attempt_select_own on public.student_attempt;
drop policy if exists attempt_insert_own on public.student_attempt;
drop policy if exists attempt_update_own on public.student_attempt;
drop policy if exists attempt_delete_own on public.student_attempt;

create policy attempt_select_own on public.student_attempt for select to authenticated
  using (exists (
    select 1 from public.student s
     where s.id = student_attempt.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

create policy attempt_insert_own on public.student_attempt for insert to authenticated
  with check (exists (
    select 1 from public.student s
     where s.id = student_attempt.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

create policy attempt_update_own on public.student_attempt for update to authenticated
  using (exists (
    select 1 from public.student s
     where s.id = student_attempt.student_id
       and s.guardian_id = private.current_guardian_id()
  ))
  with check (exists (
    select 1 from public.student s
     where s.id = student_attempt.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

create policy attempt_delete_own on public.student_attempt for delete to authenticated
  using (
    exists (
      select 1 from public.student s
       where s.id = student_attempt.student_id
         and s.guardian_id = private.current_guardian_id()
    )
    and private.has_fresh_auth()
  );

comment on policy attempt_delete_own on public.student_attempt is
  'AXO-87. Removing one committed question is a Parent Mode action. Reads and review-time updates stay available to the student; DELETE requires fresh guardian auth.';

-- ── question_region: the provenance/crop row is destructive too ────────────

drop policy if exists question_region_all_own on public.question_region;
drop policy if exists question_region_select_own on public.question_region;
drop policy if exists question_region_insert_own on public.question_region;
drop policy if exists question_region_update_own on public.question_region;
drop policy if exists question_region_delete_own on public.question_region;

create policy question_region_select_own on public.question_region for select to authenticated
  using (exists (
    select 1 from public.student s
     where s.id = question_region.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

create policy question_region_insert_own on public.question_region for insert to authenticated
  with check (exists (
    select 1 from public.student s
     where s.id = question_region.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

create policy question_region_update_own on public.question_region for update to authenticated
  using (exists (
    select 1 from public.student s
     where s.id = question_region.student_id
       and s.guardian_id = private.current_guardian_id()
  ))
  with check (exists (
    select 1 from public.student s
     where s.id = question_region.student_id
       and s.guardian_id = private.current_guardian_id()
  ));

create policy question_region_delete_own on public.question_region for delete to authenticated
  using (
    exists (
      select 1 from public.student s
       where s.id = question_region.student_id
         and s.guardian_id = private.current_guardian_id()
    )
    and private.has_fresh_auth()
  );

comment on policy question_region_delete_own on public.question_region is
  'AXO-87. A committed question''s provenance/crop row may be removed only while Parent Mode is fresh.';

-- The browser has no legitimate reason to delete either half independently.
-- Keep the RLS policies as defence-in-depth if a future server role receives
-- table DELETE, but remove the Data API capability from normal browser roles.
revoke delete on public.student_attempt from public, anon, authenticated;
revoke delete on public.question_region from public, anon, authenticated;

-- ── one atomic student-facing operation ────────────────────────────────────
-- SECURITY DEFINER is deliberate here. A Free account can still have old paper
-- data outside its archive-read entitlement, and deletion must remain possible
-- even when a SELECT-only archive policy hides that content. The function
-- therefore bypasses RLS only after doing BOTH checks itself:
--   1. the attempt belongs to the current guardian;
--   2. Parent Mode is fresh.
--
-- Direct browser table DELETE is revoked above. The policies remain
-- defence-in-depth for any future server role that is deliberately granted
-- DELETE; this RPC is the only client-facing destructive path.

create or replace function public.delete_question(p_attempt_id uuid)
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

  if not private.has_fresh_auth() then
    raise exception 'this needs a parent to confirm it is them'
      using errcode = '42501', hint = 'parent_mode_required';
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

  -- The existing question_region_object_deletion trigger queues crop objects
  -- before the row disappears. Restrict to the exact owned paper/student as a
  -- second invariant even though committed_attempt_id is unique by meaning.
  delete from public.question_region
   where committed_attempt_id = p_attempt_id
     and student_id = v_student
     and paper_id = v_paper;
  get diagnostics v_regions = row_count;

  -- mark_loss_event and attempt_concept are children of student_attempt and
  -- follow their existing ON DELETE behavior.
  delete from public.student_attempt
   where id = p_attempt_id
     and student_id = v_student
     and paper_id = v_paper;
  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'question deletion did not affect exactly one attempt'
      using errcode = 'P0001';
  end if;

  -- The paper summary is derived from the committed questions. Home, Library,
  -- Insights and the public share view all read these columns, so leaving the
  -- pre-delete aggregate behind would keep deleted work in trends and totals.
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

revoke all on function public.delete_question(uuid) from public, anon;
grant execute on function public.delete_question(uuid) to authenticated;

comment on function public.delete_question(uuid) is
  'AXO-87. Permanently removes one committed question and its provenance subtree. Requires ownership and fresh Parent Mode; queues any question crop objects through existing deletion triggers.';
