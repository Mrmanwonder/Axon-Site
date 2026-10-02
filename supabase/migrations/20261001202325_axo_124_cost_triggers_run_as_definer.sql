-- AXO-124 hotfix: the cost triggers on model_call must not depend on the caller's privileges.
--
-- The three functions were SECURITY INVOKER. The pipeline workers insert model_call rows as
-- service_role, which has no USAGE on schema private, so every insert failed with
-- "permission denied for schema private" and the worker only logged the error: model_call stopped
-- recording from the moment the triggers were applied. The earlier SQL tests ran as the owner and
-- could not see it; supabase/tests/axo_124_model_cost.sql now inserts as service_role.
--
-- Definer functions with an empty search_path read model_price / fx_rate and update the run's cost
-- on behalf of the insert. They are still not callable by clients (execute revoked).

alter function private.model_call_cost_usd(text, text, integer, integer, integer, timestamptz) security definer;
alter function private.model_call_price() security definer;
alter function private.model_call_rollup_cost() security definer;

alter function private.model_call_cost_usd(text, text, integer, integer, integer, timestamptz) set search_path = '';
alter function private.model_call_price() set search_path = '';
alter function private.model_call_rollup_cost() set search_path = '';
