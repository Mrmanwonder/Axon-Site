-- ============================================================================
-- AXO-54 · least privilege for private SECURITY DEFINER functions
-- ============================================================================
-- Live audit 2026-10-01: 18 SECURITY DEFINER functions in `private` carried the
-- default PUBLIC EXECUTE grant, so `anon` held EXECUTE on, for example,
-- private.guardian_is_pro(p_guardian) and private.consent_is_granted(p_guardian,
-- p_student, p_purpose) — functions that answer questions about a caller-chosen
-- account. They are not reachable today: PostgREST exposes only public and
-- graphql_public (verified: PGRST106 for Content-Profile: private), and anon has
-- no USAGE on `private`. Both are configuration, not a property of the function.
-- This migration makes the function grants themselves least-privilege.
--
--   * Trigger functions: no client role needs EXECUTE. Postgres checks it when
--     the trigger is created, not when it fires.
--   * Everything else in private: EXECUTE for authenticated (RLS policies and
--     SECURITY INVOKER facades evaluate them as the caller) and service_role.
--     Never PUBLIC, never anon.
--
-- Idempotent; touches grants only.
-- ============================================================================

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.prorettype = 'trigger'::regtype as is_trigger
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.is_trigger then
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
  end loop;
end $$;

-- The non-trigger functions that were PUBLIC-only need an explicit grant now
-- that PUBLIC is gone. Listed by name so a reviewer can see exactly what keeps
-- authenticated access, and why.
grant execute on function private.all_required_consents_granted(uuid, uuid) to authenticated, service_role; -- consent gate in RLS
grant execute on function private.consent_is_granted(uuid, uuid, text)      to authenticated, service_role; -- consent gate in RLS
grant execute on function private.current_guardian_id()                     to authenticated, service_role; -- RLS subject
grant execute on function private.guardian_is_pro(uuid)                     to authenticated, service_role; -- Pro depth in RLS
grant execute on function private.owns_storage_student_prefix(text)         to authenticated, service_role; -- storage.objects RLS

-- Service-only tables. RLS is on with no policy (deny-all to clients), but the
-- default public-schema grants still gave anon/authenticated full table
-- privileges, so a single `disable row level security` would expose
-- model_call.student_id/error_detail, Stripe payloads and the deletion queue.
-- Only the Workers (service_role) and postgres touch these.
revoke all on table public.model_call, public.model_route, public.eval_run, public.eval_result,
                    public.r2_deletion, public.stripe_event
  from anon, authenticated;
