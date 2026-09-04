-- The previous migration revoked from anon/authenticated directly, but
-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default on function
-- creation, and anon/authenticated inherit through it — so that revoke was
-- a no-op (confirmed: has_function_privilege for anon/authenticated was
-- still true afterward). claim_deletions and friends are correctly locked
-- down because whatever created them explicitly revoked from PUBLIC. Doing
-- the same here.
revoke execute on function public.apply_region_confidence(jsonb) from public;
grant execute on function public.apply_region_confidence(jsonb) to service_role;
