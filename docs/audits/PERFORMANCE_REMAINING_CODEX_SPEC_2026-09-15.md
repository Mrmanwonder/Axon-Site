# Axon Performance Completion Spec — Remaining Work for Codex

**Date:** 2026-09-15  
**Repos:** `Mrmanwonder/Axon-Site`, `Mrmanwonder/axon-backend`  
**Goal:** Make Axon feel effectively instantaneous on repeat visits, make cold start visibly responsive immediately, and keep every finite interaction animation at or below 280 ms without weakening security, consent, provenance, or pipeline durability.

> “Zero load time” is not physically achievable across a network. The implementation target is instead: paint something truthful immediately, serve cached evidence instantly when safe, remove avoidable round trips, and keep remaining network work off the critical rendering path.

---

## 0. Work already completed — DO NOT REDO

The following changes are already implemented on the performance branches and should be treated as the new baseline.

### Axon-Site branch: `perf/snappy-load-2026-09-15`

- `public.bootstrap_current_user()` Supabase RPC added and already applied to production. It is `SECURITY INVOKER`, preserves RLS, and returns guardian + oldest student + subjects in one request.
- `src/ui/data/AppProvider.tsx` uses that RPC instead of guardian -> student -> subjects serial reads.
- Library paper and progress reads start concurrently.
- Cached library data paints before fresh network data when present.
- `src/ui/data/useAnalytics.ts` paints cached analytics before fresh network refresh.
- Home and Library no longer render blank/false-empty states during reads.
- Root renders a truthful boot shell instead of `null`.
- Onboarding is lazy-loaded.
- All non-Home routes are lazy-loaded in `src/ui/app/routes.tsx`; QuestionDetail/KaTeX are no longer part of the initial Home route chunk.
- `font-display` is now `swap`.
- Production sourcemaps are disabled.
- `src/ui/styles/performance.css` enforces the shipping motion budget.
- Custom JS springs have hard maximum durations; press = 140 ms max, tab = 260 ms max.
- HTML now emits CDN-specific short-cache/SWR headers while browser HTML remains revalidated.
- The duplicate permissive `pattern_insight` SELECT policies were merged into one equivalent policy and the migration is already applied to production.

### axon-backend branch: `perf/snappy-io-2026-09-15`

- Upload-intent validates all objects first, bulk-inserts upload-ledger rows, and mints independent signed PUT URLs concurrently.
- Upload-complete uses bounded concurrency for R2 HEAD checks and DB confirmations.
- Page asset signing is concurrent.
- Explanation queue fan-out is bounded-concurrent.
- Signed private asset responses use `private, max-age=300, immutable` while signature TTL remains 600 seconds.
- HMAC key import is reused per Worker isolate and refreshed automatically when the secret value changes.

Do not replace these with weaker generic “optimizations”. Preserve all hard rules, RLS, ownership checks, consent authority, queue durability, and provenance guarantees.

---

# P0 — Measure and finish the startup path

## P0.1 Add first-party RUM and explicit startup marks

### Files
- `src/ui/main.tsx`
- `src/ui/data/AppProvider.tsx`
- `src/ui/pages/Home.tsx`
- new: `src/ui/lib/perf.ts`
- optional Supabase migration if storing metrics server-side

### Required marks
Capture at minimum:

1. `axon_document_start`
2. `axon_react_mount`
3. `axon_session_restored`
4. `axon_bootstrap_start`
5. `axon_bootstrap_end`
6. `axon_shell_painted`
7. `axon_library_cache_painted`
8. `axon_library_fresh_painted`
9. `axon_analytics_cache_painted`
10. `axon_analytics_fresh_painted`
11. route-chunk fetch duration for lazy routes

Collect Web Vitals:
- LCP
- INP
- CLS
- TTFB
- FCP

### Privacy requirements
- Do not send paper text, question text, student answers, names, email/phone, identifiers unnecessary for aggregation, or signed asset URLs.
- Generate an ephemeral/session correlation ID if needed.
- Respect the existing analytics/consent model. Do not make telemetry an exception to consent.

### Acceptance criteria
- DevTools Performance panel shows named marks/measures.
- One dashboard can separate cold first visit, warm repeat visit, authenticated Home, Library navigation, and Scan entry.
- p50/p75/p95 are available by device class and broad region, without student content.

