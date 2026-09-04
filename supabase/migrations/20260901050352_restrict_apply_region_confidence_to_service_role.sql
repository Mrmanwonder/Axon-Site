-- Fixes a real gap introduced in the apply_region_confidence_rpc migration
-- earlier in this same branch: it's SECURITY DEFINER and, unlike every
-- other worker-only RPC (claim_deletions, finish_deletion, run_advance,
-- run_heartbeat), was left executable by anon and authenticated by default
-- — confirmed via get_advisors (security), which flagged it within minutes
-- of being created. anon/authenticated could otherwise have called
-- /rest/v1/rpc/apply_region_confidence directly and rewritten any
-- question_region's confidence_tier, bypassing RLS. This is worker-only,
-- called solely from workers/reconcile/src/index.ts's service-role client.
revoke execute on function public.apply_region_confidence(jsonb) from anon;
revoke execute on function public.apply_region_confidence(jsonb) from authenticated;
