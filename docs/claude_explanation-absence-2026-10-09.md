# AXO-168 explanation absence — 9 October 2026

Read-only owner-account aggregates found 20 confirmed attempts with 41 lost marks. Eleven attempts with 24 lost marks have no mark_loss_event. All eleven have a committed run, a positive question_region mark loss, explain_status=skipped, no region_explanation and no durable reason; five were student-corrected.

Historical skips cannot be conclusively divided between evidence withholding and earlier no-loss decisions followed by mark correction. No historical reason is invented or backfilled, and no paid model retry is performed. The current worker has separate no-loss and can_explain=false exits, but both formerly persisted the same bare skipped status.

The backend now records no_marks_lost or insufficient_evidence and a status timestamp before advancing. A missing region or failed write cannot claim a skip was persisted. Model prompts, routes, marks, loss-event generation and uncertainty gates are unchanged.

The Site paper list labels missing, failed and in-flight explanations on affected parts. Question details already admit an event-less loss; added regressions cover skipped, done, pending and unknown legacy states. Unread/full marks and unchecked unsure readings do not claim settled missing-loss explanations. Student-rejected events no longer count as a resolved explanation gap.

The snapshot is an aggregate audit, not a live owner browser session or evidence of academic correctness. Actual device verification remains part of the release matrix. Historical absent explanations remain honestly absent.
