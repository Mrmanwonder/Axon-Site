# Axon — master spec sheet (everything decided and built to 3 Oct 2026)

Written 2026-10-03 for Tanmay. It supersedes `claude_axon-build-spec-and-scanner-redesign-2026-10-03.md` where they differ, and it is the one place that lists every decision, what is built, what is proven, and what is waiting on you. `Axon.md` (repo root) is the rules file for agents; this is the status and plan.

Project target date: **15 Oct 2026**, defined by you (D17) as a **private beta of the core loop** (scan → read → explain → review), not a public launch.

---

## 1. Read this first

1. **The scanner is rebuilt, but it has not been on a real phone.** Everything below marked "verified" means: typecheck, unit tests, a Chromium browser harness with synthetic scenes, accessibility checks, and a production build. No physical Android or iPhone has run it. The detection engine is the public library at its default settings; I have not tuned anything, because tuning without your clips would be guessing.
2. **The clips are the next thing only you can do** (section 8). Until then the guidance thresholds are first guesses.
3. **Claude Code loads `CLAUDE.md` automatically, not `Axon.md`.** You asked for `CLAUDE.md` to be removed, so a fresh agent session will not read `Axon.md` unless told to. Recommended: a one-line `CLAUDE.md` containing `@Axon.md`. I have not added it; it is your call.
4. **Three things in `Axon.md` conflict with older documents and need your eye** (section 9): red usage, the curricula list, and the sign-in methods.

---

## 2. Decisions on record

| # | Decision | Where it lands |
|---|---|---|
| D1 | Model route: Gemini through Google AI Studio **paid tier**; retention declared in the policy (not "zero retention") | WP-F tutor, WP-K legal drafts; counsel decides final wording |
| D2 | Guardian verification provider work parked | No provider work; copy must not say "verified" while only "declared" exists |
| D5 | Close AXO-131 as superseded | Agent closes with a comment |
| D6 | One-day grace after a failed payment; INR and USD both | WP-U billing |
| D7 | Icons: Google Material Symbols | Built in AXO-137 |
| D3 | Answered in Linear | See the Linear issue it was raised on |
| D8, D10, D13 | Answered "yes" in earlier messages | Wording is in the earlier decision docs; not restated here |
| D9 | Contact: both mailto and a short form (with a copy-address fallback) | WP-D, AXO-133 |
| D11 | Sign-in: Google OAuth and email/password, both | WP-V; leaked-password protection needed (R-10) |
| D12 | No limit (as you answered) | WP-K: state plainly or say nothing |
| D14 | Start building | Done |
| D15 | Show the exam date if known; otherwise say explicitly the date is the upload date | AXO-154 (not built) |
| D16 | Your layout: top bar (drafts, Auto pill, ⋮), camera, strip, bottom bar; plus my dropped-paper stack; shutter shaped like the navbar capsule | Built |
| D17 | 15 Oct = private beta of the core loop | Plan baseline |
| D18 | Done goes straight to reading if every page is fine, otherwise Review | Built |
| D19 | Laptop import screen designed properly | Built |
| D20 | Page-drop animation: welcome | Built, 220 ms, none under reduced motion |
| D21 | Close ✕ top-left is fine | Built |
| D22 | Auto on by default | Built; shutter always live |
| D23 | No webcam option on laptops | Built; laptops get the import screen |
| D24 | Torch: Auto, On, Off, only where the device supports it | Built; hidden where unsupported |
| D25 (mine, needs your awareness) | A page is "flagged" only when its edges are unconfirmed or its quality verdict is a fail. A "warn" verdict is a note, not a flag | Built as proposed; tell me if you would rather flag warns |

D4 is not restated in the records I have; I will not guess its wording.

---

## 3. What is built (scanner), and the evidence

Branch `build/scanner-rebuild`, draft PR #189. Commits: `f836eda` Axon.md replaces CLAUDE.md · `f69e90c` detection rebuild · `1fb6946` scanner screen · `4286013`, `87b2b6f` docs cleanup (this spec is committed after them).

### 3.1 Detection (public library, default settings)
- **Engine:** scanic 1.6.0 ML (DocCornerNet LEAN model, ONNX Runtime custom wasm), loaded in a worker. Model assets live in `public/scan-ml/0.2.0/` (about 3.4 MB).
- **Lock:** a candidate becomes the page by whole-quad overlap with the previous frame (IoU) held over time, not per-corner tracking. This replaces the old per-corner tracker that you correctly found useless.
- **Guidance:** one reason at a time in a fixed priority (engine → dark → nothing found → cut off → small → shaky → blurry → glare → locked). A reason appears only when its own measurement trips.
- **Auto capture:** fires when the page holds; the shutter is always usable and never disabled by detection.
- **Torch:** offered only when the camera track reports a torch capability.
- **CSP:** `'wasm-unsafe-eval'` added so the ML runtime can start. This is a deliberate, narrow loosening; it needs your acceptance.

