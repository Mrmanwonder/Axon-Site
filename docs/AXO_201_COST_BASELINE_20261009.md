# AXO-201 measured model-cost baseline — 9 October 2026

## What was measured

Read-only queries against the connected production database on 9 October 2026.
The cohort is four distinct papers with a committed, non-evaluation extraction
run started in the preceding 30 days. Every logged model call for those papers
is included, including earlier runs. This measures recorded lifetime model
spend for the successful-paper cohort, rather than silently discarding failed
work. The all-calls coverage check uses the preceding 30 days.

All 205 cohort calls have a recorded cost, derived from the existing price
table. These are estimates, not reconciled vendor invoices. They include 207
image references; references are not proof of a distinct provider image charge.
There are no recorded failed calls or attempt>1 retries in this cohort. That
does not establish the absence of duplicate queue deliveries or unlogged calls.

| Measure | Recorded estimate |
| --- | ---: |
| Successful papers | 4 |
| Fully priced papers | 4 |
| Model p50 per successful paper | $0.442643 |
| Model p95 per successful paper | $0.48619675 |
| Cohort model spend | $1.781847 |
| Model calls | 205 |
| Billed output tokens | 332,796 |
| Visible output tokens | 98,769 |
| Cached input tokens reported | 89,790 |

The small sample cannot establish a stable population p95. Billed output is
much greater than visible output. Separate reasoning-token values are null,
so do not assert the difference is entirely reasoning without checking provider
usage semantics.

## Stage waterfall

| Stage | Calls | Estimated USD | Share |
| --- | ---: | ---: | ---: |
| Content | 77 | 0.797075 | 44.7% |
| Explain | 15 | 0.393691 | 22.1% |
| Topic tagging | 42 | 0.219237 | 12.3% |
| Structure | 46 | 0.129463 | 7.3% |
| Scheme check | 16 | 0.116471 | 6.5% |
| Adjudication | 4 | 0.115947 | 6.5% |
| Triage | 5 | 0.009963 | 0.6% |

Content and explanations together account for about two thirds of this
cohort's model spend. Topic tagging carries 281,787 input tokens and reports
89,790 cached input tokens. Check repeated curriculum context and cache hit
coverage before changing model quality.

## Coverage and existing budgets

Across all 628 recent model calls, 200 have null cost (31.8%): 175 have no cost
basis and 25 are explicitly unpriced. Known estimates total $3.070319; that is
a lower bound, not the total spend. The successful cohort excludes these gaps,
so its complete pricing must not be generalized to unsuccessful work.

Live cost alerts are enabled at $0.50 per paper and $10 per UTC day. These
are the existing owner-defined model-spend thresholds, not a new operating
budget. No alerts are recorded in the last 30 days. Configuration and an empty
alert table do not demonstrate successful email delivery or spike detection.

No monthly-active-student operating target is established by this audit.
It requires paper frequency, failure burden, service invoices and an allocation
policy. Do not infer it from a four-paper model-only sample.

## Remaining AXO-201 acceptance work

1. Reconcile missing prices and usage with vendor bills; retain unknown cost as
   null rather than pretending it is zero.
2. Instrument retrieval/search, Workers/Queues/R2, Supabase, observability and
   email units with price snapshots and paper/run attribution. Separate fixed
   invoices from marginal usage. Those services are outside this baseline.
3. Build per-student usage distributions and define the monthly target from
   actual paper frequency and allocated fixed cost.
4. Demonstrate per-paper/day alert delivery and add measured retry/duplicate
   and unpriced-usage alerts where coverage is missing.
5. Evaluate repeated context, cache coverage and stage-specific output usage.
   Each optimization needs before/after cost, latency, completion and grading
   evidence on the same corpus. No model or quality gate was downgraded here.

Run `scripts/sql/axo-201-cost-baseline.sql` with a privileged reporting
connection to reproduce the aggregates. It performs only SELECT queries and
returns no account identities, original object keys or answers. It is an
operator audit, not an authenticated student-facing endpoint.

AXO-201 remains open: this supplies an evidence-based model baseline, not
completed full-product unit economics or demonstrated savings.