---

## P0.2 Establish hard performance budgets in CI

### New files suggested
- `scripts/check-motion-budget.mjs`
- `scripts/check-bundle-budget.mjs`
- `perf/budgets.json`
- authenticated Playwright/Lighthouse harness under `perf/`

### Required checks
1. No finite CSS transition or finite keyframe animation may exceed **280 ms**, including delay + duration for staged entrance animations.
2. JS spring configs must expose and respect `maxDurationMs <= 280` for interactive motion.
3. Initial Home JS must have a checked compressed-size budget.
4. KaTeX must not appear in the initial Home chunk.
5. Scanner pipeline modules must not appear in the initial Home chunk.
6. Build must fail when a route accidentally becomes eagerly imported into the root route table.

### Starting budgets
These are release gates, not promises about every network:
- useful shell visible: <= 300 ms on the agreed throttled test profile
- authenticated warm-cache Home useful content: <= 500 ms p75 lab
- mobile p75 LCP target: <= 1.5 s after infrastructure tuning
- mobile p75 INP target: <= 150 ms
- CLS: <= 0.05
- finite motion: <= 280 ms

If a budget is initially missed, record the baseline and ratchet downward. Never delete the check to make CI green.

---

# P1 — Reduce the remaining frontend payload

## P1.1 Split `system.css` by route/feature

### Current issue
`src/ui/styles/system.css` contains styling for Home, Settings, scanner/review, question detail, onboarding, sheets, etc. Route-level JS is now split, but most route CSS is still paid up front.

### Files
- `src/ui/styles/system.css`
- `src/ui/styles/app.css`
- `src/ui/styles/shell.css`
- `src/ui/styles/performance.css`
- route entry components under `src/ui/pages/`
- `src/ui/onboarding/Onboarding.tsx`
- `src/ui/scan/ReviewSheet.tsx`

### Implementation
Extract into at least:
- `styles/common.css` — primitives shared by most screens
- `styles/home.css`
- `styles/library.css`
- `styles/question.css`
- `styles/scan.css`
- `styles/review.css`
- `styles/insights.css`
- `styles/settings.css`
- `styles/onboarding.css`

Import feature CSS from the corresponding lazy route/module so Vite emits CSS alongside that chunk.

### Rules
- Do not duplicate token declarations.
- Keep `performance.css` as the final shipping override or move its relevant overrides next to each feature while retaining one global duration contract.
- Avoid FOUC on route navigation.

### Acceptance
- Home cold-load CSS transfer is materially lower than baseline.
- No visual regression at 320, 390, 768, 1024, 1440 px widths.
- Lazy route CSS loads only when the route is entered.

---

## P1.2 Lazy-mount ReviewSheet and other scan-only shell code

### Files
- `src/ui/shell/AppShell.tsx`
- `src/ui/scan/ReviewSheet.tsx`
- `src/ui/scan/ScanProvider.tsx`

### Goal
A student opening Home should not parse/mount review UI that is only needed during scan review.

### Implementation options
Preferred: lazy-import `ReviewSheet` and only mount it when `reviewOpen === true`. Use a minimal Suspense fallback that does not flash over the current route.

Also inspect shell imports for any other scan-only or Settings-only modules that remain eager after route splitting.

### Acceptance
- ReviewSheet chunk is absent from initial Home network waterfall.
- Opening review for the first time remains responsive and does not lose review state.

---

## P1.3 Optimize TabNav without deleting the visual identity

### File
- `src/ui/shell/TabNav.tsx`

### Current expensive work
- synchronous `getBoundingClientRect()` measurement
- SVG displacement-map/lens generation
- per-frame transform/filter updates
- font-ready and breakpoint remeasurement

### Required changes
1. Cache tab rectangles until actual geometry changes.
2. Use `ResizeObserver` to invalidate geometry instead of measuring blindly on every route change.
3. Reuse generated lens/displacement resources by width/height/DPR key.
4. Keep animation writes to compositor-friendly properties where possible.
5. Never interleave layout reads and writes inside the same animation frame loop.
6. Add a frame-budget fallback: if multiple frames exceed budget, temporarily use a simpler pill transform without filter/squash until idle.
7. Reduced-motion path should reposition directly with no displacement animation.

