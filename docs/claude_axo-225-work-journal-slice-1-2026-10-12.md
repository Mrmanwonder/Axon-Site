# AXO-225 slice 1: durable checkpoints for paid model work (12 Oct 2026)

Status: implemented on branches, not merged, not applied, not deployed. Linear AXO-225 stays open; this is the first slice, not the ticket.

## The problem this slice removes

`private.sweep_stuck_runs` fails a stale run and resets its done pages to pending. The retry (`submit_paper`) starts a new `extraction_run`. Nothing carried the earlier paid answers across, so the retry paid for them again. The two failed 9 Oct runs cost $0.519419 of recorded model spend and left nothing reusable.

## What is built

**Axon-Site** (`feat/axo-225-work-journal`)
- `supabase/migrations/20261012180000_axo_225_paper_work_journal.sql`: `private.paper_work_item`, a journal of paid model outputs. Identity is paper + stage + unit + evidence digest + prompt digest + model + prompt version + schema version. There is no run id in it, so a new run never invalidates reusable work.
- Five service-role-only functions: `work_begin` (reuse / busy / run), `work_save_output` (lease-fenced, idempotent), `work_mark_applied`, `work_release`, `work_invalidate`.
- States used: `ready`, `leased`, `output_saved`, `applied`, `retry_due`, `invalidated`.
- Privacy: RLS on, no policies, no grants. Cascades with the paper. Saved answers are unreusable and purged after 14 days (on the next begin for that paper).
- Counters for AXO-201: `attempts`, `unknown_outcomes` (a lease expired with nothing saved; the provider may have billed), `reuse_count`.
- `tests/db/work-journal.test.mjs`: 12 tests on PGlite.

**axon-backend** (`feat/axo-225-checkpoint-callmodel`)
- `shared/src/checkpoint.ts` and a wrapper inside `callModel`. Any stage can opt in with `checkpoint: { unitKey, imageDigest }`. The wrapper adds the prompt, model, route version and schema (by content) to the identity itself.
- Wired for the `structure` (page) and `content` (question region) stages only. They need the device `sha256` of every page they read; with none, there is no checkpoint (a null is never a key).
- Off unless `WORK_JOURNAL=1` is set on the Worker. Merging changes nothing by itself.
- The raw model JSON is saved and re-validated on reuse. A saved answer the current validator refuses is invalidated and paid for again.
- A paid answer is never discarded because the journal could not be written (three quick tries, then carry on and log).
- `shared/src/__tests__/checkpoint.test.ts`: 9 tests. The structure-page column whitelist test now includes `sha256` and `preprocess_version`.

## Evidence (local, not production)

- Axon-Site `tests/db/*.test.mjs`: 89 of 89 pass (12 new).
- axon-backend: typecheck clean; shared 425 of 425 (9 new; 416 before), content 18, api 78; `wrangler deploy --dry-run` builds for structure and content.
- Not run: the full-stack `supabase db reset` suites, `check:contract-parity`, any real device, any production query. A migration file is not an applied migration.

## What this does not do yet (slice 2 onward)

- No transactional outbox or dispatcher; the queue is still the only wake-up.
- `sweep_stuck_runs` still fails the whole run and resets pages. The saving comes from the retry finding the paid answers, not from the sweep changing. Task-level recovery (revoke the lease, requeue only what expired) needs the dispatcher.
- No per-paper or global concurrency limits, no progress UI, no final manifest seal.
- Not wired: triage, adjudicate, explain (22% of the 9 Oct cohort cost, gated on student confirmation), topic tagging, scheme check.
- Invalidation is by key: changed pixels, prompt, teacher marks in the instruction, model, prompt version or schema all give a new key. Crop or mask generation changes are not visible to the key; bump `CONTENT_EVIDENCE_VERSION` in `workers/content/src/index.ts` when they change what the model is shown.
- Cross-page identity and student-correction invalidation use the same key rule; there is no explicit invalidation API beyond `work_invalidate`.
- A provider answer lost before `work_save_output` lands is paid for again. This is counted in `unknown_outcomes`; exactly-once billing is not promised.

## Rollout order (nothing below has happened)

1. Review and merge the Axon-Site PR. `migrate.yml` applies the migration on merge; then re-run the Supabase advisors and confirm no new warnings.
2. Merge the axon-backend PR and deploy structure and content with the flag still off.
3. Set `WORK_JOURNAL=1` on structure and content only. Run one authorized reference paper twice and read `reuse_count`, `attempts` and `model_call` rows.
4. Failure-injection runs on the deployed Workers (owed before closing AXO-225): kill after the answer is saved and before the downstream write; kill before saving; two workers on one unit; a retake of one page.
5. Rollback is `WORK_JOURNAL` unset. The table can stay.

## Savings evidence for AXO-201

A reused call writes no `model_call` row. Savings are `reuse_count` times `output_meta->>'costUsd'` on `private.paper_work_item`. Cost per correctly completed paper must still include the discarded calls, retries and `unknown_outcomes`.
