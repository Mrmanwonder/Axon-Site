-- AXO-108 — evaluate Student Mode / Pro read authority once per statement.
--
-- High-volume Library search exposed a read-path hot loop: SELECT RLS invoked
-- SECURITY DEFINER authority helpers once per candidate row. PostgreSQL can
-- cache an uncorrelated scalar subquery as an initplan, so expose the same
-- validated active student / current Pro facts as private no-argument helpers
-- and use them only in the hot read policies.
--
-- Write/destructive policies intentionally keep their existing authority
-- expressions in this migration.

create or replace function private.current_student_scope_id()
returns uuid
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select scope.student_id
    from private.student_scope_session scope
    join public.student s
      on s.id = scope.student_id
     and s.guardian_id = scope.guardian_id
   where scope.guardian_id = private.current_guardian_id()
     and scope.auth_session_id = private.current_auth_session_id()
     and scope.revoked_at is null
     and scope.expires_at > now()
     and s.deleted_at is null
   limit 1;
$$;

revoke all on function private.current_student_scope_id() from public, anon;
grant execute on function private.current_student_scope_id() to authenticated;

comment on function private.current_student_scope_id() is
  'AXO-108. Returns the one live Student Mode student for the signed guardian/auth session. Private RLS helper; use through an uncorrelated SELECT initplan on hot read paths.';

create or replace function private.current_guardian_is_pro()
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce((
    select g.subscription_status in ('pro', 'pro_annual')
      from public.guardian g
     where g.id = private.current_guardian_id()
  ), false);
$$;

revoke all on function private.current_guardian_is_pro() from public, anon;
grant execute on function private.current_guardian_is_pro() to authenticated;

comment on function private.current_guardian_is_pro() is
  'AXO-108. Current signed guardian Pro entitlement as a private RLS initplan helper.';

-- Library paper browsing: same Student Mode meaning, evaluated once.
drop policy if exists paper_select_scope on public.paper;
create policy paper_select_scope on public.paper
  for select to authenticated
  using (student_id = (select private.current_student_scope_id()));

-- Attempt text search is the largest read set. Scope and Pro entitlement become
-- statement constants; free archive depth stays row-dependent exactly as before.
drop policy if exists attempt_select_scope on public.student_attempt;
create policy attempt_select_scope on public.student_attempt
  for select to authenticated
  using (student_id = (select private.current_student_scope_id()));

drop policy if exists attempt_archive_depth_gate on public.student_attempt;
create policy attempt_archive_depth_gate on public.student_attempt
  as restrictive
  for select to authenticated
  using (
    (select private.current_guardian_is_pro())
    or exists (
      select 1
        from public.paper p
       where p.id = student_attempt.paper_id
         and private.in_free_archive_window(p.date_taken)
    )
  );
