# Axon UI artifacts and navigation latency — 30 October 2026

Tracking: [AXO-306](https://linear.app/axon-26/issue/AXO-306/fix-dash-like-ui-artifacts-complete-archive-drawer-and-reduce).
Baseline: Axon-Site `87a8bf720243fd105f609a340b3de61e98e1600d`.

## Verified causes and changes

The supplied About Axon screenshot shows text collapsed into tiny strokes. Live
inspection confirmed that the descriptions under Contact us, Copy support email,
Privacy Policy, Terms and Conditions and Cookie Policy render at **1px**, with a
1.5px line box. The cause is `system.css` subtracting 12px from `--fs-row2` in the
shared `.srow .lbl small` rule. At S/M/L sizes this produces 0/1/3px instead of
12/13/15px. The shared rule now uses the existing token directly. The separate
`.srow + .srow::before` row separators are retained and checked in the browser.

The annotated Home and Library screenshots match the inline drawings in
`EmptyArt.tsx`. Home's `fine-notes`, Library's `side-details`, `track` and
`accent-detail`, and the detached `field-line` paths are authored decoration.
They are removed at the SVG source, together with their unused CSS. Paper rules,
scan brackets, label slots, handles, cabinet edges and functional UI dividers
remain. The archive drawer previously consisted of a flat top, two open depth
strokes and a front face. It now has connected, closed back, floor, inner wall
and outer side paths, painted behind the front face with existing surface tokens.

Startup performed a serial guardian → student → subjects → curriculum → provider
→ live student-scope chain. Subjects, stages and the programme/provider branch
now start together after the student rows arrive. Live scope is read alongside
the profiles, and both results are required before an online student is selected.
Offline behavior, sibling ownership checks, outgoing-profile purges, scope writes,
live consent and failure states remain in their existing owners.

First visits to primary tabs also waited for dynamic imports after activation.
Routing and preloading now share one set of module imports. The shell warms the
small Home, Library, Insights and Settings modules 800ms after mounting; offline
and data-saving connections skip that background work. Hover/focus can preload
a particular destination. Scanner code stays intent-only. Imports do not mount
screens or start their data reads, camera, billing or account actions.

## Production-build measurements

Three cold-context samples per controlled comparison, Chromium headless on this
Windows machine; no CPU throttling. The backend is a deterministic mock, not a
claim about live-device speed. Both comparison runs block service workers so
the offline installer's asset cache cannot substitute for route preloading.

| Measurement | Baseline median | Patched median | Conditions |
| --- | ---: | ---: | --- |
| Returning Home with curriculum metadata | 2,275ms | 1,821ms | 150ms per account/data request |
| First Library navigation | 475ms | 246ms | 300ms Library JS delay, 1.6s Home dwell |

The first comparison removes two serial network waits. Regression assertions
require scope to start before student completion and programme/stage reads to
start before subjects finish. The second requires the Library import to begin
before activation; it also checks that Scan and billing reads did not start.
Both assertions fail against the baseline build and pass with this change.
The entry JavaScript remains 69KiB gzip under the existing bundle gate.

Read-only live service logs for the preceding 24 hours show additional backend
latency: guardian requests had about 829ms p95 (13 requests), and paper reads
about 836ms p95 (34 requests), with no 5xx responses in those samples. These
figures measure origin service time, excluding device/network/rendering time.
This patch reduces avoidable client waits; it does not claim to resolve that
remaining backend response time.

## Verification and limits

- `npm run typecheck` and `npm run build` pass, including configuration, bundle
  budget and script-CSP checks.
- `npm test`: 261 passed. `npm run test:ui`: 741 passed, including concurrent boot,
  failed scope, offline/multi-profile selection, profile isolation and complete
  profile mapping. Local CRLF fixture checkouts were read as LF for the existing
  byte-exact SQL/email tests; those files have no content changes in the patch.
- The production performance tests pass, as does the installed offline-shell
  and cached-paper reopen test in Chromium.
- Browser checks cover Home/Library empty states and Settings at 320×844,
  390×844, 667×375, 768×900 and 1280×900 in dark/light themes, S/M/L description
  sizes, retained separators, no horizontal overflow, keyboard focus and legal
  link navigation. Screenshots are captured per case.
- The nearby navigation semantics, Library search width and loading/empty
  regressions pass in Chromium and mobile WebKit (8 checks).
- The design detector reports existing unrelated system.css border/motion
  patterns; this patch preserves the incumbent UI outside the reported defects.

Responsive browser emulation is not a physical-device trial. No database/schema,
billing, consent or backend deployment changes are included. Deployment and
live acceptance of the patched build remain separate from local verification.

The first CI run passed the new checks but exposed a timing race in the existing
paper-difficulty drag test. Its trace sampled the reopened sheet while it was
entering and sent the drag below the viewport. The test now waits for a stable,
actionable slider before reading pointer coordinates. The original failure
reproduced locally; the corrected flow passed 12 repeated Chromium/WebKit runs.
The subsequent CI run exposed WebKit's active-page handoff after axe opened and
closed its temporary aggregation page. The test explicitly restores the original
page and targets its keyboard input at the slider; all 12 repeats pass again.
