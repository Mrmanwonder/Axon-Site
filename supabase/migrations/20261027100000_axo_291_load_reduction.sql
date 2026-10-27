-- AXO-291: keep the Nano instance out of the stall that took it down on
-- 13 Oct (AXO-272) and again from 26 Oct 20:35 to 27 Oct ~05:50 UTC.
--
-- What the evidence showed (full write-up: docs/claude_supabase-load-reduction-2026-10-27.md):
-- * pg_cron runs every job in a new backend (cron.use_background_workers is
--   off on this platform). Three jobs started on the same minute every five
--   minutes, so a slow instance turned each of those minutes into a burst of
--   connection starts; ~37 "job startup timeout" failures an hour followed.
-- * The rest of the load reduction is in the ingest scripts and workflows
--   (they no longer rewrite unchanged rows), not here.
--
-- This migration:
-- 1. spreads the cron jobs so no two start on the same minute, and runs the
--    two internal ones (learning signal roll-up, spend-alert detection) every
--    15 minutes instead of 5. Neither is student-facing: the roll-up feeds
--    internal prompt review, and a spend alert 10 minutes later changes nothing.
--    Stuck-run recovery stays every 5 minutes (AXO-274, owner).
-- 2. narrows the per-paper spend check to papers that had a model call in the
--    last two days. A paper's total only grows when it gets a new call, and an
--    alert is raised once per paper (on conflict do nothing), so the result is
--    the same; the job no longer reads all of model_call every run.
-- 3. caps how long a session may sit idle inside an open transaction, so a
--    forgotten transaction can never hold locks (or a snapshot that blocks
--    vacuum) for hours. PostgREST's own transactions last milliseconds.

-- 1. Cron schedules. Minutes used: sweep 0,5,10…; learning 1,16,31,46;
--    spend alerts 4,19,34,49; Stripe sync :07; retention 03:17, 03:43, 04:23.
do $$
declare
  v record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;  -- a local database without pg_cron
  end if;
  for v in
    select * from (values
      ('axon-stuck-run-recovery',    '*/5 * * * *'),
      ('axon-learning-aggregate',    '1-59/15 * * * *'),
      ('axon-cost-alerts',           '4-59/15 * * * *'),
      ('axon-work-journal-retention','43 3 * * *')
    ) as s(name, schedule)
  loop
    perform cron.alter_job(j.jobid, schedule => v.schedule)
       from cron.job j where j.jobname = v.name;
    if not found then
      raise exception 'cron job % is missing; expected it to be scheduled', v.name;
    end if;
  end loop;
end $$;

-- 2. Spend alerts read only recent activity.
create or replace function private.detect_cost_alerts()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_fx numeric;
  v_n integer := 0;
  v_k integer;
  v_paper numeric;
  v_day numeric;
begin
  select inr_per_usd into v_fx from public.fx_rate
   where currency = 'INR' and effective_from <= current_date
   order by effective_from desc limit 1;

  select threshold_usd into v_paper from public.cost_alert_config where kind = 'per_paper' and enabled;
  if v_paper is not null then
    -- Only a paper with a new call can cross the line it had not crossed
    -- before (AXO-291). Two days of margin covers a paused or failed job.
    insert into public.cost_alert (kind, subject, observed_usd, threshold_usd, observed_inr, unpriced_calls)
    select 'per_paper', mc.paper_id::text, sum(mc.cost_usd), v_paper,
           case when v_fx is null then null else round(sum(mc.cost_usd) * v_fx, 2) end,
           count(*) filter (where mc.cost_usd is null)
      from public.model_call mc
     where mc.paper_id in (select r.paper_id from public.model_call r
                            where r.created_at >= now() - interval '2 days' and r.paper_id is not null)
     group by mc.paper_id
    having sum(mc.cost_usd) > v_paper
    on conflict (kind, subject) do nothing;
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end if;

  select threshold_usd into v_day from public.cost_alert_config where kind = 'per_day' and enabled;
  if v_day is not null then
    insert into public.cost_alert (kind, subject, observed_usd, threshold_usd, observed_inr, unpriced_calls)
    select 'per_day', (created_at at time zone 'UTC')::date::text, sum(cost_usd), v_day,
           case when v_fx is null then null else round(sum(cost_usd) * v_fx, 2) end,
           count(*) filter (where cost_usd is null)
      from public.model_call
     where created_at >= now() - interval '2 days'
     group by (created_at at time zone 'UTC')::date
    having sum(cost_usd) > v_day
    on conflict (kind, subject) do nothing;
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end if;

  return v_n;
end;
$function$;

revoke all on function private.detect_cost_alerts() from public, anon, authenticated;

-- 3. No session sits idle in an open transaction for long.
alter role authenticated set idle_in_transaction_session_timeout = '30s';
alter role anon set idle_in_transaction_session_timeout = '30s';
alter role service_role set idle_in_transaction_session_timeout = '60s';
