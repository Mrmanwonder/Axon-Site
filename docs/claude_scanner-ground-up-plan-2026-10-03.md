# Scanner — ground-up plan

2026-10-03. Owner decisions applied: D15 (exam date vs upload date), D16 (your layout, with the paper stack and a navbar-shaped shutter), D17 (15 Oct is a private beta of the core loop), D18 (Done reads directly if every page is fine, otherwise Review), D19 (laptop import screen).
Design mock: `docs/design-preview/scanner.html` (10 states, dark and light). Nothing in `src/` has been changed yet.

Status words: **Verified** = I ran it or read the code and checked. **Unverified** = needs a real phone or data we do not have.

---

## 1. Why the current scanner "does nothing"

An agent traced the live path end to end, and I re-checked the key lines (`quad.js:257`, `edges.js:262-278`, `track.js:44-50`, `detect-worker.js:234`). Findings, ranked by how well they explain "never locks, hint never changes":

1. **The lock depends on a fragile corner tracker. Verified on the only real camera frames in the repo.** A lock needs the whole-page detector to agree twice, and then a per-corner local search to hold confidence ≥ 0.64. Each corner it cannot find loses 38 % of its confidence (`track.js:47`). On the two real phone-preview frames (`bench/fixtures/viewfinder-a/b.jpg`) only 11 % of frames were bracket-eligible, median confidence 0.42, and no Auto shot fired in 9 s. On clean synthetic pages it works. This is the mismatch: the code was tuned on clean fixtures.
2. **The "is it paper?" test is a hard brightness gate. Verified on perturbed copies of the repo's photos.** A page needs ≥ 90 % of 25 sample points with brightness > 120 and low saturation (`quad.js:257`, `edges.js:267`). At 0.6× brightness or a warm tint, detection fell from 7/7 to 1/6 or 0/6. Students study at night and under warm lamps, so this plausibly explains your phone. **Unverified on your lighting.**
3. **The whole page must be inside the frame with margin.** A page touching the frame edge gives the corner search nothing to find; one fixture filling the frame never locked.
4. **Silent failure points. Verified in code, not verified on a phone.** A thrown `createImageBitmap` is swallowed (`capture.js:718`, `:774`); `detect-worker.js` posts `workerError` but nothing ever listens to it. Either would leave "Fit all four page corners" on screen forever.
5. **The screen never says why.** The "can't find it" and "took a photo instead" states exist only in my mock. Searching shows one fixed sentence indefinitely.
6. **Smaller:** pinch-zoom silently disables lock and Auto; the post-shot check requires ≥ 1600 px on the long edge.

The existing automated tests all pass (132 pass, 0 fail) because they use synthetic or clean scenes. Passing tests were never evidence that real pages lock.

**One thing to confirm:** the sentence in your screenshot, "Hold the whole page inside the corners", exists only in my mock page (not in `src/`); the live app says "Fit all four page corners in frame". I am treating your screenshot as your layout reference, not a recording of the live app. If it was a recording of the live app, tell me the URL and build.

---

## 2. Principles for the rebuild

1. **Capture never depends on detection.** The shutter always works. Detection assists; it can fail without the student being stuck.
2. **Fail visibly, say why.** Every "not locked" state names one measured cause. Never state a reason that was not measured.
3. **Evidence before tuning.** No detector threshold changes without a real-photo corpus from real phones. Synthetic perturbations are a labelled stress set, never proof.
4. **No hard colour or brightness gates.** Brightness and tint become soft scores. Hard gates are geometric (convex, plausible angles, plausible size).
5. **A page is "fine" only on evidence.** Confident edges and a passed quality check. Anything else is flagged; nothing is silently dropped or guessed (CLAUDE.md rule 4).
6. **Design language:** blue = locked or primary; amber with a dashed outline and words = needs a look; no red; no blur over live video; transform and opacity only; 44 px targets; no exclamation marks; reduced motion honoured.

---

## 3. The target flow

