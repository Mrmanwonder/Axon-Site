# AXO-188 upload rollout

The browser keeps an issued key and confirmation state for each page, mask, thumbnail and original. PUT URLs are never persisted. An interrupted transfer is checked against the canonical object before replacement capabilities or byte retransmission. Fresh-row IndexedDB transactions apply independent completions together and reject stale capture revisions, deleted rows and cleared student data.

Processing assets are scheduled first. PUT concurrency is 3, capability windows contain at most 32 objects and target 8 MiB, and a small booklet shares one window. A single asset larger than the byte target occupies its own window. The backend's existing 60-object and 25-MiB per-object limits, concurrency 8, staging/sealing and erasure cleanup remain authoritative.

## Rollout and rollback

The API's authenticated `/upload-policy` reads `UPLOAD_BATCH_PERCENT` and `UPLOAD_ORIGINALS_PERCENT`. Both default to 0 in Wrangler. Original deferral never exceeds the batch cohort. The cohort is stable per local draft and independent of optional analytics consent.

The browser preloads policy while the scanner is open. A policy older than 30 seconds or a failed load immediately selects legacy ordering, without waiting for a policy fetch at Send. Setting either percentage to 0 provides independent rollback within the policy freshness interval. Submitted originals continue to recover even after rollback.

Promote batch sending internally, then 5%, 25%, 100%, only after recording real send-to-submit p50/p95, failures, retries, auth failures, missing confirmations and duplicate handoffs. Promote original deferral separately after batch recovery is stable. Physical iOS/Android, actual HTTP/R2/Supabase performance and production cohort evidence remain release gates. Simulated transport measurements do not satisfy those gates.

## Original recovery

Submit freezes a complete processing manifest before POST. A lost response or queued=false retries the identical paper id, date, manifest and idempotency key. A reviewable accepted paper may explicitly retake a page; an uncertain submission cannot change its source.

After early submission, original bytes stay local through failed transfer, confirmation, attachment and review. A service-only RPC checks caller-selected paper scope, issued raw intent, canonical namespace, confirmed bytes and server ETag, current page number/capture revision and immutable association under the submit lock. An unchanged submit retry preserves a separately attached original; a true retake clears the old capture association.

A matching attachment receipt is persisted before local original bytes are released. Saved review drafts are deleted only when every original association is complete. Startup/online recovery and manual Resume reuse confirmed keys without another PUT. Sign-out, student change and erasure abort local jobs and cannot recreate removed drafts. Unfinished local work retains the existing 30-day retention period.

New captures persist ArrayBuffer bytes plus MIME and restore Blobs on read. This avoids the native Blob persistence failure reproduced in WebKit CI. Legacy Blob drafts remain readable.

## Controlled reference

`node bench/upload-reference.mjs` executes the archived pre-batch ingest/upload functions and the new real send scheduler against virtual shared bandwidth, RTT jitter, 4-ms persistence and deterministic connection loss. It covers 1/5/10/25 pages, mixed optional files, five network profiles and concurrency 2/3/4/6, with 21 samples per combination. JSON output and CI artifacts disclose assumptions.

The transport model does not include physical device memory/CPU, TCP dynamics, real R2 sealing, actual database write latency or production failures. Concurrency 3 remains provisional pending those measurements. No absolute production SLO or rollout promotion is claimed.

### Recorded reference result

Controlled model, 10-page paper with all four assets; p95 seconds across 21 deterministic samples:

| Network | Archived serial | Batch, concurrency 3 | Processing first, concurrency 3 |
| --- | ---: | ---: | ---: |
| Fast Wi-Fi | 9.86 | 7.46 | 1.40 |
| High-latency Wi-Fi | 21.69 | 12.37 | 4.11 |
| Typical 4G | 43.68 | 35.63 | 5.44 |
| Throttled uplink | 177.47 | 161.72 | 23.21 |
| Lossy 4G | 44.63 | 36.48 | 6.27 |

The typical 4G model reduces send-to-submit p95 from 43.68 s to 35.63 s with batching alone, and to 5.44 s when originals are deferred. Originals remain retained until independently attached; the latter figure measures processing handoff, not completion of the backup. These results are simulated, and do not establish production SLOs. See `bench/results/axo-188-reference.json` for every sample profile and assumption.

### Validation and deployment evidence

Client validation at `7b825d53bb9e960075fb5c015bc233aee21ecf8f`: [CI run](https://github.com/Mrmanwonder/Axon-Site/actions/runs/37221790610) passed build/typecheck, 222 Node tests, 291 UI tests, 19 DB harness tests, 198 browser tests (22 intentionally skipped), 42 accessibility tests, all SQL suites and contract parity. A separate zero-retry run passed all 24 targeted recovery tests in Chromium and WebKit.

Backend [PR 156](https://github.com/Mrmanwonder/axon-backend/pull/156) merged and [main deployment](https://github.com/Mrmanwonder/axon-backend/actions/runs/37221951090) passed, including the API worker. The CLI-allocated migration `20261004171548_axo188_original_attachment.sql` was applied to the live database; its ledger version is `20261004174820` under the same migration name. Live privileges confirm neither anonymous nor authenticated browser roles may execute the attachment RPC, while service_role may. Both rollout percentages remain 0.
