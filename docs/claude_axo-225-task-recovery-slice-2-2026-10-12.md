# AXO-225 slice 2: a stalled run is re-driven, not failed and reset (12 Oct 2026)

Status: implemented on branches, not merged, not applied, not deployed. Off by default.

## Before

`private.sweep_stuck_runs` runs every 5 minutes (pg_cron `axon-stuck-run-recovery`; every minute until AXO-274 changed it on 13 Oct 2026). Any run with a heartbeat older than 10 minutes is failed, and the paper's done pages are reset to pending. Both 9 Oct failures were `sweep_timeout:content`.

## After (flag `task_recovery` on)

A stale run in `structure` or `content` is re-driven instead:
- Only unfinished units (pages or regions in `pending`/`running`) are set to `pending`. Finished ones are not touched.
- In the same transaction, one `private.stage_outbox` row is written per unfinished unit.
- If nothing is unfinished (the fan-out message was lost), one "nudge" row is written for a finished unit. The worker's already-done path then advances the run.
- `extraction_run.recovery_attempts` counts re-drives. At most 2; the third stall takes the old path (fail with `sweep_timeout:<stage>`).
- Other stages fail as before.

The sweep Worker (`mastery-sweep`) now has a one-minute cron that claims outbox rows (`public.claim_stage_outbox`), sends them to `structure-queue` / `content-queue`, and marks them delivered (`public.finish_stage_outbox`). A failed send backs off that stage only. Rows for a run that has already finished are dropped.

With slice 1's journal on, a re-driven unit whose answer was already saved makes no second model call.

## Files

- Axon-Site `feat/axo-225-task-recovery`: `supabase/migrations/20261012190000_axo_225_task_level_recovery.sql`, `tests/db/task-recovery.test.mjs` (11 tests).
- axon-backend `feat/axo-225-outbox-dispatch`: `shared/src/stage_outbox.ts`, `shared/src/__tests__/stage_outbox.test.ts` (4 tests), `workers/sweep/src/index.ts`, `workers/sweep/wrangler.toml`.

The failing branch of `sweep_stuck_runs` is the live production body, read on 12 Oct 2026 and identical to `20261001170000_axo_124_pipeline_integrity.sql`.

## Rollout

1. Merge both PRs (the migration applies via `migrate.yml`; the sweep Worker deploys via `deploy.yml`). Nothing changes yet: the flag is off and the outbox is empty.
2. Confirm the sweep Worker's one-minute cron is registered.
3. `update private.feature_flag set enabled = true where key = 'task_recovery';` (database operator).
4. Rollback: set the flag back to false. Undelivered outbox rows are dropped as their runs finish or fail.

## Not done

- No per-paper or global concurrency limits, no progress UI, no manifest seal.
- The forward path (stage to stage fan-out) still sends queue messages directly from the workers; only recovery goes through the outbox.
- Cloudflare dead-letter queues (`structure-dlq`, `content-dlq`) have no consumer; `private.sweep_dead_letters` reads the old pgmq queues.
- Crop stage (`crop_stage` flag is off in production) is not covered by re-drive.
