-- ============================================================================
-- One SELECT policy for pattern_insight
-- ============================================================================
-- Supabase's performance advisor flags multiple permissive policies for the
-- same role/action because PostgreSQL evaluates every permissive policy that
-- can apply. The two existing policies are mutually exclusive by scope, so they
-- can be expressed as one equivalent predicate without changing entitlement or
-- ownership semantics.
-- ============================================================================

drop policy if exists pattern_insight_select_single_subject on public.pattern_insight;
drop policy if exists pattern_insight_select_cross_subject on public.pattern_insight;

create policy pattern_insight_select_own on public.pattern_insight
for select to authenticated
using (
  exists (
    select 1
    from public.student s
    where s.id = pattern_insight.student_id
      and s.guardian_id = private.current_guardian_id()
  )
  and (
    scope = 'single_subject'
    or (
      scope = 'cross_subject'
      and private.guardian_is_pro(private.current_guardian_id())
    )
  )
);

comment on policy pattern_insight_select_own on public.pattern_insight is
  'Owners can read single-subject insights on every tier; cross-subject insights additionally require Pro. Combined into one permissive SELECT policy for lower RLS evaluation overhead.';
