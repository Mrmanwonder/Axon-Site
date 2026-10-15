# AXO-276 — remediation and acceptance ledger

Audit started 2026-10-13 UTC (14 October IST). **Release verdict: NOT TESTED / not certified.**
This ledger accompanies source remediation, not production sign-off. No real-device,
screen-reader, field Web Vitals, authenticated live timing, or scanner success-rate
claim is made. The master issue must remain In Progress until every required gate
has evidence. No residual risk in this document has been accepted on the owner's behalf.

## Reproducibility and ownership

| Baseline | Revision / evidence |
| --- | --- |
| Axon-Site main, fetched and compared locally | `5121adf4e81b1c33ae3e6aad73e808e02ef53d28` plus PR #305 `dd8fc09f8a21e8266ae9410c6ac151c68107fe64` |
| axon-backend main, fetched and compared locally | `773893edf4def6133862f60e78f83c0da06b844c` |
| Baseline frontend workflow | [38425273896](https://github.com/Mrmanwonder/Axon-Site/actions/runs/38425273896): application and clean SQL jobs successful; eval gate skipped on main |
| Baseline backend workflow | [38425313391](https://github.com/Mrmanwonder/axon-backend/actions/runs/38425313391): tests, dry runs, intelligence and extraction deployment jobs successful |
| Frontend currently deployed version | NOT VERIFIED: Netlify connector search returned no accessible Axon project; production HTTP blocked |
| Backend currently running version | NOT VERIFIED: successful historical deployment is not a current health/version response |
| Threshold failure | [38425287076](https://github.com/Mrmanwonder/Axon-Site/actions/runs/38425287076), fetch/check step failed, load step skipped. The issue records subsequent recovery; no new live recovery run was triggered here. |
| Execution environment | Linux container; synthetic local fixtures, Chromium/WebKit where available; exact test results below |
| Production browser access | Two attempts returned HTTP CONNECT 403 from the environment proxy; app/API/Auth hosts absent from configured allowed hosts. Trial access was supplied but was not used or copied into artifacts. |
| Supporting skills | `a11y-debugging` and `debug-optimize-lcp` were referenced by the issue but not present in the available skill catalog or searched filesystem; no claim of running those skills. |

Existing ownership was read before implementation. [AXO-18](https://linear.app/axon-26/issue/AXO-18)
and [AXO-24](https://linear.app/axon-26/issue/AXO-24) remain In Progress (program and audit process).
[AXO-67](https://linear.app/axon-26/issue/AXO-67) and
[AXO-189](https://linear.app/axon-26/issue/AXO-189) remain In Progress for physical-device
performance/scanner evidence. [AXO-222](https://linear.app/axon-26/issue/AXO-222) and
[AXO-232](https://linear.app/axon-26/issue/AXO-232) are Done reports, not proof their residual
acceptance gates passed. [AXO-244](https://linear.app/axon-26/issue/AXO-244) is Done;
F-01/F-04 are confirmed follow-up correctness findings in that implementation, tracked here.
No Done ticket was reopened, no duplicate issue was created, and existing blocked prompt
or branding PRs were not used as release evidence or modified.

## Finding ledger

All source rows use the baseline above and the accompanying PR's head as the after-revision.
Deployed SHA and physical device/browser/network evidence are **unknown** unless explicitly
reported. Tests use non-personal fixtures. PASS below is scoped to the stated automated
behavior, never to the complete issue-level production criterion.

| ID / owner | Reproduction / prior result | Source change / verification | Acceptance and outstanding evidence |
| --- | --- | --- | --- |
| F-01 / AXO-276, AXO-244 | Home with papers: reject next-action, due, focus, progress or flags; a shared promise previously removed every practice card. Reject preferences/targets even though Home didn't consume them. | Independent `useResource` state/retry per card; last-good values carry visible stale copy; flags fail closed. Removed redundant Home preferences/targets reads (TargetGrades owns these). `home-practice-resources.test.tsx` covers each dependency, recovery, timezone failure and late profile response. | Automated source behavior covered. Authenticated offline/wake/rapid profile switching on actual mobile remains NOT TESTED. |
| F-02 / AXO-276 | Open a filter with ArrowDown; selected-option focus/navigation previously absent. | Focused listbox, active descendant, arrows/Home/End, typeahead, Enter/Space, Escape, Tab/Shift-Tab through trigger-relative order, scroll and pointer handling. `app-dropdown.test.tsx`. | Keyboard/pointer regression covered. Real screen-reader/browser pairing remains NOT TESTED. |
| F-03 / AXO-276 | Force Storage.getItem SecurityError during Root gate render: exception previously escaped. | Guarded session read; absent storage continues normal gate, an existing cleanup failure still wins. `root-storage.test.tsx`. | Synthetic forced-error/absent-storage/recovery tests covered; physical private-mode browser remains NOT TESTED. |
| F-04 / AXO-276, AXO-244 | Timezone write -> next-action -> six reads formed a waterfall and coupled errors. | Calendar-dependent reads share the timezone write, then proceed independently; flags start immediately. SQL `due_queue`, `focus_areas`, `next_best_action` each call `ensure_error_items`; `sync_error_items` holds an advisory transaction lock. Timezone ordering is retained deliberately, not guessed away. | Source scheduling corrected. No current cold/warm p50/p95, degraded-network or production DB contention measurement. |
| F-05 / AXO-276 | Correct evidence while preserving paper ID/totals; signature alone previously left Insights unchanged. | `useResource` accepts a refresh revision while retaining last-good data. Insights and syllabus use library successful-read revision, wake/reconnect and 60-second visible-page polling. Tests cover unchanged totals, no ordinary-rerender refetch, recovery and profile isolation. | Evidence-only changes converge within one visible polling interval, subject to network availability. `mark_loss_event` is intentionally unpublished; no sensitive WAL feed was added. Multi-device production propagation remains NOT TESTED. |
| F-06 / AXO-67 | Idle import in `useIngestion.tsx` loads scanner for non-scanners; Save-Data/2g guard already exists. | Idle import replaced by pointer/focus intent on Scan and marked scan actions, with event-time Save-Data/2g/offline checks. Camera permission and draft initialization remain demand-only. | NOT TESTED: idle vs intent vs demand bytes/CPU/memory/tap-ready on fast, slow and metered devices. No benefit/regression numbers invented. |
| F-07 / AXO-67 | Permanent will-change on cards, rows, buttons, sheets and navigation. | Removed static transform hints from ordinary cards, rows and buttons. PressBox promotes only during a press and releases the hint and identity transform on settlement. Navigation/refraction and active sheet layers retain their specialized hints. | NOT TESTED: long-list layers/paint/GPU memory and physical low/mid-tier motion traces. |
| F-08 / AXO-276, AXO-67 | Sheet 440/300ms conflicted with 280ms finite-motion policy. | Sheet entrance 280ms, exit 240ms; React dismissal uses matching 240ms. `audit-motion.test.tsx` verifies timing, callback and immediate reduced-motion dismissal. | Source policy mismatch corrected. Interrupted-motion, real FPS/dropped frames and actual-device video remain NOT TESTED. |
| B-01 / AXO-276 | Missing/forged Content-Length allowed unbounded `req.json()` in mastery-api. | Backend streamed byte cap: 256KiB metadata, 100,000 bytes Tutor, 10s read timeout. Typed 413/415/408; malformed JSON remains existing 400 contract. Unit and actual API-boundary tests, including cancellation, chunking and multibyte bytes. | Bounded shared boundary covered. Full public-API schema/privilege audit and adversarial production smoke remain NOT TESTED. |
| B-02 / AXO-276 | Promise.race rejected but provider/database operations could continue. | Backend per-delivery AbortSignal and client; timeout includes initial heartbeat; abort precedes retry. Signal reaches five paid-model workers and provider fetches, prevents inline retry/late DB requests, and terminal recording receives a fresh budget/client. Timeout and model tests. | Cooperative cancellation only: cannot undo a DB statement already committed, guarantee provider billing cancellation, or cancel R2/Queue bindings. Existing lease/fencing/outbox/dedup tests remain necessary; worker-crash/redelivery and cost proof in production NOT TESTED. |
| B-03 / AXO-276 | CSP contains script/style unsafe-inline and scanner Wasm allowances. No XSS exploit reproduced. | Replaced script unsafe-inline with the SHA-256 hash of the before-paint preference script. Build verifies exact source/generated hashes and parity of both deployment policies. Inline styles remain necessary for React geometry, KaTeX and scanner; Wasm/worker allowances are retained. The scanner fixture externalizes its executable script; its development-only HMR preamble is removed when testing the production policy. | Local production landing/auth-start and scanner CSP tests accompany the change. Live OAuth/recovery, deployed headers and production violation reports remain NOT TESTED. |
| B-04 / AXO-276, AXO-262 | Transient discovery timeout killed ingest; route replacement could downgrade previously verified records. | Three attempts, exponential jitter, numeric Retry-After bounded by source budget; named timeout/HTTP/network/source-drift errors. Per-route/component no-downgrade SQL, no deletion of missing/ambiguous routes. Workflow summary records complete/partial/stop. Python failure/recovery tests and PGlite preservation test. | Synthetic source/retry/SQL behavior covered. Socket timeout is per blocking read; overall deadline checked between reads (possible overshoot by one socket timeout). Live Cambridge recovery/current workflow remains NOT TESTED. |
| B-05 / AXO-18, AXO-24 and existing domain owners | Broader backend review was not complete in original audit. | Boundary inventory and existing automated suites reviewed; fresh Supabase advisor snapshot below. No grants, live schema, billing, retention or production data changed. | NOT TESTED as a full security/quality certification: live scope/guardian/billing, migration effects, R2/DLQ/retention, provider evals, dependency/deploy parity. |

## Boundary inventory and safe fixture coverage

- Browser routes: `/`, `/library`, paper/question detail, `/scan`, scan review,
  `/insights`, journal/syllabus, `/practice/:sessionId`, `/settings`, `/tutor`,
  `/share`, privacy/terms/cookies and invalid routes. `src/ui/app/paths.ts` and router
  are authoritative. Authentication/recovery/profile/consent gates live in Root/AppProvider.
- Home/Library/Insights, filters, dialogs/sheets, target grades, practice, review,
  source crops, tutor and onboarding have UI/browser fixtures in `tests/ui`,
  `tests/browser` and `tests/e2e`. Fixtures cover empty/populated, failed reads,
  student profiles, offline retention, review flags, permission denial and lifecycle.
  These are synthetic, not disposable production fixtures.
- Scanner ownership: browser capture/conditioning in `src/scan`; server triage,
  structure, crop, content, reconcile, adjudicate, explain, API and sweep in backend.
  Intelligence/document-vision use their own D1/service boundaries. Old Site pipeline
  Edge Functions are historical, not production scanner code. Current Site Edge Functions
  handle Stripe/billing. No prompts or scanner contracts changed.
- Database ownership: Site migrations/tests are canonical for student scope/RLS,
  consent ledger, practice/analytics views, work journal, stage outbox, R2 deletion,
  threshold provenance and retention. Successful local harness tests do not prove live parity.
- API: `/paper-submit`, `/paper-retry`, `/paper-originals`, `/upload-intent`,
  `/upload-complete`, `/review-complete`, `/explain-retry`, `/page-asset-urls` use
  256KiB shared metadata JSON cap; `/tutor` uses 100,000 bytes. `/upload-policy`
  does not parse JSON. Signed asset GET and guardian provider callbacks are separate
  contracts (callback authentication/body handling requires its own acceptance).
- Backend `workers/*/wrangler.*` declares queues, DLQs, SELF_QUEUE, R2 originals/derived,
  intelligence/document-vision service bindings, D1, cron/sweep and version identifiers.
  Client authorization stays in student-facing API/RPCs; service-role clients stay server-side.
- External boundaries: Supabase Auth/REST/realtime, Cloudflare API/R2/queues,
  Gemini provider/auth, Tavily public grounding, Stripe, guardian verification,
  Netlify deploy/CDN, analytics and curriculum sources. Mocked tests do not establish
  health, credentials, access enforcement, or privacy compliance of those providers.

## Live read-only advisor snapshot

Supabase security advisors, observed `2026-10-13T19:38:11.783Z`: zero ERROR groups;
28 informational RLS-without-policy findings, two anonymous SECURITY DEFINER warnings,
34 authenticated SECURITY DEFINER warnings, and leaked-password protection disabled.
These are not 65 proven vulnerabilities or a clean security bill. Existing owning security
work must review intended deny-to-client tables, each RPC's authority and revocation,
and the password-login decision. No blanket grants/revocations were attempted.

References: [RLS without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[anonymous privileged RPC](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated privileged RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Phase 4 production/device acceptance

Each row requires UTC timestamp, exact deployed frontend/backend versions, fixture ID
(non-personal), browser/version/device/viewport/network, steps, expected/actual,
redacted trace/screenshot, sample count, p50/p95/p99 where meaningful, owner and verdict.
At least 20–30 safe repetitions per critical path; cold/warm separate. UI acknowledgment,
network completion and durable completion must be timed separately.

| Required gate | Verdict | Evidence needed to change verdict |
| --- | --- | --- |
| Navigation/auth/onboarding/profile/deep links and rapid/pending actions | NOT TESTED live | Authorized trial browser flows across desktop/mobile |
| LCP/FCP/INP/CLS, critical waterfall, fonts/chunks, long tasks | NOT TESTED live | Lighthouse + DevTools cold/warm signed-out/in traces; lab/field separated |
| Action acknowledgment <=100ms p95 where immediate feedback is possible | NOT TESTED | Input-to-visible timing, per-operation completion SLOs after baseline |
| Motion/refraction/sheets/onboarding/camera overlay | NOT TESTED on devices | FPS/frame pacing, interrupted/reduced motion, timestamped video |
| Accessibility | NOT TESTED for live acceptance | Keyboard + real screen reader, accessibility tree, contrast/tap/zoom/error announcements |
| Responsive/device matrix | NOT TESTED on physical devices | 320/360/390/428, tablet/desktop, low/mid/high Android and iPhone Safari, themes/insets/orientation |
| Large Library/Insights and cross-device changes | NOT TESTED live | Search sample distributions, evidence freshness, cache/profile/realtime correctness |
| Physical scanner reliability | NOT TESTED | 20 trials/scenario from `scanner-reliability.md`, multi-page/glare/skew/low-light, no lost/duplicate pages, memory/latencies |
| End-to-end ingest/data correctness | NOT TESTED live | Interrupted upload, offline retry, stale token, partial failure, tab lifecycle and cross-device conflict |
| Security/privacy smoke | NOT TESTED live | Isolated authorized profiles, RLS negatives, expired shares/logged-out assets/deletion/PII-free telemetry |
| Post-release monitoring | NOT TESTED | Release/deploy parity, queue/DLQ/cost/deletion monitoring and 24h/7d follow-up |

## Rollback and release conditions

Frontend remediation is stacked on PR #305; landing separation is a separate PR on
that remediation. Backend remediation targets main independently. Revert in reverse
stack order. Deploy `20261015094822_insight_snapshot.sql` before the frontend that
calls it. The additive SECURITY INVOKER RPC retains RLS and uses only existing
analytics views. The additive migration was applied on 15 October before the
authorized frontend merge; its filename matches the live migration ledger.
The apply operation and ledger read succeeded, but post-apply SQL verification
was blocked by management-connection timeouts. Roll back frontend callers
before dropping the RPC. Backend rollback restores prior body/deadline behavior.
No prompts or model configuration change. Threshold
SQL is still applied atomically by the existing loader; source failures before output do not
emit partial SQL. A rollback cannot recover grade data intentionally replaced after validation;
retain source/version provenance and review any explicit revocation separately.

Do not merge/deploy solely because checks pass. Before production acceptance: verify exact
candidate CI, stage both changes, verify running revisions, run the live/device matrix,
record before/after measurements, and resolve or explicitly accept remaining P2 risks with
an accountable owner. AXO-276 remains the single consolidated ledger.

## Verification results

Final command outcomes and PR revisions are recorded in the PR descriptions and AXO-276
alongside this ledger. Local logs contain only synthetic fixtures; live credentials were
never supplied to a process while access was blocked. Deployment evidence is recorded
separately from production acceptance below.


## Follow-ups requested on 14 October 2026

- Sign out remains red. Paper/question/draft/account delete controls and destructive
  confirmation buttons use red and a decorative hazard triangle, retaining text names.
  Product guidance and the old contradictory AGENTS colour rule are reconciled.
- Generic concurrent GET sharing keys all normalized request headers, including tuple
  headers and authority. Consent has dedicated sharing, invalidated before and after
  writes; reads crossing a write reject rather than returning an obsolete grant.
- `insight_snapshot(uuid)` consolidates the four evidence reads and five syllabus reads
  into one RLS-preserving SQL transaction/browser RPC. Shared in-flight work is scoped
  by student and local-data epoch and never retained after settlement. Database tests
  cover 1,005 attempts, excluded rows, another student's id, anonymous denial, and
  explicit field projection. This belongs in the site's database migrations, not a
  new backend proxy; Cloudflare runtime ownership is unchanged.
- Corner radii now use one 2/4/6/8/12/16/20/24/32px scale, plus round corners and the
  existing responsive card/measured nav geometry. CSS font declarations, clamp bounds
  and inline chart/list sizes use whole pixels with a 12px minimum. Circles and
  calculated switch geometry retain their shape.
- Home's exam countdown remains at the top. Paper rewards establish a live baseline
  (including an empty library), and then acknowledge newly ready papers once per
  profile. Streak milestones are 1, 3 and each 7 completed practice days, require fresh
  evidence of practice today, and are remembered per profile/day. Stale results and
  sibling switches cannot trigger them. Markers follow local-data cleanup.
- Separate landing entry defers router/AppProvider/Supabase until Continue; stored
  sessions, deep links, blocked storage and auth/recovery callbacks take the app path.
  Offline-shell installation is also deferred, so it cannot secretly preload the app
  behind the public landing. Application assets remain included for offline reopening.
  Production initial JS: 212 KiB raw / 69 KiB gzip versus PR #305's 648 / 196 KiB.
  These are build byte counts, not a field LCP claim.

Local verification completed before the environment resumed: 710 UI tests; database
suite 144 tests plus 10 syllabus Python tests; 26 exam Python tests; backend shared
471 tests and worker suites 88/18/11/137 tests; backend typechecks, generated binding
checks and all 11 Worker dry runs. Subsequent focused additions cover the consent
race and shared snapshot. Final browser and command outcomes are recorded with the
PRs. Initial browser failures exposed footer contrast, omitted fixture styles, stale
colour/radius expectations and dev-only CSP injection; these were corrected before
rerunning. Physical device and actual screen-reader evidence remain outstanding.

Production retry at 04:37 UTC on 14 October still returned HTTP 403. Trial credentials
were not used or stored in files. No production data or schema had changed at that
checkpoint; the subsequent authorized migration is recorded below.

## Merge checkpoint — 16 October 2026 (Asia/Calcutta)

- Backend [#195](https://github.com/Mrmanwonder/axon-backend/pull/195) merged as
  `b79f21c1980c4180638ead242d80d58e1f526fde`. [Post-merge CI and every Worker
  deployment job passed](https://github.com/Mrmanwonder/axon-backend/actions/runs/38715260217).
  Deployment success does not certify live behavior or provider-cost outcomes.
- Frontend #306 merged into #305; [#305](https://github.com/Mrmanwonder/Axon-Site/pull/305)
  then merged to main as `75914a339d715aa99043ffabb2772df6f5cbf9f0` after
  [full CI](https://github.com/Mrmanwonder/Axon-Site/actions/runs/38716960611) and CodeQL
  passed at `5b6ecea7f09eef2bcfe9016be43826e1cca955c3`. The CSP checker now uses
  parse5, with five cases covering mixed-case tags and misleading attributes.
- The additive `insight_snapshot` migration was applied before frontend merge;
  application returned success and the live ledger confirmed version `20261015094822`.
  The filename matches that version. Direct post-apply management SQL timed out;
  [the production migration workflow](https://github.com/Mrmanwonder/Axon-Site/actions/runs/38804982248)
  subsequently passed and reported 174 ledger rows, zero pending migrations.
- Landing [#307](https://github.com/Mrmanwonder/Axon-Site/pull/307) now targets main.
  Its final merge/check outcome is recorded in that PR and AXO-276. One prior WebKit
  test exceeded its 30-second budget while doing six axe audits and screenshots;
  each viewport/theme now has an independent test/context/trace, with all assertions
  retained and the same timeout. The separate startup test checks deferred downloads
  and Continue under the production CSP.
- AXO-276 remains In Progress. Live authenticated behavior, running frontend revision,
  physical Android/iPhone camera trials, actual screen-reader use, live performance,
  provider cost/cancellation and the broader audit/monitoring gates remain unverified.
  Main-branch merges and synthetic browser checks do not certify these outcomes.
