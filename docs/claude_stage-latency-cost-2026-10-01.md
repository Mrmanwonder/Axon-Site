# Stage latency and cost — production baseline (AXO-43)

Date: 2026-10-01. Source: `public.model_call`, production project `dlgcqieyevoebefhcggi`, last 30 days, every row (no sampling). Evidence class: **production measurement**, not an eval. No student content was read; only timing and token counters.

## Per stage, per model

| Stage | Model | Calls | OK % | p50 ms | p95 ms | p99 ms | Avg in tok | Avg out tok | Window |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| triage | 3.1 Flash-Lite | 7 | 100 | 1 554 | 16 996 | 22 055 | 3 850 | 52 | 04–12 Sep |
| triage | 3.5 Flash-Lite | 8 | 100 | 1 719 | 2 193 | 2 197 | 4 323 | 59 | 24–30 Sep |
| structure | 3.1 Flash-Lite | 28 | 100 | 3 042 | 9 524 | 11 353 | 2 594 | 383 | 04–12 Sep |
| structure | 3.5 Flash-Lite | 131 | 100 | 2 312 | 3 450 | 3 907 | 2 615 | 245 | 27–30 Sep |
| content | 3.1 Flash-Lite | 50 | 100 | 2 494 | 4 784 | 6 121 | 1 924 | 686 | 04–12 Sep |
| content | 3.5 Flash-Lite | 14 | 100 | 8 742 | 22 307 | 24 196 | 2 541 | 1 120 | 30 Sep |
| adjudicate | 3.1 Flash-Lite | 7 | 100 | 1 948 | 4 434 | 5 080 | 1 584 | 182 | 04–12 Sep |
| adjudicate | 3.5 Flash-Lite | 5 | **40** | 7 907 | 8 151 | 8 161 | 1 580 | 82 | 30 Sep |
| explain | 3.1 Flash-Lite | 19 | 100 | 1 614 | 2 180 | 2 219 | 1 160 | 271 | 04–07 Sep |
| explain | 3.5 Flash-Lite | 4 | **0** | 6 475 | 6 655 | 6 669 | 2 405 | 77 | 30 Sep |
| tutor | — | 0 | — | — | — | — | — | — | not deployed (AXO-126) |

## What this does and does not establish

- **It is a baseline, not a certification.** Samples are small (4–131 calls per cell), come from very few papers, and mix models across different weeks. The p99 values on any cell under ~100 calls are no better than the maximum observed.
- **Explain/adjudicate on 3.5 Flash-Lite failed** (0 % and 40 % OK, all `bad_shape`). This is the AXO-123 failure, already rolled back to 3.1 Flash-Lite in `model_route` on 2026-10-01. No explain call has run since then, so the rollback is unproven in production.
- **Content on 3.5 Flash-Lite is ~3.5× slower at p50** than 3.1 Flash-Lite (8.7 s vs 2.5 s), with double-digit-second p95. The output-token average also rose (1 120 vs 686), which fits thinking-token growth. `reasoning_tokens` was not recorded at the time, so this can't be separated.
- **Cost is unmeasured for this window.** `cost_usd` is null on every row; the price table and cost columns landed today (AXO-124). Cost per stage needs new traffic.
- **Cold vs warm can't be told apart.** `model_call` has no isolate-start marker. Recommendation: record `worker_cold_start boolean` in the shared model client (first call per isolate), so p95 can be split.
- **Tavily policy**: `retrieval_used` was true on the 4 failed explain calls and nowhere else; `grounding_used` is false everywhere. There is no production Tavily traffic to measure, because the tutor isn't deployed.

## Next measurement

Run after the AXO-116 deploy and the first post-AXO-124 papers: the same query plus `sum(cost_usd)`, `avg(reasoning_tokens)` and `avg(cached_tokens)` per stage. Keep it stage-specific; don't aggregate across stages.

```sql
select stage, model_id, count(*), avg(ok::int),
       percentile_cont(array[0.5,0.95,0.99]) within group (order by latency_ms),
       avg(input_tokens), avg(output_tokens), avg(reasoning_tokens), avg(cached_tokens), sum(cost_usd)
  from model_call where created_at > now() - interval '30 days' group by 1, 2 order by 1, 2;
```
