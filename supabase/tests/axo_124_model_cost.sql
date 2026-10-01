-- ============================================================================
-- Test suite: AXO-124 model cost capture
-- ============================================================================
-- Cost is computed in the database from token counts and a versioned price
-- table, and rolled up onto the run, so the run total is always the sum of its
-- calls. A model with no price is recorded as unpriced, never as free.
--
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_124_model_cost.sql
--   Pass: the counts line reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','ga@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics');

insert into public.extraction_run (id, paper_id, student_id, pipeline_version, reconciled)
values ('aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000003',
        'aaaaaaaa-0000-4000-8000-000000000002','1.0.0', true);

-- ── the price table is not readable by clients ─────────────────────────────

select public._t('clients cannot read model_price',
  not has_table_privilege('authenticated', 'public.model_price', 'select')
  and not has_table_privilege('anon', 'public.model_price', 'select'));

select public._t('clients cannot read fx_rate',
  not has_table_privilege('authenticated', 'public.fx_rate', 'select')
  and not has_table_privilege('anon', 'public.fx_rate', 'select'));

-- ── price arithmetic ───────────────────────────────────────────────────────
-- 3.1 Flash-Lite: $0.25 in / $1.50 out per 1M.  10,000 in + 2,000 out
-- = 0.0025 + 0.0030 = 0.005500

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, output_tokens, billed_output_tokens)
values ('aaaaaaaa-0000-4000-8000-000000000010','explain','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', true,
        10000, 1200, 2000);

select public._t('cost is computed from billed output (including thinking), not completion alone',
  (select cost_usd = 0.005500 and cost_basis = 'price_table' from public.model_call
    where run_id = 'aaaaaaaa-0000-4000-8000-000000000010' order by id desc limit 1),
  (select cost_usd::text || '/' || coalesce(cost_basis, '-') from public.model_call order by id desc limit 1));

-- no billed_output_tokens: fall back to completion + reasoning (1,200 + 800 = 2,000)
insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, output_tokens, reasoning_tokens)
values ('aaaaaaaa-0000-4000-8000-000000000010','content','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', true,
        10000, 1200, 800);

select public._t('without a billed total, completion plus reasoning tokens are billed as output',
  (select cost_usd = 0.005500 from public.model_call order by id desc limit 1));

-- cached tokens are billed at the input price until a cached rate is set
insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, cached_tokens, billed_output_tokens)
values ('aaaaaaaa-0000-4000-8000-000000000010','structure','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', true,
        10000, 4000, 2000);

select public._t('cached tokens bill at the full input rate while the cached rate is unset',
  (select cost_usd = 0.005500 from public.model_call order by id desc limit 1));

-- ── honesty about what is not priced ───────────────────────────────────────

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens)
values ('aaaaaaaa-0000-4000-8000-000000000010','triage','some-unpriced-model','some-unpriced-model','t.v1', true, 1000, 100);

select public._t('a model with no price row is unpriced, not free',
  (select cost_usd is null and cost_basis = 'unpriced' from public.model_call order by id desc limit 1));

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok, error_code)
values ('aaaaaaaa-0000-4000-8000-000000000010','triage','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', false, 'timeout');

select public._t('a call that failed before any tokens were billed costs zero with basis no_usage',
  (select cost_usd = 0 and cost_basis = 'no_usage' from public.model_call order by id desc limit 1));

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens, cost_usd)
values ('aaaaaaaa-0000-4000-8000-000000000010','explain','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', true,
        10000, 2000, 0.123456);

select public._t('a provider-supplied cost is kept and labelled provider',
  (select cost_usd = 0.123456 and cost_basis = 'provider' from public.model_call order by id desc limit 1));

-- ── prices are versioned: gemini-3.8-flash doubles on 2027-01-01 ───────────

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens, created_at)
values ('aaaaaaaa-0000-4000-8000-000000000010','adjudicate','gemini-3.8-flash','gemini-3.8-flash','t.v1', true,
        1000000, 0, '2026-12-31T12:00:00Z');
