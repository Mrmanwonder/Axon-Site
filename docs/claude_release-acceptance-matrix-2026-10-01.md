# Release and scanner acceptance matrix — 2026-10-01 (AXO-11, AXO-23)

Evidence taxonomy, used in every row and every Linear comment:
- **Automated**: CI or emulated browser, with a run id or spec name.
- **Real device**: device, OS, browser, version, date, tester.
- **Not run**: no evidence; nothing is claimed.

Release candidate for this round: Axon-Site `main` at the merge of [Mrmanwonder/Axon-Site#165](https://github.com/Mrmanwonder/Axon-Site/pull/165), and axon-backend `main` at the merge of [Mrmanwonder/axon-backend#143](https://github.com/Mrmanwonder/axon-backend/pull/143). **Multi-page scanner → processing rows must not run before the AXO-116 fix is deployed;** otherwise they will measure a known page-loss bug.

## A · Automated rows (what CI and emulation already prove)

| Row | Evidence | Status |
|---|---|---|
| Chrome desktop · critical smoke | Playwright `chromium` project, all `tests/e2e/*` on every PR/main; Site main CI run `36895297123` green | Automated ✓ |
| iPhone Safari (emulated iPhone 13, WebKit) | Playwright `webkit-mobile` project, same suite, same run | Automated ✓ (**emulation, not a phone**) |
| Android Chrome (emulated Pixel 7) · light / dark × motion default / reduced | `tests/e2e/release-matrix-modes.spec.ts`. Per cell: OS theme is the theme painted, **no red in UI chrome** (probe ignores `[data-ink]`; probe verified to flag an injected red control), no running animation under reduced motion, no horizontal scroll. 4/4 pass locally on Chromium 1194, 2026-10-01 | Automated ✓ (signed-out landing only) |
| Accessibility | `npm run test:a11y` (axe) in CI | Automated ✓ |
| Offline shell + cached paper | `production.spec.ts` (Chromium Service Worker) | Automated ✓ |
| Scanner viewfinder / lifecycle | `camera.spec.ts`, `scanner-viewfinder.spec.ts`, AXO-107 lifecycle regressions | Automated ✓ (fake camera) |
| Scanner reliability arithmetic | `bench/scanner-reliability.mjs` (+ tests) validates trial data and computes p50/p95, timeouts, auto-capture, false captures | Automated ✓ (tooling only; no physical data) |
| Safari desktop | none: Playwright WebKit ≠ Safari | **Not run** |
| Light/dark/reduced motion on signed-in screens (Home, Library, scanner overlays, dialogs, settings, legal) | none yet | **Not run** |

## B · Real-device protocol (BLOCKED-ON-HUMAN)

Use the existing physical scanner protocol for acquisition trials: [`docs/qa/scanner-reliability.md`](qa/scanner-reliability.md). Record trials in its JSON schema and run `node bench/scanner-reliability.mjs <trials.json>`. Failed trials stay in the denominator.

**Devices (minimum):** one mid-tier Android (≤ ₹20k, Chrome stable), one iPhone (Safari, iOS current-1), one desktop Mac (Safari), one desktop Chrome.

### B1 · Release smoke (AXO-68/69/71): per device, in light, dark, and in-app Reduce motion

1. Sign up with email OTP. Then sign out and sign in with Google OAuth (desktop + one phone). Confirm **no Apple sign-in surface** appears anywhere.
2. Parent verify/consent screens → plan → create a student profile (board, class, subjects). Edit the curriculum: change stage and confirm the syllabus code re-maps.
3. Enter Student Mode, then switch sibling. Confirm Parent Mode confirmation appears for the switch.
4. Library: search by subject and by an answer phrase. Open a paper, then a question page. Open Insights with fewer than 4 papers and confirm the honest "not enough data yet" state.
5. Guardian actions: share a paper link and revoke it; delete a question (consequence sheet; no "are you sure").
6. Settings → Reduce motion on: sheets/loaders don't animate. Settings → local data cleanup: confirm cached papers are removed.
7. Every screen: no red except **Sign out** and teacher ink in scans; marks ≤ 28px; no score or percentage on summaries.

### B2 · Scanner → processing → review → commit (AXO-70; after the AXO-116 deploy)

1. A 1-page and a ≥ 6-page marked paper (one with parts (a)/(b) under several questions, one with a question continuing across a page break).
2. Capture → processing screen → "Needs your eyes" opens the actual review items → correct one mark, one answer, one "Not why I lost it" → commit.
3. Check: every page is structured (no "could not read" on a readable page); the continued question shows both page bands; corrections show up; the teacher mark you corrected reads exactly what you typed.

### B3 · Scanner acquisition matrix (AXO-45/46/47): per device

Trials per [`docs/qa/scanner-reliability.md`](qa/scanner-reliability.md): framing (full / partial / off-frame), motion (still / hand shake / walking), lighting (daylight / indoor warm / low / glare), autofocus breathing, desk clutter (false-positive check), background → foreground, pinch zoom, mode switch Auto ↔ Manual, upload fallback. Check that there's never a second live stream, and that no stale async start captures a new surface.

### Results table (fill per run; one row per device × scenario)

| Date | Tester | Device | OS | Browser + version | Mode (light/dark/RM) | Scenario | Acquisition ms | Dropped frames | Pass/Fail | Linked bug |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

## C · Thresholds for closing (AXO-48)

Use the budgets already proposed in [`docs/qa/scanner-reliability.md`](qa/scanner-reliability.md), so there's one set of numbers, not two:
- acquisition p95 ≤ 3000 ms, with timeouts kept in the denominator;
- correct Auto capture within 10 s in ≥ 95 % of capture-ready trials;
- zero false captures, and zero false locks on hard negatives;
- ≥ 20 trials per device × scenario.

One addition for the CLAUDE.md performance floor: 60 fps on the mid-tier Android during lock, measured as dropped frames in the results table.

These remain **proposed** until Tanmay accepts them. Every failure becomes a linked child bug, gets fixed, gets a regression test where automatable, and is re-tested on the device.
