-- ============================================================================
-- Fast authenticated bootstrap
-- ============================================================================
-- App startup previously performed three serial Data API reads after restoring
-- the local Supabase session: guardian -> oldest student -> student subjects.
-- The database work is tiny, but three browser-to-region round trips dominate
-- the perceived cold-start latency. This read-only RPC returns the exact same
-- rows in one request while keeping RLS as the authority.
--
-- SECURITY INVARIANT:
--   SECURITY INVOKER is deliberate. The function must not bypass guardian,
--   student or student_subject RLS. A caller sees exactly what the existing
--   direct SELECTs would have allowed, merely in one statement.
-- ============================================================================

create or replace function public.bootstrap_current_user()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with current_guardian as (
    select g.*
    from public.guardian g
    where g.auth_user_id = (select auth.uid())
    limit 1
  ),
  current_student as (
    select s.*
    from public.student s
    join current_guardian g on g.id = s.guardian_id
    order by s.created_at asc
    limit 1
  ),
  current_subjects as (
    select coalesce(jsonb_agg(ss.subject order by ss.subject), '[]'::jsonb) as subjects
    from public.student_subject ss
    join current_student s on s.id = ss.student_id
  )
  select jsonb_build_object(
    'guardian', (select to_jsonb(g) from current_guardian g),
    'student', (
      select to_jsonb(s) || jsonb_build_object(
        'subjects', (select subjects from current_subjects)
      )
      from current_student s
    )
  );
$$;

revoke all on function public.bootstrap_current_user() from public;
grant execute on function public.bootstrap_current_user() to authenticated;

comment on function public.bootstrap_current_user() is
  'RLS-preserving one-round-trip app bootstrap: current guardian, oldest student, and that student''s subjects.';
