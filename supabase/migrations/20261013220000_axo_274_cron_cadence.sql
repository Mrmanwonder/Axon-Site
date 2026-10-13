-- AXO-274: two pg_cron jobs ran every minute without needing to (owner, 13 Oct
-- 2026: "if not necessary then fix the scheduling"). Found while the database
-- was resource-starved (AXO-272).
--
--  · stripe-sync-worker (Supabase Stripe Sync Engine integration): every
--    minute it decrypted a Vault secret and POSTed to the stripe-worker Edge
--    Function. Real-time Stripe changes reach the stripe.* mirror by webhook;
--    the scheduled worker only drains backfill work. Nothing in Axon reads
--    stripe.* (billing uses our own stripe-webhook function and the Stripe
--    API). Hourly. It was created outside this repository; this migration is
--    now its record.
--  · axon-stuck-run-recovery: private.sweep_stuck_runs() fails runs whose
--    heartbeat is older than 10 minutes. Checking every 5 minutes moves the
--    worst case from 11 to 15 minutes on a path that already waits 10.
--
-- Altered in place by name (cron.alter_job keeps each job's command and id).
-- A job that does not exist is left alone; nothing is created here.
do $cron$
declare
  v_id bigint;
begin
  if to_regnamespace('cron') is null then
    return;
  end if;
  select jobid into v_id from cron.job where jobname = 'stripe-sync-worker';
  if v_id is not null then
    perform cron.alter_job(job_id := v_id, schedule := '7 * * * *');
  end if;
  v_id := null;
  select jobid into v_id from cron.job where jobname = 'axon-stuck-run-recovery';
  if v_id is not null then
    perform cron.alter_job(job_id := v_id, schedule := '*/5 * * * *');
  end if;
end $cron$;
