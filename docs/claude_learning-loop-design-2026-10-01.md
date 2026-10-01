# Learning loop — design note (AXO-121)

Date 2026-10-01. Implementation: `supabase/migrations/20261001182000_axo_121_learning_loop.sql`. Tests: `supabase/tests/axo_121_learning_loop.sql` (18 assertions).

## Decision recap

Student reviews become evaluation signal **inside Supabase** (schema `learning`), written by triggers so no client path can skip them. Axon "learns" through better benchmarks and prompts. It never retrains automatically and never writes anything back to a student's paper.

## What fires

| Student action (existing UI) | Write it makes | Learning event |
|---|---|---|
| Fix a mark / answer in Review (`correctMark`, `correctAnswer`) | `question_region` field + new `student_confirmed_at` | one `field_corrected` per changed field |
| Confirm a question as read correctly (`confirmQuestion`) | new `student_confirmed_at`, no field change | `region_confirmed` (calibration negative) |
| "Not why I lost it" in Review (`rejectCause`) | `region_explanation.cause → null` | `explanation_rejected` with the rejected cause + prompt version |
| Confirm / reject a committed explanation | `mark_loss_event.student_confirmed_at / student_rejected_at` | `explanation_confirmed / _rejected` |

Pipeline writes never set `student_confirmed_at`, so a model re-read is never counted as a student correction.

## Minimisation and privacy

- **Free text** (question text, student answer, teacher remark) is recorded as `{"length": n}` only, enforced by a CHECK constraint. Marks and labels keep their values, because the eval needs them.
- **Identity.** `student_key` is HMAC-SHA256 of the student id. The key is generated inside Supabase Vault when the migration runs and never appears in Git or logs.
- **Consent.** The event is always written as an operational record. `learning.queue_item` rows, the only route to benchmarks or prompts, are created only while `improve_extraction` is granted. On withdrawal, every queued item for that guardian (or student) moves to `REJECTED` in the same transaction.
- **Deletion.** Events cascade from their region or mark-loss event, so paper deletion and erasure purge them (tested).
- **Access.** The schema isn't exposed. `anon` and `authenticated` have no USAGE, and only `service_role` reads. Aggregate views (`learning.correction_rate`, `learning.calibration`) are counts only, with no values and no pseudonyms.
- **Protected schemes.** Nothing here reads or stores marking-scheme text; Cambridge/Pearson content can't enter.
- **Teacher marks.** No `learning` function writes to `public.*` (asserted by the suite).

## Into evaluation

`queue_item` states `QUEUED → LABELLED → READY` are human-review gates. A `READY` `BENCHMARK_EXPANSION` item becomes a candidate golden case for AXO-41: a reviewer pulls the source region through the service role, writes the label, and adds a versioned case. `PROMPT_REGRESSION` and `ERROR_CLUSTERING` feed the per-prompt rejection rates in `learning.correction_rate`.

## The 10 corrected regions already in production

Read-only check, 2026-10-01: 10 corrected regions across 3 runs and 2 students, all with a review timestamp. 0 explanations have a cleared cause. There are 46 `improve_extraction` consent events.

These **can't be backfilled honestly.** The review overwrote the model's original reading in place, and no copy of the predicted value exists (`model_call` stores no outputs). Any backfill would have to invent the "predicted" side. The loop starts recording from the moment the migration is applied, and the first correction afterwards is the demonstration.

## Not done here (open on AXO-121)

- A "this helped" control on QuestionDetail for committed explanations. The data path exists; the UI and copy need a design decision.
- A weekly scheduled report. The aggregate views exist; scheduling plus a Batch summariser are not built.
- Making `eval_run` mandatory before a `model_route` change. Blocked on AXO-41's corpus.
- Retiring the D1 correction ledger in `axon-intelligence`. The tutor profile already 404s `/v1/corrections` (AXO-126).
- Consent copy accuracy. That's AXO-75, owned by the other workstream; a comment has been left there.
