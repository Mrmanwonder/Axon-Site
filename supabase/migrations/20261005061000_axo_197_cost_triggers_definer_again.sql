-- AXO-197: production drifted back to SECURITY INVOKER on the model_call cost triggers.
--
-- 20261001202325 made these three functions SECURITY DEFINER because the workers insert
-- model_call rows as service_role, which cannot execute private.model_call_cost_usd. On
-- 5 Oct 2026 production showed prosecdef = false for all three, while no migration in this
-- repo reverts them. An insert as service_role failed with "permission denied for function
-- model_call_cost_usd", so model_call recorded nothing after 3 Oct 15:46 UTC. The workers
-- only log the failed insert, so the pipeline kept running without cost or failure records.
--
-- Same statements as 20261001202325. They are idempotent and restore what the repo says.
-- Execute stays revoked from clients.

alter function private.model_call_cost_usd(text, text, integer, integer, integer, timestamptz) security definer;
alter function private.model_call_price() security definer;
alter function private.model_call_rollup_cost() security definer;

alter function private.model_call_cost_usd(text, text, integer, integer, integer, timestamptz) set search_path = '';
alter function private.model_call_price() set search_path = '';
alter function private.model_call_rollup_cost() set search_path = '';

revoke all on function private.model_call_cost_usd(text, text, integer, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function private.model_call_price() from public, anon, authenticated;
revoke all on function private.model_call_rollup_cost() from public, anon, authenticated;
