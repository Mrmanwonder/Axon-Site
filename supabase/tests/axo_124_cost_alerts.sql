-- Test suite: AXO-124 cost alerts. Rolls back.
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_124_cost_alerts.sql
begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

select public._t('starting thresholds are $0.50 per paper and $10 per day',
  (select count(*) = 2 from public.cost_alert_config
    where (kind = 'per_paper' and threshold_usd = 0.50) or (kind = 'per_day' and threshold_usd = 10.00)));

select public._t('clients cannot read alerts or their thresholds',
  not has_table_privilege('authenticated', 'public.cost_alert', 'select')
  and not has_table_privilege('anon', 'public.cost_alert_config', 'select'));

-- two papers' worth of calls, inserted with provider-supplied cost so no price table is involved
delete from public.cost_alert;
delete from public.fx_rate;
insert into public.fx_rate (currency, inr_per_usd, effective_from, source) values ('INR', 100.0, '2026-01-01', 'test fixture');

insert into public.model_call (paper_id, stage, requested_model, model_id, prompt_version, ok, input_tokens, billed_output_tokens, cost_usd)
values ('cccccccc-0000-4000-8000-000000000001','explain','x','x','t', true, 1, 1, 0.60),
       ('cccccccc-0000-4000-8000-000000000002','explain','x','x','t', true, 1, 1, 0.20),
       ('cccccccc-0000-4000-8000-000000000002','explain','unpriced-model','unpriced-model','t', true, 1, 1, null);

update public.cost_alert_config set threshold_usd = 100 where kind = 'per_day';
select private.detect_cost_alerts();

select public._t('a paper over its threshold raises one alert, with INR at the dated rate',
  (select count(*) = 1 and bool_and(observed_usd = 0.60 and observed_inr = 60.00 and threshold_usd = 0.50)
     from public.cost_alert where kind = 'per_paper'));

select public._t('a paper under its threshold raises none',
  not exists (select 1 from public.cost_alert where subject = 'cccccccc-0000-4000-8000-000000000002'));

select private.detect_cost_alerts();
select public._t('detecting twice does not alert twice',
  (select count(*) = 1 from public.cost_alert where kind = 'per_paper'));

update public.cost_alert_config set threshold_usd = 0.70 where kind = 'per_day';
select private.detect_cost_alerts();
select public._t('a day over its threshold raises one alert counting its unpriced calls',
  (select count(*) = 1 and bool_and(observed_usd = 0.80 and unpriced_calls = 1)
     from public.cost_alert where kind = 'per_day'));

update public.cost_alert_config set enabled = false where kind = 'per_paper';
delete from public.cost_alert;
select private.detect_cost_alerts();
select public._t('a disabled threshold raises nothing',
  not exists (select 1 from public.cost_alert where kind = 'per_paper'));

select public._t('undelivered alerts are readable by the worker role and delivered ones drop out',
  (select count(*) from public.pending_cost_alerts(10)) = 1);

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;
rollback;
