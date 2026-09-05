# Edge Functions — read this before editing anything here

## Most of this directory is not deployed and does not run

Checked against the live project on 2026-09-04. The **only** Edge Functions
deployed to `dlgcqieyevoebefhcggi` are:

```
stripe-setup   stripe-webhook   stripe-worker   billing-checkout   billing-portal
```

That is the complete list. Every extraction-pipeline function in this
directory — `w-triage`, `w-structure`, `w-content`, `w-reconcile`,
`w-adjudicate`, `w-explain`, `w-r2-delete`, `queue-tick`, `paper-submit`,
`upload-intent`, `upload-complete`, `review-complete`, `explain`,
`extract-structure`, `extract-content`, `extract-finalize`, `eval-run`,
`patterns` — **is not deployed.** Editing them changes nothing that runs.

## What actually runs the pipeline

Nine Cloudflare Workers, last deployed 2026-09-02:

```
mastery-api        mastery-triage    mastery-structure   mastery-crop
mastery-content    mastery-reconcile mastery-adjudicate  mastery-explain
mastery-sweep
```

`src/config.js` points the client straight at them
(`MASTERY_API_URL = https://mastery-api.tanmay-harkawat.workers.dev`). They
carry their own copy of the shared logic — the deployed bundle shows
`../../shared/src/confidence.ts` — and they use **Cloudflare Queues**, not
pgmq.

**That source is not in *this* repository — but it is in version control.**
It lives in `Mrmanwonder/axon-backend` (private), as an npm workspace monorepo:
`shared/` for the library the workers share, `workers/{api,triage,structure,
crop,content,reconcile,adjudicate,explain,sweep}/` for the nine. It typechecks
with `tsc` and dry-runs with `wrangler`, and it has tests.

Corrected 2026-09-05. The paragraph that stood here said the code existed only
as deployed bundles, on the strength of PR #16 having been closed unmerged. That
was wrong, and it was expensive: a spec written against this file concluded that
the explain-stage prompt could not be changed from source at all and planned
around a constraint that did not exist. If you need to change pipeline
behaviour, change it in `axon-backend` — not here, and not by reading a bundle.

The gap that *is* real is smaller and duller: this directory still contains an
older copy of that logic, and editing it changes nothing that runs.

## Two concrete ways this has already misled people

**The confidence fix.** `_shared/confidence.ts` and `w-reconcile` were changed
on 2026-09-04 to make the `arithmetic` and `layerFallback` signals per-region
instead of paper-wide. The deployed `mastery-reconcile` had already solved
that on 2026-09-02, and solved it differently: it passes `arithmeticOk: true`
outright, and rather than vetoing on a fallen-back page it *downgrades
recognition* for the regions whose `page_spans` touch one. Two committed runs
on 2026-09-04 (03:30 and 08:16) show 5 `confident` and 2 `unsure` on a paper
whose totals did **not** reconcile, with the arithmetic signal passing for all
seven regions — the fix is live and has been for days. The repo-side change is
consistent with it and harmless, but it is not what produced that result.

**The queue names.** Everything here enqueues to `axon_triage`,
`axon_structure`, `axon_content`, `axon_adjudicate`, `axon_explain`. The pgmq
queues that exist are `mastery_*`. The rename reached the repo and never
reached the database. `eval-run` in particular would create an `eval_run` row,
mint `extraction_run` rows, reset every page of the paper to
`structure_status = 'pending'`, and only then fail to enqueue — leaving
orphaned queued runs for the sweep to fail ten minutes later, having run no
pipeline at all. It is not a usable acceptance-check path in its current state.

All the pgmq queues are empty, including the archives. pgmq is vestigial here.

## So what should someone do with this directory?

Not delete it blindly — the Stripe functions here **are** live. But every
pipeline function in it is now a stale second copy of something that has a real
home in `axon-backend`, so treat it as documentation of a previous
implementation and make the change there. A change made here reaches production
never, not "only if someone also does it upstream".
