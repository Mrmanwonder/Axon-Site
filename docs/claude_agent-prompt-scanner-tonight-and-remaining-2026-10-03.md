# Axon: agent prompt and plan. A working scanner tonight, then everything left

Written 3 Oct 2026 for the owner (Tanmay) to send straight to a coding agent. Standalone: the agent needs no other context than this file, the repo, and Linear.
Repo `Mrmanwonder/Axon-Site`, branch `build/scanner-rebuild` (draft PR #189). Backend `Mrmanwonder/axon-backend`. Linear team Axon-26, project Axon. Parent issue AXO-144.

---

## Part 0. How to use this file

Paste the whole file into the agent as its task. The agent works Part 4 in order, then Part 5 as time allows. Anything that needs the owner's hands, phone, dashboard or a legal decision is marked **BLOCKED-ON-HUMAN**; the agent prepares everything around it, states the exact ask, and moves on. Do not wait on a human step when other work is available.

If you are the agent: read Parts 1 to 3 completely before touching code. Then read `Axon.md` (it outranks every other doc except `Constitution/`), `AGENTS.md`, and the Linear issue for each task in full (description, comments, parent, children) before starting that task.

---

## Part 1. Mission and what "working tonight" means

**Mission.** The owner can take his phone, open the rebuilt scanner, photograph or import his marked papers, and get pages that are legible, cropped, and stored, without fighting the app. Then the rest of the open work is carried forward in priority order.

**Honest scope for tonight.** An agent cannot touch the owner's phone. "Working" is therefore proven in two layers: (a) automated evidence the agent produces itself, and (b) device evidence the owner produces by following Part 4 T1 and sending back a debug log. Never write "works on a phone" without (b).

### Acceptance gates (tonight)

| Gate | Statement | Proven by |
|---|---|---|
| G1 | The rebuilt scanner runs on the owner's Android phone (OnePlus CPH2447, Chrome), signed in, live camera on, no console CSP errors | owner steps in T1 plus debug log |
| G2 | A flat, lit A4 page taking 60 to 90 percent of the frame: lock within 3 s, Auto capture within 10 s, in at least 9 of 10 trials, with no shutter tap | debug log timeline from the owner's phone |
| G3 | When detection cannot find or confirm the page (page fills the frame, dim, shadow), the shutter still works, the page is flagged, **Adjust edges** opens on it, and the student can fix it in two taps and a drag | device trial plus Playwright test |
| G4 | No false lock and no auto capture for 30 s each on an empty desk, a plain wall, a laptop screen and a book cover | device log plus the corpus clips when they exist |
| G5 | Torch control appears only where `track.getCapabilities().torch` is true, with Auto / On / Off; where absent the strip says so | device log (capabilities dump) |
| G6 | Import works for JPEG, PNG, WebP, AVIF, GIF, BMP, HEIC/HEIF (where decodable), TIFF, and **multi-page PDF**, within the 25-page cap, with a visible reason for every refusal | automated tests with generated fixtures, then owner check with real files |
| G7 | Stored page images of handwritten answers are legible at 100 percent zoom (AXO-164) | owner checks on phone, agent checks sharpness metric |
| G8 | Done then Send reaches storage: every page's object exists (HEAD confirmed) and the paper row is created. Reading is a separate pipeline (AXO-116) and is not a tonight gate | agent query or owner screenshot |
| G9 | Laptop import screen: drop, choose, paste, QR work; no webcam option | Playwright |
| G10 | `npm run typecheck`, `npm test`, `npm run test:ui`, `npm run test:e2e` (Chromium locally, WebKit in CI), `npm run test:a11y`, `npm run build`, `npm run check:contract-parity` all green on the exact head; CI green on that head | CI link and local output |

G1, G2, G4, G5 and the device half of G3, G6, G7 are device-only. If the owner has not run them, they stay open and the report says so.

---

## Part 2. Ground rules (non-negotiable)

1. **Axon.md and AGENTS.md rule.** Four hard rules: the model never assigns marks; never fabricate a scheme; unsure data never reaches analytics; fail visibly. Provenance box on every extracted value.
2. **Secrets.** Never print, commit, paste into Linear or chat, or put in `VITE_*`, any key, database credential, token or share link. Share links are bearer tokens: do not repeat them.
3. **AXO-143** (rotate the database credential exposed in a migration-workflow log) is an owner dashboard action. The agent never handles the credential. After the owner rotates it, the agent may verify only non-secret state (workflow green, no old secret in logs) and says what it could not verify.
4. **No production changes without the owner's explicit yes in chat.** That covers: Supabase auth settings, migrations on production, `wrangler deploy` / `wrangler versions deploy`, DNS, Stripe. A *preview upload that is not promoted* is allowed only if the owner says yes (it publishes an unlisted URL).
5. **No accounts, no passwords.** Do not create real accounts or enter passwords. Test accounts against a local dev stack only (WP-V).
6. **Legal text** is drafted for counsel and never published by an agent. Dates change only in the final publication commit.
7. **Never claim real-device results without a real device.** Automated tests and the browser harness are labelled as such.
8. **Linear protocol.** Read the issue in full first. Tick a box only with evidence in a comment (commit SHA, CI run, test name, query output, screenshot). Move status only on evidence. Record new work in Linear before acting on it. Open product decisions belong to the owner: write options and a recommendation, ask, do not resolve in code. Parents close only when every child is done. `BLOCKED-ON-HUMAN:` comments state the exact ask.
9. **Colour.** Red appears in the interface only on the sign-out row. Not errors, not warnings, not delete. Amber for attention and destructive, blue for accent and locked. **A teacher's ink can be any colour; never assume red.** Confidence is form (solid, border, dashed), not colour.
10. **Copy.** No exclamation marks, no "are you sure". Plain, calm, direct. Every reason shown on the camera must be a measured one.
11. **Architecture.** `index.html` is no longer the front end; the app is Vite + React 19 + TypeScript in `src/ui/`. `src/scan/*` stay pure ES modules that run on the main thread, in a worker and in Node. `src/app.js` imports the scanner dynamically; keep it that way. No scanner workers, Gemini clients, Tavily, R2 server access or queue consumers in this repo: those live in `axon-backend`. `src/scan/contract.js` and `axon-backend/shared/src/contract.ts` change together or not at all.
12. **No third-party runtime request.** Libraries are bundled into our own output. Any new library: check the licence first, pin the exact version, lazy-load it (it must not touch the camera path or the first-load bundle budget), and add it to `third_party/` notices. LGPL needs the owner's yes.
13. **Do not re-introduce a build-less single file, a new framework, or a second state store.**
14. **Tests prove things.** A test that cannot fail does not count. Fixtures are generated in code; no real student paper is committed. The owner's clips and photos live in a gitignored `corpus/` and never leave the machine.
15. **Commits.** Small, one concern each. Every commit message ends with exactly:
    `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01EmBdRS5NaVh7WTHjDRg4Cs`.
    PR descriptions end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and the session URL. Push to `build/scanner-rebuild`; PR #189 stays a draft until the owner says otherwise.
16. **Local environment.** Only Chromium is installed in the agent sandbox (CI also runs `webkit-mobile`). `pw.local.config.ts` is untracked and stays untracked. The owner's computer is Windows; commands you give him must work in PowerShell (bash alternative in brackets where they differ).

---

## Part 3. State of the world (verified versus not)

### 3.1 What exists on `build/scanner-rebuild` (HEAD `2ef071a`, pushed)

Verified by tests and CI (browser harness and CI only, never on a physical device):
- Detection: scanic 1.6.0 ML (DocCornerNet LEAN) in `src/scan/detect-worker.js`; wrapper `src/scan/detector.js` (`detectPage`, `DETECTOR`, `isConvexQuad`, `quadFromCorners`). Classical detection only if ML cannot run. Whole-quad IoU lock `src/scan/lock.js` (`LOCK`). One measured guidance line at a time `src/scan/guidance.js` (`GUIDE`, priority: engine, dark, nothing, cutoff, small, shaky, blurry, glare, locked). The shutter is never disabled by detection. Torch only if `track.getCapabilities().torch`.
- Camera UI: `src/ui/pages/Scan.tsx`, `src/ui/scan/{PaperStack,PageReview,ImportDesk,useDeskMode,ScanProvider,CameraLevel,ReviewSheet}.tsx`, `src/scan/ui.js` (flow and state), `src/ui/styles/scanner.css`. Capsule shutter, paper stack, Done becomes Review when a page is flagged, Review offers Retake and **Adjust edges** (scanic `createCornerEditor` on the stored original starting from `page.capture.suggestedQuad`). Laptop import screen with QR; no webcam.
- Production CSP is in `public/_headers`, `netlify.toml` and `src/index.ts`, all with `'wasm-unsafe-eval'`. `tests/e2e/scanner-csp.spec.ts` runs the viewfinder under the production CSP and asserts no violation and at least one auto shot.
- Decisions applied: D15 to D25 (see `Axon.md` section 11). D25: a `warn` quality verdict is a note and does not flag a page (`src/scan/ui.js`).
- Last known local test counts at `39b57e3`: vitest 263, node tests 188, Playwright 98 plus the CSP test. Re-run to get today's numbers; counts change.

### 3.2 What is **not** verified

- The rebuild has **never run on a physical device**. Not one trial.
- Detection thresholds are first guesses until tuned on real footage (AXO-148, AXO-155).
- The owner says he attached phone clips, but none were visible in the session. Re-attach (R-13). They are not needed to start T1.
- PR #189 has no preview deploy. Production (`main`) still serves the **old** scanner.
- Whether the old and the new capture paths produce sharp stills on this phone: unknown (AXO-164).

### 3.3 Baseline evidence from the owner's phone (the OLD scanner, production)

Source: owner's screen recording, 3 Oct 2026 21:12, about 150 s, OnePlus CPH2447, Android, plus a Home screenshot and five images. The on-screen strings ("Hold steady while I lock onto all four corners", "Fit all four page corners in frame", "Read this paper") exist on `main`, not on this branch, so this is the before-picture. A screen recording is **not** the section 9 corpus: the old app's own corner marks are drawn on every frame, and the file must not be used to tune a detector.

Read from frames (not measured):
- Page small and lit: corner marks landed on the paper's corners, turned white on lock, page 1 auto-captured about 40 s into the clip.
- Dim light with a hand shadow: about 15 s without a lock; "too blurred to read clearly"; the page taken then was flagged "We couldn't confirm page 2's edges" and the kept full photo is mostly red bedspread.
- Lit page filling the frame: more than 45 s with no corner marks, no lock, no auto capture. Pages 2 and 3 exist only because the shutter was tapped. This is the AXO-155 case.
- Page 1 and page 3 carry an amber note and the app toasted "Page sharpened for readability" instead of asking for a retake.
- Two attached page images show doubled, smeared text and washed-out blue ink (owner has not said where they came from; read as the scanner's output). Two others, a clean straight image and a dark one with a hand shadow, show the source is legible when photographed well.
- Last frames: the paper-type sheet opens over a dimmed "Sending page 1 of 4" progress.
- Home shows "Last available analysis. Live analysis is unavailable.", "Checking your latest evidence...", recent scans "Reading" and "Not read".

Resulting issues: AXO-164 (blur, Urgent), AXO-165 (sheet over progress), AXO-163 (Home notice indent; fixed in `2ef071a`, needs a real-browser look), AXO-155 and AXO-116 comments.

**The retest protocol the owner uses, every time, so results compare:** the same marked A4 sheet; three conditions (lit and small in frame, lit and filling the frame, dim with a shadow); old scanner versus rebuild; screen recording on; `?scandebug=1` on; export the debug log (T2). Record time to lock, time to auto, number of shutter taps, pages flagged, notes shown.

### 3.4 Issue map

Scanner: AXO-144 (parent, In Progress), AXO-145 corpus, AXO-146 to AXO-153 children, AXO-155 auto-crop tuning, AXO-156 import (Urgent), AXO-157 CSP/licence/assets, AXO-158 shared blue contrast, AXO-162 landscape (next release), AXO-163, AXO-164, AXO-165.
Other: AXO-143 credential rotation (Urgent, owner), AXO-154 exam date, AXO-160 email/password sign-in, AXO-161 teacher ink any colour, AXO-116 pipeline, AXO-70 end-to-end validation, AXO-122 question count, AXO-132 and AXO-135 to AXO-142 paper and review redesign, AXO-130 Share, AXO-133 Contact us, AXO-126/35/36/38/39/40 Tutor, AXO-13/42/43/44/125 model routing, AXO-121 learning loop, AXO-54/55/15 DB security, AXO-73 to AXO-76 and AXO-27/128/129 legal and privacy, AXO-78/67/10 observability and performance, AXO-20 and AXO-56 to AXO-59 guardian verification (parked), AXO-112 Postgres upgrade (deferred).

---

## Part 4. Tonight: tasks in order

Time boxes are guides. Always commit and push after each task so the owner can pull at any moment. After each task add a Linear comment with evidence.

### T0. Baseline (15 min)

1. `git fetch`, check out `build/scanner-rebuild`, confirm HEAD includes `2ef071a`. `npm ci`.
2. Run, and record exact counts: `npm run typecheck`, `npm test`, `npm run test:ui`, `npm run test:e2e` (use your untracked `pw.local.config.ts`, e.g. `npx playwright test -c pw.local.config.ts`), `npm run test:a11y`, `npm run check:contract-parity`, `npm run build`.
3. Check CI on the head with `gh api repos/Mrmanwonder/Axon-Site/commits/<sha>/check-runs` (note: `gh pr list` GraphQL is blocked; use REST). If anything is red, fix it first, in the smallest commit.
4. Add `corpus/` and `corpus-out/` to `.gitignore` (they do not exist yet) and commit.
5. Read, in this order: `src/scan/contract.js`, `capture.js`, `camera.js`, `detector.js`, `lock.js`, `guidance.js`, `conditioning.js`, `ui.js`, `src/ui/data/useIngestion.tsx`, `src/ui/scan/ImportDesk.tsx`, `PageReview.tsx`.

Done when: all suites green or each red item has a Linear issue; counts written in a comment on AXO-144.

### T1. Get the rebuild onto the owner's phone (the critical path)

The owner's phone is Android, so the cheapest secure route is USB. The agent writes these steps into a one-page checklist in the PR description and the owner follows them. Order of preference:

**Route A: USB and `adb reverse` (recommended; works tonight, no deploy).**
Owner, on the Windows PC (PowerShell):
1. Install Android platform-tools (adb). Phone: Settings, About, tap Build number 7 times; Developer options, turn on USB debugging; connect USB; accept the prompt.
2. `adb devices` must list the phone.
3. In the repo folder: `git fetch; git checkout build/scanner-rebuild; git pull; npm ci; npm run dev`.
4. In a second window: `adb reverse tcp:5173 tcp:5173`.
5. On the phone, open Chrome and go to `http://localhost:5173/` . `localhost` counts as a secure context, so the camera works.
6. Sign in with email OTP (type the code; the magic link needs the origin on the redirect allow-list). Google needs `http://localhost:5173` on the Supabase redirect allow-list: **BLOCKED-ON-HUMAN**, dashboard, Authentication, URL Configuration.
7. Append `?scandebug=1` to the Scan URL after T2 lands.

**Route B: HTTPS tunnel** (works for iPhone too). `cloudflared tunnel --url http://localhost:5173` gives a temporary HTTPS URL. Vite blocks unknown hosts, so the agent must check the installed Vite version's `server.allowedHosts` setting and, if needed, use a local untracked config, not a tracked change. The tunnel origin also needs the redirect allow-list for Google or magic links. OTP code works without. Never leave a tunnel running unattended.

**Route C: preview version on Cloudflare** (owner says yes first). `npm run build`, then `npx wrangler versions upload` (this uploads an unlisted version; it must **not** be followed by `versions deploy` or `wrangler deploy`, which change production). Needs the owner to be logged in (`wrangler login`). Preview URLs must be enabled on the Worker. The agent never runs a deploy command.

Agent also does, regardless of route:
- Confirm the dev server and a production build both serve the ML worker and wasm (`public/scan-ml/0.2.0/`), and that `npm run preview` plus the CSP test still pass.
- Write `docs/qa/device-trial-script.md`: the retest protocol of section 3.3, a table to fill in, and what to send back (the debug log JSON and the screen recording).

Done when: the owner reports the rebuild is open on his phone (G1) and sends a debug log. **BLOCKED-ON-HUMAN** until then. Do not wait; continue with T2 to T6, which are all agent-doable.

### T2. Debug overlay and exportable log (so one device run can be analysed)

`?scandebug=1` already draws overlays in `capture.js` (`drawDebug`). Extend it so one trial yields a log the owner can paste or download:

1. A small, non-intrusive panel (only when `scandebug` is set; never in normal use) with: engine status and ms per detection, current phase (searching, candidate, locked), fill, guidance reason, capture path, last page metrics.
2. A **Copy log** and **Download log** button producing JSON with: user agent, `devicePixelRatio`, screen size, secure-context flag, camera `track.getSettings()` and `getCapabilities()` (width, height, frameRate, focusMode list, torch present), `ImageCapture` availability, ML engine load time and whether threaded wasm ran, a timeline of events (frame time, phase, guidance reason, lock, lose-lock, auto fire, shutter tap, capture path, `takePhoto` success or failure and its exception text), and per page: `capture_path`, source width and height, stored width and height, geometry confirmed, detection score, quality metrics (sharpness, glare, brightness), enhance flags, flag reason.
3. The log contains **no images, no tokens, no user id, no email**. Add a unit test that the exporter output has none of the keys `access_token`, `refresh_token`, `email`, `student_id`.
4. Everything is behind the flag; no cost when off; no new motion.

Evidence: unit tests; a Playwright test on `/bench/viewfinder.html?scandebug=1` that downloads a log and checks its shape.

### T3. AXO-164: blurry, ghosted stored pages (do this before import; it blocks the core loop)

1. Find out which path produced a stored page: `page.meta.capture_path` (`image-capture` versus `canvas-grab`). Both paths are in `capture.js` (`takePhotoAttempt` at about line 814, `NATIVE_PHOTO_TIMEOUT_MS`, the fallback at about 830). If the device log (T2) shows `canvas-grab` on a phone that has `ImageCapture`, record the exact exception or timeout; fix the cause. Never fall back silently: the fallback must be recorded and visible in the log.
2. Check stored dimensions against `CONDITIONING.MIN_LONG_EDGE` (2400) and the `TRACKING_WIDTH` of the live stream. A video-frame grab at tracking resolution is not a legible handwritten page.
3. Check the settle logic: the shutter and Auto must wait for autofocus (`focusMode: continuous` is applied best-effort in `camera.js`) and for the page to be still (`STABILITY_MS` 600, `STABILITY_TOLERANCE` 0.04). Confirm the live blur measurement actually gates Auto. A blurred page must be **retaken or flagged**, never "sharpened into a pass". Read `src/scan/enhance.js` and `quality.js` (`BLUR_FAIL`): the toast "Page sharpened for readability" must not stand in for a retake when the source is below the blur line.
4. Add tests: a deliberately blurred fixture must come out flagged `fail` with a retake prompt; a sharp fixture must not be altered by enhance beyond the documented amount.
5. Compare to the owner's clean image: sharpness metric (variance of Laplacian on the page crop) of the stored page must meet the existing `QUALITY` threshold.

Done when: cause stated with numbers in a comment on AXO-164; fix and tests committed; device re-test queued (G7, owner).

### T4. AXO-156: import every image type and PDF (crucial)

Today: `acceptUploads` in `src/scan/ui.js` accepts only `/^image\//`, decodes with `createImageBitmap(file)`, and stores the page with `quad: null`, so imports are never detected or cropped; PDFs are refused; HEIC fails silently on Chrome. The hidden `<input>` in `src/ui/data/useIngestion.tsx` has `accept="image/*"`. `UPLOAD_EXTENSIONS` in `contract.js` already lists webp, jpeg, png, heic, heif and pdf for the *raw original* upload.

**Design (decided; do not reopen without a reason):**

1. **One front door.** A new pure module `src/scan/ingest.js` (no DOM beyond an optional canvas, so it can be tested in Node): `sniffType(bytes, name, mime)` by magic bytes (do not trust `file.type`; Windows drag-and-drop of HEIC gives an empty type) and `decodeToPages(file) -> AsyncIterable<{ bitmap | imageData, label, sourceKind }>` or a refusal `{ code, message }`. `acceptUploads` calls it and continues to feed `takePage` page by page. The camera path is untouched.
2. **Native first.** JPEG, PNG, WebP, AVIF, GIF (first frame only), BMP: `createImageBitmap(file, { imageOrientation: 'from-image' })`. Very large images (for example 48 MP): downscale at decode with `resizeWidth/resizeHeight` to a long edge of about 4000 px so memory stays bounded on a mid-tier Android.
3. **HEIC/HEIF.** Order: native `createImageBitmap`; then WebCodecs `ImageDecoder` if `ImageDecoder.isTypeSupported(type)`; otherwise refuse with the message: "This photo is HEIC and this browser cannot open it. Share it as JPEG, or use your camera app." A JavaScript HEIC decoder (libheif builds are LGPL) is added only after the owner says yes (**BLOCKED-ON-HUMAN**: licence review). Write the exact options and a recommendation in AXO-156; do not add the dependency tonight without the yes.
4. **TIFF.** Lazy-load a small MIT decoder (UTIF or utif2; verify the licence at install, pin the exact version). Multi-page TIFF: each IFD is a page, same cap as PDF.
5. **PDF.** Lazy-load `pdfjs-dist` (pin the exact version; check its licence file, it is Apache-2.0, and add it to `third_party/`). Under our CSP: `getDocument({ data, isEvalSupported: false })`, a same-origin module worker (`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` or the build's equivalent for the pinned version), and, if the pinned version uses wasm for JPEG 2000 or colour, a same-origin wasm URL; verify `worker-src` and `script-src` in the production CSP allow it and extend `tests/e2e/scanner-csp.spec.ts` to import a PDF under the production CSP. Do not loosen the CSP beyond what is demonstrably needed, and record any change in AXO-157.
   - Render each page to a canvas at a scale giving a long edge of about 3000 px (cap by a safe canvas area, about 16 million pixels, so iOS and low-memory Android do not crash). Use `OffscreenCanvas` where available. Render one page at a time and release it before the next.
   - Page cap: `CAPTURE.MAX_PAGES` (25) is shared with camera pages. A PDF that would exceed what is left: take the pages that fit, and say so: "Added 25 of 40 pages. Remove pages to add more." Never drop silently.
   - Encrypted, corrupt, zero-page and oversize PDFs each get their own plain message and do not add partial pages without saying how many were added.
   - Per-page progress ("Reading page 3 of 12") without blocking the UI thread; cancel works.
   - The raw original: do **not** attach the whole PDF to every page's `raw` slot (the pipeline uploads one raw per page). For PDF pages, store the raster as the page and set no raw original; note "source PDF not retained" in the page meta. Retaining the source PDF is a follow-up for the owner to decide.
6. **No contract change tonight unless needed.** The accepted-type list that the file picker and dropzone use is a UI list. `UPLOAD_EXTENSIONS` in `contract.js` governs which *raw originals* are uploaded; images of other types become the page raster and their raw is skipped (`papers.js` already skips and reports an unlisted type). If you decide to store raw originals of new types, change `contract.js` and `axon-backend/shared/src/contract.ts` together and run `npm run check:contract-parity` in both.
7. **UI.** Update the hidden input's `accept` (and the camera-app input stays `image/*`): `image/*,application/pdf,.pdf,.heic,.heif,.tif,.tiff,.avif,.bmp,.gif`. Update `ImportDesk` copy (it says photos only). Drop and paste use the sniffed type. Every refusal shows the file name and the reason in plain words, not "could not be opened". Amber, never red.
8. **Source kind.** Pages from PDFs carry `sourceKind: 'pdf'` (already in `SOURCE_KINDS`); images `'upload'`. Check `page_source` in the database accepts `pdf` (read the migrations); if it does not, record it in Linear and map to `upload` until a migration lands.

**Tests (all with generated fixtures, no real papers):**
- Unit (vitest or node:test) for `sniffType` on each type by magic bytes, including wrong extension and empty MIME.
- Generate fixtures in code or at test time: JPEG, PNG, WebP, GIF, BMP via a canvas in the browser harness; AVIF if the encoder is available; a 3-page PDF with text (build with a tiny PDF writer in the test, or use `qpdf`/`pdftoppm` available in the sandbox only to verify, not as a dependency of CI); an encrypted PDF (`qpdf --encrypt`); a 30-page PDF to exercise the cap; a corrupt PDF (truncated); an oversize image.
- Playwright import test: choose files (setInputFiles) of each type, and a multi-page PDF; assert the stack count, the refusal messages, no console errors, and that the page images are non-blank (pixel variance above a threshold).

### T5. Page detection and crop on imports (same task family as T4)

Imports must stop pretending the whole image is the page. After decoding each page:
1. Run still detection exactly as the shutter path does (reuse the same helper, do not duplicate it: look at how `capture.js` calls `detectPage` and `judgeStillGeometry` around lines 119 and 985 and extract a shared function if needed, keeping `src/scan/*` pure).
2. `judgeStillGeometry`: confirmed only if the ML engine found a quad with `score >= FINE_SCORE` (0.9). Confirmed: apply the crop. Not confirmed: store the whole image, flagged, with `page.capture.suggestedQuad` set when a candidate exists, so **Adjust edges** starts from it.
3. For **PDF pages** the page already is the page: store uncropped with geometry confirmed, unless detection finds a confident quad covering roughly 30 to 90 percent of the rasterised page (a photo pasted into a PDF); then flag it with that suggestion rather than cropping silently.
4. Conditioning's refusal line (`MIN_LONG_EDGE` 2400, real refusal near 1600 px) applies to imports; the message must say the image is too small and what size is needed.
5. Tests: a synthetic photographed-page fixture imports and is cropped; a full-frame page imports flagged; a negative (no page) imports flagged with the whole image kept; none is dropped.

Evidence: Playwright plus unit tests; Linear AXO-156 ticked item by item with commit SHAs.

### T6. Adjust edges on a real touch screen

Adjust edges is in the flow (owner decision). `PageReview.tsx` creates scanic's `createCornerEditor` on the stored original (around line 152). Check, in a touch-emulated Chromium (`hasTouch`, `isMobile`) at 360 to 430 px wide:
- Handles are at least 44 px touch targets; the page is not scrolled by dragging a handle (`touch-action: none` on the editor); a magnifier or nudge is visible while dragging so the finger does not cover the corner.
- The quad cannot be made invalid: `isConvexQuad` must hold on release; if the user drags into an invalid shape, snap back and say why in amber.
- Accept applies the crop and clears the flag; Cancel keeps the page as it was; Reset returns to the detected suggestion.
- Works for imported pages and PDF pages the same way.
- Haptics: 10 ms on selection only, feature-detected, try/catch. Nothing on drag.
Add Playwright tests (drag a corner by mouse and by touch events; assert the resulting crop).

### T7. Tuning loop on the owner's clips (when they arrive; AXO-145, AXO-148, AXO-155)

Do not change a threshold before clips exist. When they do (11 scenarios of about 10 s from the phone's own camera app: normal light, night, warm light, white-on-white, page partly out of frame, page filling the frame, and negatives: empty desk, wall, laptop screen, book cover):

1. Put clips in `corpus/clips/` (gitignored). Extract frames with `ffmpeg` at 2 fps into `corpus/frames/<scenario>/`. Never commit or upload them.
2. Label the four page corners on at least 40 frames across the scenarios (a tiny local labelling page built on scanic's corner editor is enough; labels as JSON in `corpus/labels/`). Negatives carry an explicit "no page" label.
3. Write `bench/corpus-run.mjs` that runs the same detector, lock and guidance code over the frames in order (as a replay of time) and reports per scenario: time to lock (p50 and p95), Auto time, false locks, false captures, corner error as a percentage of the short edge, and the rate at which the quad is interior to the true page.
4. Targets: found within 3 s at p95 in capture-ready scenarios; Auto within 10 s in at least 95 percent of capture-ready trials; **zero** false captures and false locks on negatives; corner error at most 2 percent of the short edge; interior-quad rate at most 5 percent.
5. Candidate fixes, in order of preference, each adopted only if the benchmark shows no regression elsewhere: (a) expand-to-frame rule when the quad touches or nearly touches three frame edges (the overfill case); (b) prefer the still-photo detection over the live quad for the saved crop; (c) adjust `LOCK` (`HITS_TO_LOCK`, `SAME_PAGE_IOU`, `MISS_GRACE_MS`); (d) adjust `CAPTURE.MIN_FILL` (0.6) and `GUIDE.SMALL_FILL` (0.35) for the fill gates; (e) only then touch the model input scale.
6. Write `docs/qa/scanner-corpus-report-2026-10-DD.md` with the numbers, the corpus version, and what changed. Thresholds in `contract.js` cite the corpus version in a comment.

### Stop conditions for tonight

Stop and report instead of pushing on if: CI cannot be made green without loosening a test; a fix needs a production change or a secret; a library licence is not permissive; a change would touch the glass or the nav without reading `AGENTS.md` first; the same device-only gate fails twice after a fix (then it is a measurement problem, not a coding one; gather a log and wait); or you are about to claim a device result with no device evidence.

---

## Part 5. Everything else that is left (priority order, after tonight)

Each item: read the Linear issue in full, then do what the owner has decided. The owner's decisions are in `Axon.md` section 11.

**R1. Teacher ink is any colour (AXO-161).** Audit every consumer of `TEACHER_INK`, the red-hue mask and `LAYER_FALLBACK` in `src/scan/contract.js`, `layers.js`, README, `SCANNING_SYSTEM.md`, and the backend pair `axon-backend/shared/src/contract.ts`. The mask becomes a hint, never a gate: the content stage reads teacher marks from the crop whatever the colour; reconciliation (marks sum to the written total) stays the check. Remove or rename the constant and the red fallbacks in both repos together. Measure on real papers marked in blue, black, pink and red (**BLOCKED-ON-HUMAN**: the owner supplies at least one real paper per colour). No interface colour derives from ink colour.

**R2. Email and password sign-in (AXO-160, "WP-V").** Built today: email OTP, phone OTP, Google (`src/supabase.js`). Add alongside Google and OTP: `signUp`, `signInWithPassword`, forgot-password with `resetPasswordForEmail`, and the `PASSWORD_RECOVERY` event then `updateUser`. Parent Mode re-authentication (`src/lib/auth/parentMode.ts`) must work for password accounts, not only OTP. A Google identity and a password account on the same verified email link to one guardian (write the test first). Errors never reveal whether an address has an account; amber, never red; no exclamation marks. Correct `autocomplete` attributes (`email`, `current-password`, `new-password`), a show/hide toggle, 44 px targets, axe clean. Tests for both paths against a **local** stack only; no account is created on production. **BLOCKED-ON-HUMAN** (dashboard): confirm email is on, set minimum password length, turn on leaked-password protection (may need a paid Supabase plan; see AXO-55). Copy that names the sign-in methods goes to counsel (AXO-75).

**R3. Exam date on a paper (AXO-154, D15).** Migration adds a nullable `exam_date` on the paper; show "Exam <date>" when known, otherwise "Added <date>"; never a bare date. The migration file is the agent's; applying it to production is the owner's.

**R4. Paper and review redesign (AXO-132 and AXO-135 to AXO-142, AXO-122).** Finish AXO-136 (review cards, teacher-mark selection), AXO-138 (audit extraction fidelity, includes R1 data), AXO-139 and AXO-140 (maths and tables), AXO-141 (verify scanner output against the supplied full-page reference), AXO-142 (truthful review-needed counts). The counting contract in `Axon.md` section 5 stands: no screen says "questions" when it means parts.

**R5. Small product items.** AXO-130 Share; AXO-133 Contact us in Settings (both with the owner's copy; legal contact copy goes through counsel).

**R6. Pipeline end to end (AXO-116, AXO-70).** Home currently shows live analysis unavailable. Establish whether it is the API, the Worker route, or the client; fix in the right repo (`axon-backend` for Workers). Then retry a stored paper and validate: upload, HEAD confirm, triage, structure, crop, content, reconcile, explain, review. **BLOCKED-ON-HUMAN:** device validation.

**R7. Billing (WP-U).** One-day grace period after a failed payment before Pro ends (production still ends Pro immediately until built); INR and USD both offered. Supabase Edge Functions in this repo are billing-only.

**R8. Tutor (AXO-126, 35, 36, 38, 39, 40), behind the `tutor_enabled` flag.** Scoped helper on the student's own papers, not a general chatbot. Never fabricates a scheme.

**R9. Model routing and evals (AXO-13, 42, 43, 44, 125).** Model IDs live in `model_routes`; prompts are versioned files, never edited in place; evals decide which model is better.

**R10. Learning loop (AXO-121).** Student corrections and explanation feedback route to evaluation. Unsure data never reaches analytics.

**R11. Database security (AXO-54, 55, 15).** Minimise grants and search paths, close advisor warnings (note: `delete_my_account()` is deliberately public and the advisor flag is expected), resolve password-protection policy. Re-run advisors after every migration.

**R12. Legal and privacy (AXO-73 to AXO-76, AXO-27, AXO-128, AXO-129).** Drafts only. **Open owner decision AXO-129:** Google AI Studio versus Vertex for student pages; the Privacy Policy must not claim zero data retention on the paid tier.

**R13. Observability and performance (AXO-78, 67, 10).** PostHog consent, masking and CSP; scanner main-thread cost; assets and fonts. The 60 fps floor on a mid-tier Android is real.

**R14. Parked or deferred.** Guardian verification (AXO-20, 56 to 59, provider work parked). Postgres 17.6 to 17.11 (AXO-112, deferred until a major upgrade). Landscape phones for the scanner (AXO-162, next-release goal). Shared blue contrast decision (AXO-158, owner picks the filled-blue value).

---

## Part 6. Owner-only checklist (nothing here can be done by an agent)

| # | Ask | Why | Issue |
|---|---|---|---|
| 1 | **Rotate the database credential exposed in a migration-workflow log, today.** Do it in the Supabase dashboard; do not paste the credential anywhere. Tell the agent when done so it can verify non-secret state | an exposed credential is live until rotated | AXO-143 |
| 2 | Re-attach the phone clips (Appendix C list), or connect the folder holding them | tuning is not honest without them | AXO-145 |
| 3 | Install the rebuild on the phone (T1, Route A) and run the retest protocol; send the debug log and the screen recording | the rebuild has never run on a device | AXO-144 |
| 4 | Say where the two blurry page images came from | confirms or corrects AXO-164 | AXO-164 |
| 5 | Add the origin you test from to Supabase Authentication, URL Configuration, Redirect URLs (only needed for Google or magic-link; OTP code does not need it) | auth redirect | T1 |
| 6 | Decide: HEIC decoder (LGPL) yes or no; TIFF decoder yes | licence | AXO-156 |
| 7 | Supply one real marked paper per ink colour (blue, black, pink, red) | measure R1 | AXO-161 |
| 8 | Dashboard: email confirm on, password length, leaked-password protection | R2 | AXO-160, AXO-55 |
| 9 | Pick the filled-blue value (white on `#3A86FF` is 3.48:1; the scanner uses `#2B6BE6`, 4.8:1) | design system | AXO-158 |
| 10 | Apply new migrations to production (agent writes them; you apply) | production must not differ from the repo, but only you apply | AXO-154 and later |
| 11 | Confirm the model privacy route in writing: AI Studio paid tier or Vertex | policy text | AXO-129 |
| 12 | Counsel review of anything under Legal | agent never publishes legal text | AXO-73 to AXO-76 |
| 13 | Real-device checks for every device-only gate (G1, G2, G4, G5, G6 device half, G7) | automation never satisfies a device gate | AXO-70 |

PR #189 is still a draft. Merge is the owner's call after G10 and the device gates he cares about.

---

## Part 7. Reporting

**After each task**, comment on its Linear issue: what changed, commit SHA, test names and counts, CI link, what is still unverified and why. Tick only boxes with that evidence.

**Evidence template (copy per comment):**
```
Task: <T#/R#, issue id>
Commit(s): <sha ...>   Branch: build/scanner-rebuild
Automated: <suite: passed/total>  CI: <run link, head sha>
Device: <not run | run by owner on <phone>, log attached, result>
Unverified: <list>
BLOCKED-ON-HUMAN: <exact ask, or none>
```

**Final report to the owner** (short, plain, no recap of steps): gates G1 to G10 as a table with status (proven by automation, proven on device, open, blocked); what changed; what the owner must do next (the Part 6 rows that are still open, AXO-143 first); the three biggest remaining risks. If a device gate is open, say so in the first line.

---

## Appendix A. Scanner file map

| File | Role |
|---|---|
| `src/scan/contract.js` | thresholds, `CAPTURE` (MAX_PAGES 25, STABILITY_MS 600, STABILITY_TOLERANCE 0.04, PATIENCE_MS 3500, MIN_FILL 0.6, CONSECUTIVE_FINDS 5), `CONDITIONING.MIN_LONG_EDGE` 2400, `UPLOAD_EXTENSIONS`, `SOURCE_KINDS`, `TEACHER_INK` (known mistake), `QUALITY` |
| `src/scan/detector.js` | `detectPage(image, {engine, classicalFallback})` returns `{status, source, quad, score, degraded, error, ms}` |
| `src/scan/detect-worker.js` | ML worker, lazy-imports scanic and ORT |
| `src/scan/lock.js` | `LOCK` (MIN_FILL 0.05, HITS_TO_LOCK 3, SAME_PAGE_IOU 0.8, MISS_GRACE_MS 600, DISAGREE_TO_REPLACE 3, SETTLED_IOU 0.96, SMOOTHING 0.5), `quadIoU`, `createLock` |
| `src/scan/guidance.js` | `GUIDE` (DARK_MEDIAN 55, DARK_P95 120, SMALL_FILL 0.35, EDGE_CONTRAST 10, EDGE_MARGIN 0.012, SHAKY_MOTION 9, NOTHING_MS 6000), `chooseGuidance` |
| `src/scan/capture.js` | live loop, `judgeStillGeometry`, `FINE_SCORE` 0.9, `takePhotoAttempt`, `drawDebug` (`?scandebug=1`), `TORCH_MODES` |
| `src/scan/camera.js` | `getUserMedia` constraints, continuous focus, ImageCapture |
| `src/scan/conditioning.js` | warp, enhance, encode, page meta (`capture_path`, `geometry_confirmed`) |
| `src/scan/quality.js`, `enhance.js` | blur, glare, brightness verdict (`ok`, `warn`, `fail`), sharpening |
| `src/scan/ui.js` | flow state, `takePage`, `acceptUploads` (needs T4), flagging, Review, submit |
| `src/papers.js` | page upload, raw original skipping |
| `src/ui/data/useIngestion.tsx` | file input, `ingestFiles`, `ensureScan` |
| `src/ui/scan/*`, `src/ui/pages/Scan.tsx` | camera screen, stack, import desk, review sheet, Adjust edges |
| `src/ui/styles/scanner.css`, `system.css` | scanner styles; `#scanVideo`/`#scanOverlay` and `[data-screen]` rules are load-bearing |
| `public/scan-ml/0.2.0/` | `doccornernet_lean.ort`, ORT wasm and loader, `MODEL_CARD.md` |
| `third_party/scanic/` | LICENSE and NOTICE (MIT; training-data provenance not audited) |
| `bench/*.test.mjs`, `harness/*.test.mjs` | node:test suites; `bench/viewfinder.html` is the browser harness |
| `tests/e2e/scanner-*.spec.ts`, `tests/ui/scanner-*.test.tsx` | Playwright and vitest scanner tests |

## Appendix B. Commands

```powershell
npm ci
npm run dev                      # http://localhost:5173
npm run typecheck
npm test                         # node --test bench/*.test.mjs harness/*.test.mjs
npm run test:ui                  # vitest
npm run test:e2e                 # Playwright (CI: chromium and webkit-mobile)
npm run test:a11y
npm run check:contract-parity
npm run build
adb devices
adb reverse tcp:5173 tcp:5173
```
Agent sandbox only: `npx playwright test -c pw.local.config.ts` (untracked; Chromium at `/opt/pw-browsers/chromium-1194`, harness server on 5174, preview on 5175). `ffmpeg`, `pdftoppm` and `qpdf` exist in the sandbox for generating and checking fixtures; they must not become CI dependencies. Backend, in `axon-backend`: `npm run typecheck`, `npm test`, `npm run dry-run`.

## Appendix C. The clip list (AXO-145 section 9)

About 10 s each, phone's own camera app, held the way a student holds it: 1 normal light; 2 night with the room light off and the desk lamp on; 3 warm light; 4 white page on a white desk; 5 page partly out of frame; 6 page filling the frame; 7 shadow of a hand or phone across the page; 8 negative, empty desk; 9 negative, plain wall; 10 negative, laptop screen showing a page; 11 negative, book cover. Mark each file name with its number.

## Appendix D. What this file does not decide

Whether Auto should wait longer in dim light; the filled-blue value; whether to keep the source PDF; HEIC licence; whether `page_source` already has `pdf`. Each is flagged above with an owner or a check. Write options and a recommendation in Linear; do not resolve silently in code.
