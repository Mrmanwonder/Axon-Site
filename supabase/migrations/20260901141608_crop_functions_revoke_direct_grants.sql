-- The previous migration revoked EXECUTE from PUBLIC on both new functions and
-- the advisor still reported them as callable by anon and authenticated. The
-- reason is the exact mirror image of the mistake corrected on 2026-08-31.
--
-- That time, revoking from anon and authenticated by name was the no-op:
-- Postgres grants EXECUTE to PUBLIC on creation and both roles inherit through
-- it, so only the PUBLIC revoke did anything.
--
-- This project also runs ALTER DEFAULT PRIVILEGES on the public schema
-- (20260826074500_public_schema_default_grants.sql), which grants EXECUTE to
-- anon and authenticated *directly* on every new function. So a new function
-- gets both: the PUBLIC grant and two direct ones. Revoking either alone leaves
-- the other standing.
--
-- The rule, written down so it does not have to be rediscovered a third time:
-- revoke from PUBLIC **and** from anon and authenticated by name. Confirmed by
-- reading pg_proc.proacl afterwards rather than by re-reading the migration —
-- the ACL is the only thing that actually answers the question.
revoke execute on function public.advance_after_crop(uuid) from public, anon, authenticated;
revoke execute on function public.apply_region_crops(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.advance_after_crop(uuid) to service_role;
grant execute on function public.apply_region_crops(uuid, jsonb) to service_role;