### Acceptance
- No forced-layout warning during normal tab navigation after initial measurement.
- 60 fps target on agreed mid-tier Android profile.
- Lens still looks like Axon; do not replace it with a generic underline.

---

# P1 — Collapse remaining read waterfalls

## P1.4 Create a single library snapshot RPC

### Current code
- `src/papers.js`: `listPapers()` + `paperProgress()`
- `src/ui/data/AppProvider.tsx`

### Problem
The two calls now execute in parallel, which removes the waterfall, but they are still two browser-to-database requests. `paperProgress()` also asks for multiple runs and chooses the newest one per paper in JS.

### New RPC
Create an RLS-preserving `SECURITY INVOKER` RPC, e.g.:

`public.library_snapshot(p_student_id uuid)`

Return one row/object per paper with:
- paper fields required by Home/Library
- page count
- committed-attempt count
- latest extraction-run status and timestamps

Use SQL `DISTINCT ON`, lateral join, or `row_number()` to select the newest run in PostgreSQL.

### Security
- Never accept arbitrary student ownership merely because the UUID was supplied.
- The underlying RLS/security-invoker behavior must prevent cross-account reads.
- Add regression tests proving guardian A cannot obtain guardian B’s snapshot.

### Acceptance
- Initial library refresh uses one Data API/RPC request.
- Result matches existing list + progress behavior for queued, processing, review, ready, failed and committed papers.
- Realtime refresh still updates live statuses accurately.

---

## P1.5 Combine Home analytics reads after measuring

### Current code
- `src/ui/data/useAnalytics.ts`
- analytics functions exported from `src/papers.js`

Four analytics reads are now parallel and cache-first at the Home surface. Measure before changing.

If network request count remains material, add a `home_analytics_snapshot(p_student_id uuid)` RPC returning:
- readiness
- loss by cause
- needs-check summary
- unreadable-page summary

Do not combine if it creates a single slow query whose p95 is worse than the current parallel requests.

### Acceptance
- one request is faster at p75/p95 than four parallel reads on realistic data volume
- hard rule 3 filtering remains in the database/view layer
- no unsure/rejected evidence leaks into aggregate analytics

---

## P1.6 Generalize safe stale-while-revalidate caching

### Current issue
`src/cache.js` `readThrough()` remains network-first globally. The critical Home/Library surfaces now explicitly seed from IndexedDB first, but other offline-safe reads still pay network latency before showing cached data.

### Files
- `src/cache.js`
- `src/papers.js`
- consumers under `src/ui/`

### Implement an explicit API, not a blanket behavior change
Example:
- `readNetworkFirst(...)`
- `readStaleWhileRevalidate(...)`
- `readCacheOnly(...)`

### Never use SWR for
- consent authority
- destructive-operation authorization
- fresh Parent Mode/fresh-auth decisions
- entitlement checks where stale Pro access could expose gated data
- live pipeline state if stale state would mislead the student

### Good candidates
- committed historical paper detail
- static-ish subjects/catalog data
- previously computed non-sensitive display metadata

### Acceptance
Every cache caller explicitly declares its consistency mode. A code review should be able to see which reads may be stale without reading implementation internals.

---

# P1 — Cloudflare / edge work requiring dashboard access or measured rollout

## P1.7 Verify actual zone/proxy path before changing cache rules

The code now emits:
- browser `Cache-Control: public, max-age=0, must-revalidate`
- CDN-specific `max-age=300, stale-while-revalidate=86400`

### Dashboard verification checklist
1. Confirm `axonstudy.online` DNS record is proxied through Cloudflare.
2. Confirm responses actually contain `CF-Cache-Status` and Cloudflare is in the serving path.
3. Confirm `/index.html` is generic and contains no user-specific data.
4. Verify `Cloudflare-CDN-Cache-Control` is honored.
5. After two requests, expect edge caching behavior appropriate to the rule/header.
6. Ensure deploy workflow purges or naturally invalidates HTML within the intended 5-minute freshness window.
7. Never “cache everything” for Supabase/API endpoints or signed private assets at the shared edge.

