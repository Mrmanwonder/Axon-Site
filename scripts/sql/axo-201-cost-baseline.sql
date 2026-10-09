-- AXO-201 read-only operator audit. Run with a privileged reporting connection.
-- No student IDs, paper IDs, original object keys or answer text are returned.
-- "Successful" means at least one non-evaluation run started in the last 30
-- days has been committed. Costs include every logged call for those papers,
-- including earlier runs, so retries/reprocessing do not disappear.
-- These are recorded MODEL cost estimates; they exclude unlogged provider
-- usage, non-model services, fixed invoices and deleted history.

with cohort as (
 select distinct paper_id from public.extraction_run
 where started_at >= now()-interval '30 days' and committed_at is not null and eval_run_id is null
), paper_cost as (
 select c.paper_id,count(m.id) calls,count(m.id) filter (where m.cost_usd is null) unknown,
 sum(m.cost_usd) recorded_model_usd,count(m.id) filter(where not m.ok) failed,
 count(m.id) filter(where m.attempt>1) retry_attempts
 from cohort c left join public.model_call m on m.paper_id=c.paper_id group by c.paper_id
)
select count(*) successful_papers,count(*) filter(where calls=0) papers_without_calls,
 count(*) filter(where calls>0 and unknown=0) fully_priced_papers,
 sum(calls) calls,sum(unknown) unpriced_calls,sum(failed) failed_calls,sum(retry_attempts) retry_attempts,
 percentile_cont(0.5) within group(order by recorded_model_usd) filter(where calls>0 and unknown=0) as fully_priced_model_p50_usd,
 percentile_cont(0.95) within group(order by recorded_model_usd) filter(where calls>0 and unknown=0) as fully_priced_model_p95_usd
from paper_cost;

with cohort as (select distinct paper_id from public.extraction_run where started_at>=now()-interval '30 days' and committed_at is not null and eval_run_id is null)
select m.stage,count(*) calls,sum(m.cost_usd) recorded_model_usd,sum(m.input_tokens) input_tokens,sum(m.output_tokens) output_tokens,
 count(*) filter(where m.cost_usd is null) unknown_cost_calls
from public.model_call m join cohort c using(paper_id) group by m.stage order by sum(m.cost_usd) desc;

select stage, model_id, cost_basis, count(*) calls,
 count(*) filter(where cost_usd is null) unknown_cost_calls,
 count(*) filter(where not ok) failed_calls,
 sum(cost_usd) recorded_model_usd,
 sum(input_tokens) input_tokens, sum(output_tokens) output_tokens
from public.model_call
where created_at >= now()-interval '30 days'
group by stage, model_id, cost_basis
order by sum(cost_usd) desc nulls last;

select kind, threshold_usd, enabled from public.cost_alert_config order by kind;

select kind, count(*) alerts,
 count(*) filter(where delivered_at is not null) delivered,
 count(*) filter(where delivery_error is not null) delivery_failed
from public.cost_alert
where created_at >= now()-interval '30 days'
group by kind order by kind;
