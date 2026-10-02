-- Test suite: AXO-124 cached-input rates and the dated INR rate. Rolls back.
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_124_cached_rates_and_fx.sql
begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

select public._t('INR is seeded at 96.0 effective 2026-10-02',
  (select inr_per_usd = 96.0 from public.fx_rate where currency = 'INR' and effective_from = '2026-10-02'));

-- 3.8 Flash standard, 10 000 input of which 8 000 cached, 1 000 output: (2000*0.75 + 8000*0.075 + 1000*3.75) / 1e6
select public._t('cached input is billed at the cached rate',
  (select private.model_call_cost_usd('gemini-3.8-flash', 'standard', 10000, 8000, 1000, '2026-10-05') = 0.005850),
  (select private.model_call_cost_usd('gemini-3.8-flash', 'standard', 10000, 8000, 1000, '2026-10-05')::text));

-- The doubled 2027 rates apply from 2027-01-01: (2000*1.5 + 8000*0.15 + 1000*7.5) / 1e6
select public._t('the 2027-01-01 rate card applies its own cached rate',
  (select private.model_call_cost_usd('gemini-3.8-flash', 'standard', 10000, 8000, 1000, '2027-02-01') = 0.011700),
  (select private.model_call_cost_usd('gemini-3.8-flash', 'standard', 10000, 8000, 1000, '2027-02-01')::text));

select public._t('every priced standard model has a cached rate',
  (select count(*) = 0 from public.model_price where tier = 'standard' and cached_input_per_mtok is null));

select public._t('a model without a price row is unpriced (NULL), never zero',
  (select private.model_call_cost_usd('gemini-3.6-flash', 'standard', 1000, 0, 100, '2026-10-05') is null));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;
rollback;
