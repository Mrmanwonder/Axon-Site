-- AXO-124: spend alerts. A paper that costs more than expected, or a day that does, is surfaced
-- instead of discovered on the invoice.
--
-- Thresholds live in cost_alert_config so they are adjustable with an UPDATE, not a deploy.
-- Starting values (owner, 2026-10-02): $0.50 per paper, $10 per UTC day.
--
-- private.detect_cost_alerts() runs every 5 minutes (pg_cron) and writes one cost_alert row per
-- (kind, subject), so a breach alerts once. The sweep worker delivers undelivered rows to
-- ALERT_WEBHOOK_URL and stamps delivered_at; if no destination is configured the rows simply wait
-- (visible, never dropped). USD is canonical; INR is the roll-up at the dated fx_rate.
--
-- Cost is summed only over priced calls (cost_usd is NULL when a model has no price). The count of
-- unpriced calls is stored beside it so an alert never reads as complete when it is not.
-- Nothing here carries student text: a paper id, a date, and numbers.

create table if not exists public.cost_alert_config (
  kind          text primary key check (kind in ('per_paper', 'per_day')),
  threshold_usd numeric(10,4) not null check (threshold_usd > 0),
  enabled       boolean not null default true,
  note          text
);

insert into public.cost_alert_config (kind, threshold_usd, note) values
  ('per_paper', 0.50, 'AXO-124 starting value; adjust with UPDATE'),
  ('per_day',  10.00, 'AXO-124 starting value; adjust with UPDATE (UTC day)')
on conflict (kind) do nothing;

create table if not exists public.cost_alert (
  id              bigint generated always as identity primary key,
  kind            text not null check (kind in ('per_paper', 'per_day')),
  subject         text not null,                 -- paper id, or the UTC date
  observed_usd    numeric(12,6) not null,
  threshold_usd   numeric(10,4) not null,
  observed_inr    numeric(12,2),                 -- NULL when no fx_rate applies
  unpriced_calls  integer not null default 0,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  delivery_error  text,
  unique (kind, subject)
);

alter table public.cost_alert_config enable row level security;
alter table public.cost_alert enable row level security;
revoke all on public.cost_alert_config, public.cost_alert from anon, authenticated;
grant select, update on public.cost_alert_config to service_role;
grant select, update (delivered_at, delivery_error) on public.cost_alert to service_role;

create or replace function private.detect_cost_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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
    insert into public.cost_alert (kind, subject, observed_usd, threshold_usd, observed_inr, unpriced_calls)
    select 'per_paper', paper_id::text, sum(cost_usd), v_paper,
           case when v_fx is null then null else round(sum(cost_usd) * v_fx, 2) end,
           count(*) filter (where cost_usd is null)
      from public.model_call
     where paper_id is not null
     group by paper_id
    having sum(cost_usd) > v_paper
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
$$;
revoke all on function private.detect_cost_alerts() from public, anon, authenticated;

-- The sweep worker (service_role) triggers detection and reads what is waiting, via one RPC each.
create or replace function public.pending_cost_alerts(p_limit integer default 20)
returns setof public.cost_alert
language sql
security definer
set search_path = ''
as $$
  select * from public.cost_alert where delivered_at is null order by id limit greatest(p_limit, 1);
$$;
revoke all on function public.pending_cost_alerts(integer) from public, anon, authenticated;
grant execute on function public.pending_cost_alerts(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'axon-cost-alerts';
    perform cron.schedule('axon-cost-alerts', '*/5 * * * *', 'select private.detect_cost_alerts();');
  end if;
end $$;