```
Scan tab
 ├─ phone/tablet → camera screen (section 5)
 │    ├─ page found + holds still → Auto captures   (or the student presses the shutter at any time)
 │    ├─ still photo → find the page on the still (heavier, no time pressure)
 │    │     ├─ confident edges + quality passes → page is FINE → drops on the stack
 │    │     └─ otherwise → page is FLAGGED with one reason → drops on the stack, amber
 │    ├─ Done · N   if every page is fine → go straight to reading
 │    └─ Review · N if any page is flagged → review sheet
 │          ├─ Retake (opens camera, replaces that page)
 │          ├─ Adjust edges (still photo with four draggable corners)
 │          └─ Read as it is
 ├─ camera denied / unavailable → "Use your camera app" (file input with capture) + Import
 └─ laptop (primary pointer fine, hover, width ≥ 768) → import screen (section 6)
```

Limits and contracts carried over from the code: up to **25 pages**; accepted files JPG, PNG, WebP, HEIC/HEIF, PDF (`contract.js`); `source_kind` recorded as camera / upload / pdf / link; drafts survive an interruption (`drafts.js`).

---

## 4. Detection v2 (design; thresholds come from the corpus, not from this document)

Runs on a ~480 px proxy at ≥ 8 Hz in a worker, as today. What changes:

