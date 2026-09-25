-- Ledger marker for the production migration of the same version and name.
--
-- Production received a small follow-up that made sweep_dead_letters discover
-- whichever axon_* or mastery_* queues exist. The replayable migration at
-- 20260904113038_honest_sweep_messages_for_real.sql already contains that
-- queue-discovery behavior together with the later page-status reset fix.
-- Replaying the older production function body here would overwrite the more
-- complete consolidated implementation, so this file is intentionally a
-- no-op. Its exact version keeps local, preview, and production migration
-- ledgers aligned without changing the fresh-database schema.

select 1;
