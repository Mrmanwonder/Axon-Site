# AXO-188: establish the upload baseline
This first change instruments the existing serial upload path before scheduling changes. It does not enable batching or early submission.

## Event contract
A send attempt emits exactly one terminal custom event: `paper_send_completed` when `paper-submit` accepts it, or `paper_send_failed` if that handoff fails. Processing and review time are excluded. A response with `queued: false` is accepted but recorded honestly; it is not reported as queued.

The optional PostHog callback checks the existing separate analytics consent each time. It accepts only the two send events and allowlisted aggregate numeric fields. It never supplies student/paper/draft/run ids, object keys, presigned URLs, filenames, exception messages, answers or academic text. Normal PostHog SDK context remains subject to the existing privacy configuration.

Durations in milliseconds: send-to-ingest, paper creation, planning, upload intents, PUT transfers, confirmation, IndexedDB persistence, submit, and send-to-acceptance. Failed handoffs record send-to-failure rather than claiming an acceptance time. Serial stage durations sum across pages. Retries count actual network retries in the upload/API transport, not attempts guessed from error text.
Object counts and bytes report the supported assets present in the local draft by page/mask/thumb/raw kind. These are booklet composition counts, not claims that bytes were transferred on this attempt; already-uploaded pages can be reused. Failure classification is coarse and does not include raw error text.

## Current evidence
Inspected Site main 4ea6fbe3eb33b642d189115dc64a0f02b80d6c44 and API main ce2d5c4a7c9ff4d846199c7ff18c85890def0992. The current flow has one intent and confirmation per page, with both pages and their assets uploaded serially. Confirmation seals presigned staging objects into immutable canonical objects and verifies issued ledger ownership and sizes; these controls must remain.

PostHog project 620121 matches axonstudy.online and the app's public project key. Catalog access was denied because the connection lacks data_catalog:read. No historical production upload timing baseline, production p50/p95 SLO, bandwidth-floor improvement, or rollout evidence is claimed.

The local workspace became unresponsive during the next implementation phase. Draft transaction/revision and batch scheduler edits there remain unpublished and unvalidated. This PR contains only the reviewable baseline instrumentation reconstructed against the verified remote main.

## Remaining acceptance gates
- Run measured reference and device/network scenarios for 1/5/10/25 pages; compare actual scheduling implementations at concurrency 2/3/4/6.
- Implement deterministic per-asset plans, monotonic recovery, atomic local mutations, windowed concurrency and resume-before-retransmit.
- Verify cancellation, offline/reopen recovery, auth refresh, stale retake/reorder/delete completion, and old draft compatibility.
- Add authority-checked post-submit original attachment, then measure any backend ledger optimization before selecting it.
- Keep batching and early-submit disabled until integrity/security checks and reference improvements pass.
- Stage internal → 5% → 25% → 50% → 100% with production latency/reliability evidence at every promotion and retain rollback.
- AXO-188 stays In Progress until the issue's measured performance, security and rollout criteria are satisfied.