**4.1 Two independent evidence channels, fused**
- *Edge channel* (brightness- and colour-agnostic): gradient edges, line fitting, candidate quadrilaterals from four line groups; score from edge strength along the perimeter and how much of it is supported.
- *Region channel*: how different the interior is from the border/surround (colour distance from the frame border's median), plus a **soft** "looks like paper" prior (bright, low saturation, low texture) that scales the score instead of vetoing.
- A candidate is accepted when the edge channel is strong, or both channels are moderately strong. White page on a white desk relies on edges; page on a dark desk relies on both.
- Exposure normalisation first: stretch luminance between the frame's 5th and 95th percentiles so dim light does not change which pixels qualify.

**4.2 Lock from the whole page, held over time**
- A candidate becomes the tracked page by quad overlap (IoU) with the previous frame. Lock after N consecutive overlapping hits within a short window; lose lock only after several consecutive misses (no 700 ms latch, no per-corner decay).
- Corners are smoothed when overlap is high and jump when it is low. The per-corner local search stops deciding the lock; it may survive as optional sub-pixel refinement only if it beats plain smoothing on the corpus.
- Auto fires after the page holds still, or after a patience window (as now); the shutter is always live.

**4.3 Measured signals that feed the guidance strip (one reason at a time, fixed priority)**

| Signal | How it is measured | Strip text | Action |
|---|---|---|---|
| Too dark | luminance 95th percentile and median on the proxy | Too dark to see the page edges | Turn on light (only if the track exposes a torch) |
| Page small | largest page-like candidate vs frame | Move closer, the page is small | none |
| Page cut off | candidate edge touching the frame | Move back so the whole page fits | none |
| Shaky | frame difference | Hold still | none |
| Blurry | variance of the Laplacian | Hold still, the page is blurry | none |
| Glare | clipped-highlight share inside the candidate | Tilt the page to avoid glare | none |
| Nothing found for 6 s | timer with no candidate | Can't find the page edges | Take photo |

Exact numeric thresholds are set from the corpus and written into `contract.js` with the corpus version that justified them. Each text appears only when its own measurement trips; unit tests will assert that.

**4.4 On the still**
Shutter takes the highest-resolution still available (native still where supported, else the best video frame), then runs the heavier detector with the live quad as a prior. High confidence + quality pass → fine. No quad → flagged "page edges not found", and Review shows the whole photo with default corners the student drags.

**4.5 Candidate libraries.** AXO-114 proposed an OpenCV/jscanify contour detector. I will evaluate it against the corpus only after it exists, and weigh its download size (OpenCV.js is a large asset; measure before adopting, and load it lazily). Replace the current detector only if false accepts drop with no loss on real pages.

---

## 5. Camera screen (your layout, mock states 1–9)

**Top bar:** `✕` close · `Auto ●` pill (tap toggles Auto/Manual; the dot goes hollow in Manual) · spacer · drafts icon (blue dot when a draft exists) · `⋮` menu. *Deviation from your layout:* your layout has no way out, so I added `✕` on the left; everything else is as you drew it.

**Camera area:** only the four corner brackets and a faint level line. Nothing else over the paper. Brackets white while looking, blue when locked, hidden when there is no candidate. No blur, no glass.

**Guidance strip (under the camera):** neutral while looking, blue when locked, amber with a dashed ring when a reason applies; reason text from §4.3; one 44 px action button when there is one.

**Bottom bar:**
- **Stack (left).** Captured pages drop onto a small pile like papers tossed on a table: up to four visible, each at a fixed, slightly different angle, newest on top, showing the real captured page. A count badge. A flagged page has an amber dashed outline and the badge turns amber. Tapping opens the Review sheet. The drop is 220 ms of transform and opacity only, and none under reduced motion. It is the only motion in capture; it shows where the page went. *Needs your approval, since CLAUDE.md says capture gets zero decorative motion (decision D20).*
- **Shutter (centre), the navbar's shape.** Same geometry as `.tabbar`: 32 px-radius capsule, 5 px glass margin, 26 px-radius opaque pill inside; 100 × 58 px. Pressed: the inner pill scales to 94 % (transform only). Locked in Auto: the capsule rim turns blue. Never disabled by detection.
- **Done / Review (right).** `Done · N` (blue, filled) when every page is fine → reads directly. `Review · N` (amber outline) when any page is flagged → opens Review. Disabled with no pages. 48 px high.

**Review sheet:** lists only flagged pages first, with one honest reason each ("Blurry. Words may not read clearly", "Page edges not found", "Looks like page 2"); fine pages summarised ("The other 2 are clear"). Actions per flagged page: Retake, Adjust edges. Footer: primary `Retake page N`; secondary `Read as it is`.

**⋮ menu:** Import photos or a PDF · Add a link · Use your camera app · Saved drafts · Light (when supported).

**Permission and failure states (new):** denied/blocked shows what happened and the two ways forward (Use your camera app, Import) and a Retry button; today's blocked state has no retry.

**Copy:** no exclamation marks, no "score", no "are you sure".

---

## 6. Laptop import screen (mock state 10, dark and light)

Shown when the primary pointer is fine with hover and the width ≥ 768; a small link lets anyone switch ("Use this computer's camera" is optional and low priority). Content: left rail (the app's own); heading "Add a paper"; a large drop area with a paper-pile illustration that lifts when files are dragged over it (the border turns blue); "Choose files"; paste-an-image support; "Scan with your phone" card with a QR code to the Scan page; "Add a link"; saved drafts row. The QR in the mock is a placeholder; the real one is generated at build time from the site URL (no personal data in it).

---

## 7. Phases, in order

| Phase | What | Owner needed? | Acceptance |
|---|---|---|---|
| **S-0** Corpus | Record real phone clips (§9) → frames with hand-labelled page corners + negative clips. Agent builds the loader and labelling checks. | **Yes** (R-13) | ≥ 40 labelled frames across the scenarios; the corpus is versioned and never uploaded elsewhere |
| **S-1** Make failure visible | Surface worker errors; remove the swallowed catches; compute the §4.3 signals; add `?scandebug=1` overlay showing them. | No | A forced worker error and a forced bitmap failure each show a message; signals unit-tested on labelled synthetic frames |
| **S-2** Capture never depends on detection | Shutter always works; still-photo detection; fine/flagged model; Review sheet; Adjust edges screen | No | A frame with nothing detectable still yields a page that can be adjusted and read; no path loses a page silently |
| **S-4** Camera screen rebuild | React states for §5; stack; capsule shutter; strip; top bar; Done/Review rule; ⋮ menu | No | Component tests for each mock state; 44 px targets; axe clean; reduced-motion test |
| **S-6** Laptop import screen | Pointer-based routing; drag/drop; paste; QR; link; drafts | No | Browser tests at 1024/1440, dark and light; keyboard path; screenshots reviewed |
| **S-7** Fallbacks | Camera denied/unavailable; "Use your camera app" file input; torch where supported | No | Simulated denial, no-getUserMedia and no-torch cases covered in tests |
| **S-3** Detector v2 | §4 against the corpus | **After S-0** | Benchmark report on the corpus (found within 3 s, corner error, false locks on negatives); proposals below |
| **S-8** Acceptance | Re-scope AXO-45/46/47/48/114 to this design; automated checks; device trials | **Yes** (R-7) | Real-device numbers only; synthetic labelled separately |
| **S-9** Docs and cleanup | Update `CLAUDE.md` (in-app camera now ships), `docs/qa/scanner-reliability.md`; delete dead code | No | Doc says what is true |

Proposed detector targets (proposals, not agreed): reuse the existing proposed budgets: acquisition p95 ≤ 3000 ms; correct Auto capture within 10 s in ≥ 95 % of capture-ready trials; zero false captures; zero false locks on negatives. I will add: corner error ≤ 2 % of the short edge on locked frames. These will be revised once I see the corpus.

**Sequencing for 15 Oct:** S-1 → S-2 → S-4 → S-6/S-7 can all be done without you and make the scanner *work regardless of detection*. S-3 follows the corpus. Real-device acceptance (S-8) follows both.

---

## 8. How it gets tested (and what it cannot prove)

- **Corpus benchmark:** detection rate, corner error, time to lock, false locks on negative clips, run in Node and in the browser harness. Report per scenario; failures stay in the denominators.
- **Stress set:** brightness, tint, partial-page, shrink perturbations of the corpus. Labelled synthetic; it reveals fragility, it does not certify anything.
- **Signals and guidance:** unit tests that each reason fires only under its own measured condition.
- **Browser harness:** canvas-stream fixture through the real controller (as now), plus state tests for each mock state.
- **Cannot be proven here:** phone camera optics, autofocus, iOS Safari behaviour, background suspension, real performance on a mid-tier Android. Those need R-7 trials with real numbers.

---

## 9. What I need from you — R-13: record the corpus

Use your phone's **own camera app** (not Axon), video, **10 seconds each**, a real marked paper (non-personal is fine; a school test is fine). Hold the phone as you normally would for scanning. Clips:

1. Paper on your usual desk, normal room light, whole page in frame
2. Same, page filling the frame
3. Same, page small in the frame (far)
4. Night: only a desk lamp
5. Warm indoor light
6. Window light with a shadow across the page
7. White paper on a white desk or a light surface
8. Paper on a dark surface
9. Page partly out of frame
10. Phone moving (walking the camera onto the page)
11. **Negatives:** the desk with no paper; a wall; a laptop screen; a book cover

Attach them to the chat (or tell me which are too large and I will give another route). I will extract frames, ask you only if corners are ambiguous, and keep the files out of the repo unless you say otherwise.

---

## 10. Decisions still open

| # | Decision | Recommendation |
|---|---|---|
| D20 | Does the 220 ms drop of a page onto the stack count as acceptable (it shows where the page went), or should capture have zero motion? | Accept it; strip it if you disagree, it is one CSS class |
| D21 | Top bar: keep `✕` at the left as added, drafts to the right | Yes |
| D22 | Auto on by default? | Yes, with the shutter always live |
| D23 | Offer "Use this computer's camera" on the laptop screen? | No for now |
| D24 | When no torch is available (iPhone Safari), the strip just says "Too dark…" without an action | Yes |

---

## 11. Linear (recorded)

Parent **AXO-144** (related to AXO-11). Children: AXO-145 S-0 corpus · AXO-146 S-1 make failure visible · AXO-147 S-2 capture never depends on detection · AXO-148 S-3 detector v2 · AXO-149 S-4 camera screen · AXO-150 S-6 laptop import · AXO-151 S-7 fallbacks · AXO-152 S-8 acceptance · AXO-153 S-9 docs and cleanup. AXO-45/46/47/48/114 are re-scoped to S-8/S-3 rather than closed. AXO-90's note that the preview stays untransformed still applies.