### 3.2 Camera screen (phone)
Top bar: ✕ close · Auto/Manual pill · saved-drafts icon (blue dot when something can be resumed) · ⋮ menu (Import photos, Use your camera app, Add a link, Saved drafts, Light Auto/On/Off when supported). Under the camera, a single guidance strip (neutral, blue when locked, amber with a dashed outline when a reason applies, one 44 px action when there is one). Bottom bar: dropped-paper stack with a count · capsule shutter (100 × 58, navbar geometry, blue rim when locked in Auto) · Done / Review.
- Done reads **"Done · N"** when all pages are fine; **"Review · N"** (amber outline) when any page needs a look.
- Review sheet: pages that need a look first, one honest reason each; per page Retake, Adjust edges (drag four corners on the original photo, starting from the detected quad), Options; footer "Retake page N" or "Read as it is".
- Camera blocked / unavailable / failed each say what happened and offer three ways forward: try again, use your camera app, import photos.
- No blur over live video; transform and opacity only; red appears nowhere on this screen.

### 3.3 Laptop import screen
Laptops (width ≥ 768, hover and fine pointer) never ask for a webcam. They get "Add a paper": a drop zone with a paper pile that lifts when files are dragged over it, Choose files, paste an image, a real QR code to continue on the phone, Add a link, Saved drafts, and a "This paper" card with thumbnails and Done/Review. Tablets (touch) keep the camera column.

### 3.4 Verification run on 3 Oct (all on commit `87b2b6f` or its parent)
| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npx vitest run` | 39 files, 263 tests pass |
| `npm test` (node:test) | 188 pass |
| Playwright (Chromium), whole suite, one worker | 98 pass, including 24 scanner-screen tests: per-state assertions, axe (WCAG), 44 px targets, no red on the screen, adjust-edges returns four corners, camera-blocked fallbacks, torch only when supported, drop animation 220 ms and absent under reduced motion, import screen at 1024 and 1440 px in dark and light with no sideways scroll |
| `npm run build` | pass; initial JavaScript 603 KiB raw / 182 KiB gzip, within the budget check; scanic and the model loader are lazy chunks |

Test substitutions you should know about: the browser harness replaces the camera with a canvas stream and the scan providers with fixtures. It proves layout, state logic, and that the real worker and detector run in Chromium. It does not prove camera behaviour.

### 3.5 Bugs I found and fixed along the way
White text on the old blue was 3.48:1 (below the 4.5:1 accessibility floor), so the scanner uses a deeper blue (`#2B6BE6`, 4.8:1) for filled controls. The corner editor painted everything outside the page opaque white because a global colour transition returned a stale colour; fixed. A global `.row` rule collided with the review list; renamed. The edge editor rebuilt on every render; fixed.

---

## 4. Known limits (not hidden)

1. **Real devices: none tried.** Android, iOS Safari, torch hardware, autofocus, background suspension, and 60 fps on a mid-tier Android are all unproven. Acceptance trials (AXO-152, formerly AXO-45/46/47/48/114) stay open.
2. **Overfill weakness.** When the page fills or overfills the frame, the ML sometimes returns a quad inside the page. The guidance avoids saying "move closer" in that case (it requires a measured edge), but the locked crop can be too tight. Adjust edges is the recovery. Needs the clips to quantify.
3. **Uploads are not cropped.** Imported photos are accepted as whole pages with geometry treated as confirmed; the import path does not detect or crop the page. Honest, but not as good as the camera path.
4. **PDF and HEIC imports are unsupported.** The import screen says photos only.
5. **Model licence.** The DocCornerNet weights' README says MIT; I have not independently verified provenance. Confirm before launch.
6. **3.4 MB of model files in the repository.** Fine for now; consider storage in a bucket later.
7. **Landscape phones.** The camera column is designed for portrait; landscape is not handled.
8. **Design-system-wide contrast.** The existing `.btn.primary` (white on `#3A86FF`) is below 4.5:1. I fixed only the scanner.
9. **Thresholds are first guesses** until the clips exist (`guidance.js`, tuning tracked in AXO-148 after AXO-145).
10. **The scanic editor module loads lazily on the main thread** when you tap Adjust edges.

---

## 5. Axon.md (replaces CLAUDE.md)

