# Eval evidence

`evals/runs/<eval_run_id>.json` is the committed summary of one finished eval run, exported from the
`eval_run` and `eval_result` rows. CI reads these because it cannot read the production database.
They hold model names, metrics and case ids. Never student text.

`harness/eval-gate.mjs` fails a pull request that changes `public.model_route` (which model answers, at
what thinking level, with which prompt version) unless the migration carries

```
-- eval-run: <eval_run_id>
```

and `evals/runs/<eval_run_id>.json` exists, is `kind: "eval"`, has `passed: true`, and lists every model the
migration names in `candidate_models`. Extraction may not be a release gate while its labels are drafts:
`release_gate_extraction: true` requires `human_labelled_extraction: true`.

An emergency rollback to a route that was already in service uses `-- eval-run: rollback <version>` and
`evals/runs/rollback-<version>.json` with `{"kind": "rollback", "restores": "<version>"}`. Nothing else is
waived.

Shape of an `eval` summary:

```json
{
  "eval_run_id": "uuid",
  "kind": "eval",
  "golden_set_version": "string",
  "created_at": "ISO-8601",
  "stage": "explain",
  "candidate_models": ["gemini-3.8-flash"],
  "baseline_models": ["gemini-3.1-flash-lite"],
  "human_labelled_extraction": false,
  "release_gate_extraction": false,
  "thresholds_ref": "AXO-44",
  "metrics": {},
  "passed": false
}
```
