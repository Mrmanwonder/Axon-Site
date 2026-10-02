# Learning loop: Review-stage signals (AXO-121)

Date 2026-10-01. This builds on `20261001190000_learning_schema.sql` (#169, merged from a parallel session). That migration owns the `learning` schema: explanation verdicts on committed questions, consent at write, aggregates, and purges.

This delta (`20261001191000_learning_review_signals.sql`, tests in `supabase/tests/axo_121_review_signals.sql`, 13 assertions) adds the two signals #169 can't see, because they happen in Review before any `student_attempt` exists.

An earlier, separate `learning` schema on this branch was withdrawn (`c6b2b8c`) when #169 landed. Two schemas under the same name would have double-recorded.

## What the delta records

| Student action (existing UI) | Signal |
|---|---|
| Fix a mark or answer in Review (`correctMark`, `correctAnswer`) | `stage='extract'`, `kind='field_corrected'`, `field` = which field (enum), `confidence_before`, content prompt version |
| Confirm a question as read right (`confirmQuestion`) | `kind='region_confirmed'`, the negative that confidence calibration needs |
| "Not why I lost it" in Review (`rejectCause` clears `region_explanation.cause`) | `stage='explain'`, `kind='cause_rejected'`, the rejected cause and the prompt version |

These signals fire only on a new `student_confirmed_at` (every Review call sets it; the pipeline never does) or on a cleared cause.

## Same doctrine as #169

- Consent is read live at write time. Without `improve_extraction`, nothing is stored.
- **No text, no values.** `field` and `confidence_before` are enums. #169's "no free-text column" guard stays green, and a mark *value* isn't stored either.
- Purges: withdrawal (#169's trigger), student soft-delete (#169), and paper/question deletion (FK cascade on `region_id`).
- Aggregates gain a `field` dimension, so the per-field correction rate is readable. Groups under 5 stay unpublished.
- Nothing writes to `public.*`. A transcription correction never changes a teacher's mark.

## Production

Neither #169 nor this delta is applied yet; the live ledger ends at `axo_105_share_loss_reasons_allowlist`. The 10 corrections already in production overwrote the model's reading in place, and no copy exists, so they can't be backfilled without inventing data. Recording starts at apply.

## Still open on AXO-121

- The weekly report: aggregates and `signal_counts()` exist, but the report itself isn't built.
- Promoting reviewed signals into the AXO-41 golden set: needs the corpus.
- A mandatory `eval_run` before route changes.
- Consent copy (AXO-75, other workstream).