select public._t('gemini-3.8-flash input is $0.75 per 1M through 2026-12-31',
  (select cost_usd = 0.750000 from public.model_call order by id desc limit 1));

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens, created_at)
values ('aaaaaaaa-0000-4000-8000-000000000010','adjudicate','gemini-3.8-flash','gemini-3.8-flash','t.v1', true,
        1000000, 0, '2027-01-02T12:00:00Z');
select public._t('gemini-3.8-flash input doubles to $1.50 per 1M from 2027-01-01',
  (select cost_usd = 1.500000 from public.model_call order by id desc limit 1));

-- ── service tiers price separately: flex is half of standard ───────────────

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens, service_tier)
values ('aaaaaaaa-0000-4000-8000-000000000010','explain','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', true,
        10000, 2000, 'flex');
select public._t('a flex-tier call is priced at half the standard rate',
  (select cost_usd = 0.002750 and cost_basis = 'price_table' from public.model_call order by id desc limit 1),
  (select cost_usd::text from public.model_call order by id desc limit 1));

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens, service_tier)
values ('aaaaaaaa-0000-4000-8000-000000000010','explain','gemini-3.1-pro-preview','gemini-3.1-pro-preview','t.v1', true,
        1000000, 0, 'flex');
select public._t('a model with no price for the tier is unpriced, not borrowed from standard',
  (select cost_usd is null and cost_basis = 'unpriced' from public.model_call order by id desc limit 1));

-- ── the run total is the sum of its calls ──────────────────────────────────

select public._t('extraction_run.cost_usd equals the sum of its calls',
  (select r.cost_usd = (select coalesce(sum(m.cost_usd), 0) from public.model_call m where m.run_id = r.id)
     from public.extraction_run r where r.id = 'aaaaaaaa-0000-4000-8000-000000000010'),
  (select r.cost_usd::text || ' vs ' || (select sum(m.cost_usd)::text from public.model_call m where m.run_id = r.id)
     from public.extraction_run r where r.id = 'aaaaaaaa-0000-4000-8000-000000000010'));

-- ── cost_paise follows only when an fx rate exists ─────────────────────────

select public._t('cost_paise is untouched while no fx rate is set',
  (select cost_paise = 0 from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-000000000010'));

insert into public.fx_rate (currency, inr_per_usd, effective_from, source)
values ('INR', 100.0000, '2026-01-01', 'test fixture');

insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
                               input_tokens, billed_output_tokens)
values ('aaaaaaaa-0000-4000-8000-000000000010','explain','gemini-3.1-flash-lite','gemini-3.1-flash-lite','t.v1', true,
        10000, 2000);

select public._t('cost_paise is derived from cost_usd once an fx rate exists',
  (select cost_paise = round(cost_usd * 100 * 100)::integer from public.extraction_run
    where id = 'aaaaaaaa-0000-4000-8000-000000000010'),
  (select cost_paise::text || ' vs ' || round(cost_usd * 100 * 100)::text from public.extraction_run
    where id = 'aaaaaaaa-0000-4000-8000-000000000010'));

-- ── the worker's role ──────────────────────────────────────────────────────
-- The pipeline inserts model_call as service_role. The triggers once ran as the caller and
-- failed with "permission denied for schema private", silently dropping every row. Everything
-- above ran as the table owner and could not see that; this block inserts as the real role.

do $$
begin
  set local role service_role;
  begin
    insert into public.model_call (run_id, stage, requested_model, model_id, prompt_version, ok,
        input_tokens, output_tokens, service_tier, attempt)
    values ('aaaaaaaa-0000-4000-8000-000000000010', 'explain', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite',
        'paper_feedback.v2', true, 1000, 200, 'standard', 1);
    reset role;
    perform public._t('service_role can insert model_call rows through the cost triggers', true);
  exception when others then
    reset role;
    perform public._t('service_role can insert model_call rows through the cost triggers', false, sqlerrm);
  end;
end $$;

select public._t('the row inserted as service_role was priced',
  (select cost_usd is not null and cost_basis = 'price_table' from public.model_call order by id desc limit 1));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