Written from the code as it is, the Constitution, and your decisions. Twelve sections: what Axon is, principles, hard rules, product today, architecture and ownership, design language, scanner, copy rules, how you want work done, checks, decisions on record, known inconsistencies. Precedence: Constitution, then Axon.md, then other docs; `src/ui/styles/` wins on design values. It keeps the four hard rules (never assign or dispute marks, never fabricate a scheme, unsure data never reaches analytics, fail visibly). The old `CLAUDE.md` was removed.

---

## 6. Rest of the product (unchanged by this session)

Carried forward from the earlier build spec: WP-B question counts (built, unproven in production), WP-C paper and review redesign (AXO-135/137 built; 136, 138–142 todo), WP-D contact and share auto-copy, WP-E pipeline close-out (needs a real retry, R-6), WP-F tutor behind a flag (reconcile privacy mode, R-5, counsel), WP-G model routing (needs your spend cap, R-2), WP-H learning loop audit, WP-I database security, WP-J guardian verification (parked), WP-K legal drafts (counsel decides), WP-L observability, WP-U billing (grace and INR/USD), WP-V auth (Google plus email/password). The full 76-issue map is Appendix A of the earlier spec.

---

## 7. Honest timeline to 15 Oct

| Agent can finish | Only if you unblock it | Will not make 15 Oct |
|---|---|---|
| Scanner tuning after clips, D15 exam-date label (AXO-154), WP-C remainder, WP-D, WP-I, WP-K drafts, billing grace and INR/USD, auth methods, tutor behind a flag | Device acceptance (R-7), signed-in production walkthrough (R-8), tutor beta (R-5) | Counsel-approved legal publication, tutor general availability, Postgres major upgrade, guardian provider |

The scanner's risk is no longer code volume; it is real phones. Three or four days of device and clip work will tell you more than another week of code.

---

## 8. What only you can do

1. **R-13: record the clips (the next step).** Use your phone's own camera app, video, 10 seconds each, a real marked paper (non-personal is fine). Cover: normal light, whole page in frame; page filling the frame; page small/far; night with only a desk lamp; warm indoor light; window light with a shadow; white paper on a white or light surface; paper on a dark surface; page partly out of frame; walking the camera onto the page; and negatives: empty desk, a wall, a laptop screen, a book cover. Attach them to the chat. I will keep them out of the repo unless you say otherwise.
2. **R-7: real-device trial** on one low-end Android, one mid-range, one iPhone (Safari): 10 captures each on the same paper, using the deployed branch.
3. **R-8:** signed-in production walkthrough (I can drive your signed-in Chrome; I will not type passwords).
4. **R-6 / R-9:** a real marked paper for the extraction audit and pipeline close-out.
5. **R-5:** tutor secrets and deploy approval, when you want the tutor beta.
6. **R-10:** turn on leaked-password protection (needed because email/password is kept).
7. **R-11:** counsel on the changed legal claims.
8. Payment provider plan IDs and a test key for billing.
9. Accept or reject: the CSP `'wasm-unsafe-eval'` change; the model licence check; D25.

---

## 9. Conflicts and inconsistencies to settle

- **Red.** `Axon.md` follows the old rule: red is for signing out only. An earlier spec said red is for teacher ink. Pick one; the scanner screen currently uses no red at all.
- **Curricula.** The code and catalog support Cambridge, CBSE and IB. The removed `CLAUDE.md` said Cambridge only, and `README.md` still does. `Axon.md` states the catalog as the authority.
- **Sign-in.** D11 says Google plus email/password; the old docs said OTP only. The auth work (WP-V) is not built, so the app and the decision currently differ.
- **Stale docs.** `README.md` and the top of `AGENTS.md` still describe an earlier state (listed in `Axon.md` §12).

---

## 10. Linear map

Parent **AXO-144** (scanner rebuild). Children: AXO-145 corpus (owner) · AXO-146 make failure visible · AXO-147 capture never depends on detection · AXO-148 detector (tuning after clips) · AXO-149 camera screen · AXO-150 laptop import · AXO-151 fallbacks · AXO-152 acceptance · AXO-153 docs and cleanup. Evidence comments with commit SHAs and test results are on each; statuses move only where the evidence supports it. Nothing is marked Done that has not been on a real device; implementation exists, so those items are **In Review**, not Done.

---

## 11. Suggested next 72 hours

1. Record and attach the clips (R-13). I tune detection and guidance against them and report numbers, failures included.
2. Once you are happy to run it on a phone (a preview deploy of PR #189, which I have not set up), try ten pages and tell me what feels wrong.
3. Decide the three conflicts in section 9 and the `CLAUDE.md` stub.
4. Turn on leaked-password protection (R-10).

I will not claim the scanner works on phones until a phone says so.