### Recommended HTML edge behavior
- browser: revalidate every navigation
- edge: 5-minute fresh TTL
- stale-while-revalidate: up to 24 hours for origin trouble

Do not cache authenticated JSON or student-specific HTML at shared edge scope.

---

## P1.8 Enable/verify transport optimizations

In Cloudflare dashboard, verify and record:
- HTTP/3 enabled
- Brotli enabled
- Zstandard compression enabled where supported
- Early Hints enabled

The HTML now sends a Link preload for the Onest font. Verify Early Hints actually emits a 103 response in a real trace before claiming benefit.

### Acceptance
Capture response headers / waterfall evidence in the PR or release ticket. “Toggle is on” is not enough.

---

## P1.9 Do NOT blindly enable Smart Placement on the current combined API Worker

### Why
`mastery-api` does two different jobs:
1. browser -> Supabase/API orchestration, which may benefit from running near Supabase
2. signed R2 asset proxying, which should stay fast for the student and R2 path

Smart Placement on one combined Worker can improve one workload and harm the other.

### Required experiment
Measure p50/p75/p95 separately for:
- `/paper-submit`
- `/upload-intent`
- `/upload-complete`
- `/review-complete`
- `/page-asset-urls`
- `/asset/...`

Then compare default placement vs Smart Placement in a controlled rollout.

### Preferred architecture if results diverge
Split `mastery-api` into:
- `mastery-api`: DB/API orchestration; candidate for Smart Placement near Supabase
- `mastery-assets`: signature verification + R2 fetch only; keep optimized for reader/R2 latency

Share the HMAC verification module and secret. Preserve signed-URL format or version it cleanly so old links do not break during rollout.

---

# P1 — Backend Worker reductions still available

## P1.10 Replace per-upload confirmation UPDATEs with one secure RPC

### Current state
`workers/api/src/index.ts` now checks R2 objects concurrently, then performs bounded-parallel update calls for valid uploads.

### Remaining opportunity
Add a service-only or otherwise tightly authorized RPC accepting a JSON array of verified upload facts:
- paper_id
- r2_key
- bytes
- etag
- sha256

Perform all updates in one transaction.

### Security
Only the Worker service role should be able to assert that R2 HEAD verification succeeded. Never expose an authenticated-client RPC that can mark arbitrary uploads confirmed.

### Acceptance
A 25-page upload performs one DB confirmation call after R2 checks instead of 25 updates.

---

## P1.11 Use Cloudflare Queue batch send only if current runtime typings/docs support it

### Files
- `workers/api/src/index.ts`

Current code uses bounded-concurrent `send()` calls. If the installed Workers runtime supports `sendBatch`, use it for explanation fan-out in chunks within Cloudflare limits.

Do not guess the API. Confirm against the installed `@cloudflare/workers-types` and Wrangler version first.

### Durability invariant
A successful HTTP response must not claim queued work unless the queue accepted the messages or the database has a durable recovery state that sweep/retry can resume.

---

## P1.12 Consider returning queue state directly from `submit_paper`

### Current path
`paperSubmit()` calls `submit_paper`, then reads `extraction_run.status`, then potentially queues and calls `run_advance`.

Investigate changing the RPC return payload to include all queue-decision state needed by the Worker, removing the follow-up status SELECT.

Do not combine queue-send acknowledgment into a database fiction. The DB cannot truthfully say a Cloudflare Queue accepted a message before it happened.

Acceptance: one fewer Supabase round trip without weakening the durable-ACK design established in the backend security/reliability audit.

---

# P2 — Supabase topology and indexes

## P2.1 Do not add a read replica yet solely for capacity

The current dataset is small and database execution times observed during the audit were not the primary startup bottleneck. Browser-to-region request count was the larger issue.

Only evaluate a replica or region migration after RUM shows geographic RTT remains a dominant p75/p95 cost after the request-count reductions above.

### Decision process
1. Collect RUM by broad user region.
2. Compare RTT to the Seoul primary.
3. Measure which requests are eligible for replica routing. Remember Auth, Realtime and Storage may not all follow Data API replica routing.
4. Estimate cost and operational complexity.
5. Test in non-production before topology change.

