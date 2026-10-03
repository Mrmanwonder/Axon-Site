-- AXO-128 REGION RETENTION POLICY PROPOSAL ONLY. UNEXECUTED.
-- This is not a migration and must not be applied directly to production.
-- Create a NEW CLI-generated migration only after reviewing the policy below.
--
-- Verified classification (2026-10-03): all156 model_call.region_id values absent
-- from question_region identify synthetic eval_case rows instead, and run_id
-- identifies eval_run. They have null paper_id/student_id. DO NOT clean them up.
-- Backend shared/src/eval/explain-run.ts explicitly defines this mapping.
-- Genuine/unclassified missing-region refs after this exclusion: ZERO today.
--
-- Owner policy choices:
-- A. Fully unlink student_id/paper_id/run_id on single-question erasure too.
--    This extends the paper/account erasure policy to a still-live paper/run.
--    It removes the model-call-to-run join and breaks reconstruction of a live
--    run's cost from its calls; first design separate privacy-safe cost facts.
--    NOT implemented by this proposal.
-- B. Minimise the erased region's refs/content while keeping the still-owned
--    paper/run/student links until paper/account deletion. Those later delete
--    paths already fully anonymise the rows. This retains per-run accounting.
--    Implemented below AS REVIEW MATERIAL, not a chosen live policy.
-- Both policies must keep tokens/cost/latency/model/prompt facts unchanged.
--
-- Current cost triggers are BEFORE INSERT and AFTER INSERT only; updates do not
-- reprice or reroll cost. The B proposal retains run_id and cost_usd, so both
-- persisted cost and SUM(model_call.cost_usd WHERE run_id=...) stay unchanged.
-- No fake question/student/attempt is introduced and no model marks are changed.
--
-- The guard deliberately blocks direct application. A reviewed forward migration
-- copies only the selected SQL section below, via the standard release process.
do $$ begin
  raise exception 'review proposal only: choose region retention policy and create a new migration';
end $$;

-- BEGIN PROPOSED POLICY B SQL
create or replace function private.minimise_on_region_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.model_call mc
     set region_id = null,
         image_keys = '{}', error_detail = null,
         tool_calls = '[]'::jsonb, verification_failures = '[]'::jsonb
   where mc.region_id = old.id
     -- Require real extraction ownership context as well as the region id.
     -- This protects the deliberately overloaded eval-case/run namespace.
     and (mc.paper_id = old.paper_id
          or mc.student_id = old.student_id
          or mc.run_id = old.run_id)
     and not (
       mc.paper_id is null and mc.student_id is null
       and exists (
         select 1
           from public.eval_run er
           join public.eval_case ec on ec.id = mc.region_id
          where er.id = mc.run_id and ec.source = 'synthetic'
       )
     );
  return old;
end; $$;
revoke all on function private.minimise_on_region_delete()
  from public, anon, authenticated, service_role;

create trigger question_region_minimise_telemetry
  before delete on public.question_region
  for each row execute function private.minimise_on_region_delete();
-- END PROPOSED POLICY B SQL

-- OPTIONAL REVIEWED BACKFILL, NOT automatically included in the proposal.
-- Current eligible row count is ZERO. Keep this as a classification query until
-- a reviewed forward migration and policy exist; do not blindly UPDATE156 rows.
select count(*) as genuinely_stale_region_calls_with_live_owner_run
  from public.model_call mc
 where mc.region_id is not null
   and not exists (select 1 from public.question_region q where q.id = mc.region_id)
   and exists (
     select 1 from public.extraction_run r
      where r.id = mc.run_id
        and (r.paper_id = mc.paper_id or r.student_id = mc.student_id)
   )
   and not (
     mc.paper_id is null and mc.student_id is null
     and exists (select 1 from public.eval_run er
                 join public.eval_case ec on ec.id = mc.region_id
                 where er.id = mc.run_id and ec.source = 'synthetic')
   );

-- Required LOCAL disposable regression before the selected forward migration:
-- 1. Two real regions in one live run, with synthetic local model_call rows.
--    Delete one region; only its region/content refs clear, tokens/cost remain.
--    The other region/account rows and teacher marks remain unchanged.
-- 2. Repeat via existing authenticated delete_question ownership path using a
--    synthetic LOCAL account/scope; do not bypass production authentication.
-- 3. Replace a region via the same deletion shape used by re-extraction;
--    both total run cost and per-run SUM stay unchanged.
-- 4. Insert a synthetic eval_run/eval_case with null student/paper model_call;
--    deletion of an unrelated real region leaves every eval link/cost intact.
-- 5. Delete the paper, then student/account tombstone scenarios; existing full
--    anonymisation still clears all owner/asset/content refs, retaining costs.
-- 6. Assert no PUBLIC/anon/authenticated/service EXECUTE on the trigger helper,
--    pinned search_path, no new client grants and unchanged scope/RLS behavior.
-- 7. Run current SQL suites and exact-head CI; post-apply read-only advisor and
--    typed attribution queries; finally real authorized disposable deletion.