If the majority of real users are closer to a different primary region, evaluate primary-region migration as a separate high-risk project. Do not infer audience geography from developer location or a few test sessions.

---

## P2.2 Leave managed Stripe advisory findings alone

Current Supabase performance advisor reports an unindexed FK in Stripe-managed schema and many unused-index informational notices.

Rules:
- do not modify Stripe-managed schema unless Supabase/Stripe integration docs explicitly require it
- do not mass-drop indexes based on “unused” at this data volume
- revisit public-schema unused indexes only after enough production workload statistics exist to distinguish truly redundant write overhead from simply-low traffic

---

# P2 — Prefetching for perceived instant navigation

## P2.3 Intent-prefetch likely next routes

Once route splitting is stable, prefetch a lazy route when intent is strong:
- pointer hover/focus on desktop
- `pointerdown`/touch start where safe
- browser idle for the most likely next route after Home

Do not preload every route immediately; that recreates the original bundle problem under a different name.

Candidates:
- Home -> Library
- Home -> Scan
- Library row -> PaperOverview
- PaperOverview question -> QuestionDetail

Use network-awareness where available; avoid speculative heavy prefetch on data-saver/very slow connections.

---

# Verification matrix

For every performance PR, test at minimum:

| Scenario | Required outcome |
|---|---|
| Signed-out cold load | Onboarding chunk loads only after gate conclusion; no blank white/black frame |
| Returning signed-in cold load | Boot shell paints immediately; one bootstrap RPC determines guardian/student/subjects |
| Warm repeat Home | Cached library/analytics can paint before fresh network data |
| Offline with prior cache | Historical safe data stays readable and is labelled stale/offline |
| Offline with no cache | Honest unavailable/error state; never fake zero/empty data |
| Home -> QuestionDetail | KaTeX downloads only when needed |
| Home -> Scan | scanner chunk downloads only when scan is entered |
| Library realtime update | Status changes without manual reload |
| Sign-out in another tab | current tab exits signed-in UI |
| Reduced motion | effectively no motion and no delayed hidden content |
| Normal motion | all finite motion <= 280 ms |
| Cross-account RPC attempt | zero foreign rows; RLS isolation intact |
| Free account cross-subject insight | still blocked at DB/RLS |
| Pro cross-subject insight | still readable |
| 25-page upload | no serial 25x R2/DB waterfall |

---

# Rollout order

1. Merge/deploy the current frontend and backend performance PRs after CI passes.
2. Record fresh RUM baseline for at least cold vs warm authenticated Home.
3. Split global CSS and lazy ReviewSheet.
4. Add library snapshot RPC.
5. Add performance CI budgets.
6. Tune TabNav using frame traces.
7. Verify Cloudflare edge/transport settings and real cache headers.
8. A/B Smart Placement; split asset Worker if API and asset latency prefer different placement.
9. Only then evaluate Supabase topology.

---

# Rollback requirements

Every optimization must be independently reversible.

- Database RPC additions: additive first; old read path remains available until new path proves stable.
- RLS policy rewrites: keep exact semantic regression tests for free/pro and ownership behavior.
- CDN HTML caching: disable edge rule/header without changing browser revalidation behavior.
- Smart Placement: one-config rollback.
- Worker batching/concurrency: feature constant or small isolated helper, not a pipeline rewrite.
- CSS splitting: no token duplication; reverting route import should restore prior styling.

Never solve a performance regression by weakening authorization, caching consent, exposing signed private assets publicly, skipping provenance, acknowledging queue work before durability, or inventing UI data while a read is pending.

---

# Definition of done

This performance program is complete when:

- startup has no avoidable serial browser-to-region waterfall
- repeat visits display safe cached evidence before network freshness work
- initial Home bundle contains only Home/shell-critical code
- route-specific CSS is not globally shipped
- all finite interaction motion settles in <= 280 ms
- authenticated mobile p75 Web Vitals meet the agreed budgets or have documented network-bound exceptions backed by RUM
- Cloudflare cache/transport changes are proven by headers/traces, not just dashboard toggles
- no performance optimization weakens Axon’s RLS, consent, hard-rule, provenance, or queue-durability invariants
