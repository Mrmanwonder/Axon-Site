// Stage 0 · capture.
//
// The viewfinder, the gate in front of the shutter, and the tray behind it.
//
// The container question in SCANNING_SYSTEM.md §3 is resolved: pure web, not a
// native rewrite — see the resolution note there. What was actually wrong was
// narrower than the container — the shutter grabbed a compressed video frame
// instead of a real photographic still — and `ImageCapture.takePhoto()` closes
// most of that gap on Chromium/Android, with the old canvas grab surviving as
// the iOS Safari fallback. Everything below the capture boundary is unaffected
// either way: what this produces is a conditioned page, a teacher-mark map and
// a quality verdict, and a native scanner would produce the same three things.
//
// Two rules shape all of it. The gate assists, it never blocks: auto-capture can
// refuse, the shutter never does. And the quality verdict happens here, while
// the paper is still in front of the student, because the same verdict forty
// seconds later at review usually means the page is simply lost.

import { CAPTURE, CONDITIONING, QUALITY } from './contract.js';
import { releaseCamera, requestCamera, requestContinuousFocus } from './camera.js';
import { detectQuad, easeQuad, isPageShaped, scaleQuad } from './edges.js';
import { paperScore } from './quad.js';
import { focusWindowRect, measureQuad, sharpness, skewDegrees } from './quality.js';
import { quadDrift, quadFill, quadSize } from './geometry.js';

const DETECT_INTERVAL_MS = 80;   // ~12 searches a second; the overlay still runs at frame rate
const DETECT_MAX_INTERVAL_MS = 320;
// A worker message that never comes back — a dropped frame, a worker hiccup
// — must not wedge the search loop. Generous relative to the interval above:
// this is a safety net for the rare stuck message, not a budget anything
// should normally spend.
const DETECT_TIMEOUT_MS = DETECT_MAX_INTERVAL_MS * 3;
// The quad the live gate found ran on a 240px proxy of a video frame; the
// still that actually gets warped can be many times that resolution, taken
// through a different path entirely on the ImageCapture route. Re-verifying
// against a downscaled copy of the *actual* captured still — rather than
// trusting a quad rescaled 15x from a much smaller frame — is cheap (one
// small canvas, once per shot, not in the live loop) and catches the case
// where the live proxy's guess does not hold up against what was really
// there. Same working size as the live proxy search, for the same reason:
// paperScore's neutrality test does not need more.
const VERIFY_LONG_EDGE = 320;
// Mirrors the gate `detectQuad` itself applies in edges.js — see the comment
// there for how it was calibrated (every real page fixture scored 0.96+, a
// photo of the floor scored 0.68).
const VERIFY_PAPER_MIN = 0.85;
// The share of the main thread the search is allowed to take. Finding the page
// is not worth a viewfinder that stutters — on the phones this is built for, a
// fixed cadence means the search sets the frame rate, and the frame rate is what
// the student experiences as whether the app works.
const DETECT_DUTY = 0.3;
const PROXY_WIDTH = 240;
// The focus window, in canonical page pixels (QUALITY.MEASURE_LONG_EDGE).
//
// Sharpness cannot be read off the 240px search proxy — that was AXON_FIX_BRIEF
// §B7, and it is not a calibration problem, it is that the detail simply is not
// there. So focus is measured on a window cut straight out of the video at
// native resolution and drawn at exactly the scale `scorePage` will measure the
// submitted page at, which makes the two numbers the same number. Square,
// centred on the page, and small enough that this stays affordable at ~12Hz on
// a phone: 384x384 is 147k pixels against the proxy search's own 102k.
const FOCUS_WINDOW = 384;

/**
 * How long the page has been sitting in one place.
 *
 * Measured against the pose the window opened at rather than against the
 * previous search, which is the whole fix. Frame-to-frame comparison meant a few
 * pixels of ordinary jitter — from the hand, and from a detector that re-fits
 * its lines every search — reset the clock every time, so the window never
 * closed and auto-capture never fired.
 *
 * Pure, and exported, because this is the piece that was silently wrong in the
 * field and a camera is a poor place to find that out twice.
 */
export function steadyWindow({ anchor, found, width, height, since, now }) {
  if (!anchor || quadDrift(anchor, found, width, height) > CAPTURE.STABILITY_TOLERANCE) {
    return { anchor: found, since: now, steady: false };
  }
  return { anchor, since, steady: now - since >= CAPTURE.STABILITY_MS };
}

/**
 * Whether to take the picture.
 *
 * Two ways to qualify. Stillness is the one that should normally fire. Patience
 * is the safety net: a page found and unblocked continuously for long enough is
 * a page someone is holding out to be photographed, and never taking it is a
 * worse failure than occasionally taking one the student then deletes — which
 * costs a tap, against a mode that otherwise simply does not work.
 */
export function shouldAutoCapture({ autoCapture, armed, blocking, steady, heldFor, consecutiveFinds }) {
  if (!autoCapture || !armed || blocking) return false;
  // A detector locked onto something large and wrong is extremely stable, so
  // stability alone is not evidence. Several finds running is.
  if (consecutiveFinds < CAPTURE.CONSECUTIVE_FINDS) return false;
  return steady || heldFor >= CAPTURE.PATIENCE_MS;
}

/**
 * What the live gate says about one search result: block the shutter, or let
 * it through with a hint. Pure and exported for the same reason `steadyWindow`
 * and `shouldAutoCapture` are — this is the actual decision a student's phone
 * makes every ~80ms, and it is also the only piece of that decision this repo
 * can check against `scorePage()`'s final verdict on a real captured still
 * (bench/verdict-agreement.mjs). Reimplementing the ordering in a bench script
 * instead of extracting it would measure agreement against a copy that can
 * silently drift from what the phone actually runs.
 *
 * "Blocking" here means blocking *auto-capture*. The shutter never refuses —
 * that rule is unchanged, and it is why resolution can be a hard condition on
 * this side without ever taking the decision away from the student.
 *
 * The principle behind the ordering, and behind the whole gate: every rejection
 * the pipeline currently makes two minutes late, the camera should make
 * instantly (AXON_FIX_BRIEF.md §7.3). So the conditions here are the same four
 * `scorePage` will apply to the submitted page, in the order the student should
 * fix them, and they are computed against the same thresholds:
 *
 * · **Resolution first**, because it is the only one that is a refusal further
 *   down. A page that will land under CONDITIONING.MIN_LONG_EDGE is a page the
 *   accept step will decline outright, and being told that now — while moving
 *   the phone six inches closer still fixes it — is the entire argument for
 *   having a live gate at all. It used to be advisory here and a hard refusal
 *   later, which is the worst possible arrangement of the two.
 * · **Glare before sharpness**, because a washed-out red tick reads as no tick
 *   at all: the page looks fine and the marks are simply gone.
 * · **Clipping** next, which glare cannot see — a uniformly over-exposed page
 *   has no bright patch to find, and its ink is going all the same.
 * · **Skew** stays advisory. Perspective correction handles a great deal of
 *   tilt, and the warning is for the case where it will have to stretch one end
 *   badly.
 */
export function liveGateVerdict({ glare, clipping, fill, sharpness, skew, pageLongEdge, steady }) {
  if (pageLongEdge < CONDITIONING.MIN_LONG_EDGE) {
    return { blocking: 'resolution', hint: 'Closer — the page needs to fill more of the frame for us to read the marking' };
  }
  if (fill < CAPTURE.MIN_FILL) {
    return { blocking: 'distance', hint: 'Move closer so the page fills more of the frame' };
  }
  if (glare > QUALITY.GLARE_WARN) {
    return { blocking: 'glare', hint: 'Light is bouncing off the page — tilt it slightly away from the light' };
  }
  if (clipping > QUALITY.CLIP_WARN) {
    return { blocking: 'exposure', hint: 'Too bright — move into shade, or turn a lamp away from the page' };
  }
  // Null means the focus window landed on blank paper and there was nothing to
  // measure. Not the same as "soft", and not a reason to refuse: a page with
  // little written on it is a page, and blocking here would refuse it for being
  // lightly used.
  if (sharpness !== null && sharpness < QUALITY.BLUR_WARN) {
    return { blocking: 'focus', hint: 'Hold still — the page is not sharp yet' };
  }
  if (skew > QUALITY.SKEW_WARN_DEG) {
    return { blocking: null, hint: 'Square the page up a little if you can' };
  }
  if (!steady) return { blocking: null, hint: 'Hold still' };
  return { blocking: null, hint: 'Ready' };
}

// ── the live-detection worker ────────────────────────────────────────────
//
// scan-ground-up-revamp-2026-09-07.md Phase 1. Module-level and lazy, same
// shape as device.js's conditioning worker: constructed once, on first use,
// and reused for the tab's lifetime — a Worker is expensive enough to build
// that paying for it once per Scan visit (not once per search, of which
// there are ~12 a second) is the whole point. Falls back to running the
// search synchronously on the main thread — searchOnMainThread(), below —
// on any browser that cannot construct a module Worker, or if this one ever
// errors; either way the fallback is real code that ran before this Worker
// existed, not a stub, and `onerror` logs so a fallback in the field is
// visible in telemetry instead of invisible (this exact failure mode was
// silent in device.js's conditioning worker until scan-live-lag-fix's §3.2).
let detectWorker = null;
let nextDetectId = 1;
const detectPending = new Map();

function ensureDetectWorker() {
  if (detectWorker !== null) return detectWorker;
  try {
    detectWorker = new Worker(new URL('./detect-worker.js', import.meta.url), { type: 'module' });
    detectWorker.onmessage = (event) => {
      const { id, ...rest } = event.data;
      const resolve = detectPending.get(id);
      if (!resolve) return;
      detectPending.delete(id);
      resolve(rest);
    };
    detectWorker.onerror = (event) => {
      console.error('[scan] detect worker failed, falling back to main-thread search', {
        message: event?.message, filename: event?.filename, lineno: event?.lineno,
      });
      detectWorker = false; // fall back from here on
    };
  } catch {
    detectWorker = false;
  }
  return detectWorker;
}

/** Run one 'search' or 'focus' message on the detect worker, resolving to
    null if the worker is unavailable, times out, or the message comes back
    empty — every one of those cases means "nothing to report this cycle",
    which searchOnWorker() already treats the same way a legitimate
    not-found does. */
function runDetectWorker(kind, bitmap) {
  const w = ensureDetectWorker();
  if (!w) { bitmap.close?.(); return Promise.resolve(null); }
  const id = nextDetectId++;
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      detectPending.delete(id);
      resolve(value);
    };
    detectPending.set(id, finish);
    setTimeout(() => finish(null), DETECT_TIMEOUT_MS);
    w.postMessage({ id, kind, bitmap }, [bitmap]);
  });
}

/**
 * @param {Object} options
 * @param {HTMLVideoElement} options.video
 * @param {HTMLCanvasElement} options.overlay
 * @param {(state: GateState) => void} options.onState
 * @param {(shot: {bitmap: ImageBitmap, quad: Array|null, auto: boolean}) => void} options.onShot
 */
export function createCapture({ video, overlay, onState, onShot }) {
  let stream = null;
  let running = false;
  let rafHandle = 0;
  let detectHandle = 0;

  let quad = null;          // smoothed, in video coordinates
  let lastDetection = null; // raw, for the shot's own geometry
  // The proxy size the last search actually ran at, for the same reason —
  // shoot() needs to know what space lastDetection's coordinates are in, and
  // the worker path never touches the `proxy` canvas element, so that
  // canvas's own width/height can no longer be trusted to say so.
  let lastSearchSize = null;
  // The pose the current steady window began at. Steadiness is measured against
  // this rather than against the previous frame — see step().
  let steadyAnchor = null;
  let steadySince = 0;
  let heldSince = 0;
  let consecutiveFinds = 0;
  let autoCapture = true;
  let armed = true;         // disarms after a shot so one steady page is one page
  let state = blankState();

  // ImageCapture.takePhoto() interrupts the stream, reconfigures the camera
  // hardware and returns a genuine sensor-resolution still — not a frame grab
  // off the live video element. Detected once per camera session, because
  // probing it costs a real round trip and the answer does not change mid
  // session. Null on any browser that lacks the API (notably iOS Safari,
  // as of this writing) or whose track refuses it; shoot() falls back to the
  // canvas grab either way.
  let imageCapture = null;
  let capturePath = 'canvas-grab';

  // ── §0 instrumentation ────────────────────────────────────────────────────
  // A rolling window rather than a log line per search: the search runs up to
  // ~12 times a second, and a console line at that rate is not a diagnostic,
  // it is noise that drowns the one number that matters. Flushed as a single
  // summary every couple of seconds instead — see recordStepTiming() below —
  // and the most recent sample also rides along on the state itself
  // (next.timing), which is what reaches conditioning_meta.live_gate.timing
  // for the exact frame a shot was taken from.
  const stepStats = { count: 0, sumMs: 0, maxMs: 0, lastFlush: 0 };

  function recordStepTiming({ detectMs, measureMs, focusMs, workerUsed }) {
    const total = detectMs + measureMs + focusMs;
    stepStats.count++;
    stepStats.sumMs += total;
    if (total > stepStats.maxMs) stepStats.maxMs = total;
    const now = performance.now();
    if (!stepStats.lastFlush) stepStats.lastFlush = now;
    if (now - stepStats.lastFlush < 2000) return;
    console.debug('[scan:step-timing]', {
      n: stepStats.count,
      workerUsed,
      meanMs: +(stepStats.sumMs / stepStats.count).toFixed(1),
      maxMs: +stepStats.maxMs.toFixed(1),
      lastMs: +total.toFixed(1),
      lastBreakdown: {
        detectMs: +detectMs.toFixed(1), measureMs: +measureMs.toFixed(1), focusMs: +focusMs.toFixed(1),
      },
    });
    stepStats.count = 0; stepStats.sumMs = 0; stepStats.maxMs = 0; stepStats.lastFlush = now;
  }

  const proxy = document.createElement('canvas');
  const proxyCtx = proxy.getContext('2d', { willReadFrequently: true });
  const focus = document.createElement('canvas');
  focus.width = focus.height = FOCUS_WINDOW;
  const focusCtx = focus.getContext('2d', { willReadFrequently: true });

  /**
   * Sharpness of the page interior, at the canonical page scale — the
   * main-thread fallback, used only when the detect worker is unavailable.
   * See searchOnWorker() below for the primary path, which sends the same
   * crop to the worker instead of reading it here.
   *
   * The rectangle comes from `focusWindowRect`, shared with bench/ so the
   * agreement report measures the same pixels the phone does. Centred on the
   * quad's centroid: the centre of an answer page is where the writing is, and
   * the margins are where it is not.
   *
   * Null when the window turned out to be blank. A blank window is not evidence
   * of anything, and blocking the shutter on it would refuse a lightly-written
   * page for being lightly written.
   */
  function focusInPageOnMainThread(quadInProxy, pw, ph, vw, vh, pageLongEdge) {
    const inFrame = quadInProxy.map((p) => ({ x: p.x * (vw / pw), y: p.y * (vh / ph) }));
    const rect = focusWindowRect(inFrame, vw, vh, pageLongEdge, FOCUS_WINDOW);
    if (!rect) return null;
    focusCtx.drawImage(video, rect.sx, rect.sy, rect.size, rect.size, 0, 0, rect.target, rect.target);
    // scale: 1 — these pixels are already at the canonical scale, and letting
    // sharpness() resample them again would measure the resampler.
    const read = sharpness(focusCtx.getImageData(0, 0, rect.target, rect.target), { scale: 1 });
    return read.blank ? null : read.score;
  }

  function blankState() {
    return {
      hasPage: false,
      fill: 0,
      pageLongEdge: 0,
      sharpness: null,
      glare: 0,
      clipping: 0,
      headroom: 0,
      skew: 0,
      steady: false,
      /** What the student is told, right now. One line, actionable. */
      hint: 'Lay the page flat and fit all four corners in the frame',
      blocking: null,
      // detectMs/measureMs/focusMs for this search, or null before the first
      // one has run. See recordStepTiming() — AXON_SCAN_LAG_BRIEF.md §0.
      timing: null,
    };
  }

  /**
   * @param {Promise<MediaStream>|MediaStream|Error|null} [adopt]
   *   A stream someone else already asked for. app.js fires the request the
   *   moment the Scan tab opens, well before this module has finished loading,
   *   so by the time we get here the permission sheet is usually already
   *   answered. Passing the rejection through as a value rather than a rejected
   *   promise keeps that early request from becoming an unhandled rejection.
   */
  async function start(adopt = null) {
    if (running) return;
    const resolved = adopt ? await adopt : await requestCamera();
    if (resolved instanceof Error) throw resolved;
    stream = resolved;
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    await video.play();
    running = true;
    armed = true;
    loop();
    detect();

    const track = stream.getVideoTracks?.()[0] ?? null;
    imageCapture = null;
    capturePath = 'canvas-grab';
    if (track && typeof ImageCapture !== 'undefined') {
      try {
        const candidate = new ImageCapture(track);
        // Some implementations construct successfully but throw the first time
        // they are actually asked anything — this is the cheapest real probe.
        await candidate.getPhotoCapabilities();
        imageCapture = candidate;
        capturePath = 'image-capture';
      } catch {
        imageCapture = null;
        capturePath = 'canvas-grab';
      }
    }
    if (track) requestContinuousFocus(track);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafHandle);
    clearTimeout(detectHandle);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    quad = lastDetection = steadyAnchor = lastSearchSize = null;
    steadySince = heldSince = consecutiveFinds = 0;
    imageCapture = null;
    capturePath = 'canvas-grab';
    // Clear the shared request too, or the next visit adopts a stream whose
    // tracks have already been stopped and shows a black viewfinder.
    releaseCamera();
    // Deliberately not tearing down detectWorker here — see its own comment.
    // It is module-level and outlives one Scan visit on purpose.
  }

  // ── the search ───────────────────────────────────────────────────────────

  async function detect() {
    if (!running) return;
    // Nothing to look at while the tab is in the background, and a camera search
    // running behind another app is battery spent on nobody.
    if (document.hidden) {
      detectHandle = setTimeout(detect, DETECT_MAX_INTERVAL_MS);
      return;
    }
    const started = performance.now();
    try { await step(); } catch { /* a bad frame is not worth stopping the camera for */ }
    const cost = performance.now() - started;
    // Back off in proportion to what the last search actually cost, so a slow
    // phone searches less often rather than searching just as often and dropping
    // frames to do it.
    const wait = Math.min(DETECT_MAX_INTERVAL_MS, Math.max(DETECT_INTERVAL_MS, cost / DETECT_DUTY));
    detectHandle = setTimeout(detect, wait);
  }

  /**
   * One search cycle: find the page in the current video frame, on the
   * detect worker when one is available and on this thread when it is not.
   * `finishStep` does the rest — the parts that were never the expensive
   * part (steadiness bookkeeping, the gate, auto-capture) and have no
   * reason to move off this thread.
   */
  async function step() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;

    const pw = PROXY_WIDTH, ph = Math.round(PROXY_WIDTH * vh / vw);
    lastSearchSize = { width: pw, height: ph };

    const workerUsed = !!ensureDetectWorker();
    const result = workerUsed
      ? await searchOnWorker(pw, ph, vw, vh)
      : searchOnMainThread(pw, ph, vw, vh);

    finishStep(result, workerUsed, pw, ph, vw, vh);
  }

  /**
   * scan-ground-up-revamp-2026-09-07.md Phase 1: the primary path. Two
   * round trips, because they need different data — the small proxy frame
   * for `detectQuad`/`measureQuad`, and (only once a quad exists to focus
   * on) a native-resolution crop for `sharpness`. Both are `createImageBitmap`
   * grabs off the live `<video>` rather than a `drawImage` + `getImageData`
   * pixel readback on this thread — the readback is exactly the part that
   * used to compete with rendering for this thread's time, and it now
   * happens in the worker instead, against a transferred bitmap.
   *
   * A search or focus round trip that comes back null (worker unavailable,
   * timed out, or the message itself failed) is treated the same as a
   * legitimate not-found — it costs one cycle, and the next one tries again,
   * matching the fallback's own per-call try/catch.
   */
  async function searchOnWorker(pw, ph, vw, vh) {
    const proxyBitmap = await createImageBitmap(video, { resizeWidth: pw, resizeHeight: ph });
    const search = await runDetectWorker('search', proxyBitmap);
    if (!search?.found) return { found: null, detectMs: search?.detectMs ?? 0, measureMs: 0, focusMs: 0 };

    const size = quadSize(search.found);
    const pageLongEdge = Math.round(Math.max(size.width, size.height) * (vw / pw));
    const inFrame = search.found.map((p) => ({ x: p.x * (vw / pw), y: p.y * (vh / ph) }));
    const rect = focusWindowRect(inFrame, vw, vh, pageLongEdge, FOCUS_WINDOW);

    let sharpnessScore = null, focusMs = 0;
    if (rect) {
      const focusBitmap = await createImageBitmap(
        video, rect.sx, rect.sy, rect.size, rect.size,
        { resizeWidth: rect.target, resizeHeight: rect.target },
      );
      const focus = await runDetectWorker('focus', focusBitmap);
      sharpnessScore = focus?.sharpness ?? null;
      focusMs = focus?.focusMs ?? 0;
    }

    return {
      found: search.found, exposure: search.exposure, skew: search.skew, pageLongEdge,
      sharpness: sharpnessScore, detectMs: search.detectMs, measureMs: search.measureMs, focusMs,
    };
  }

  /**
   * The pre-Phase-1 search, kept as the degrade path for a browser that
   * cannot construct a module Worker, or once one has errored. Identical to
   * what this function did before the worker existed — same canvases, same
   * calls, same order — because a fallback that behaves differently from
   * what it replaces is a second thing to get right, not one.
   */
  function searchOnMainThread(pw, ph, vw, vh) {
    if (proxy.width !== pw || proxy.height !== ph) { proxy.width = pw; proxy.height = ph; }
    proxyCtx.drawImage(video, 0, 0, pw, ph);
    const frame = proxyCtx.getImageData(0, 0, pw, ph);

    const tDetectStart = performance.now();
    const found = detectQuad(frame);
    const detectMs = performance.now() - tDetectStart;
    if (!found) return { found: null, detectMs, measureMs: 0, focusMs: 0 };

    const tMeasureStart = performance.now();
    const exposure = measureQuad(frame, found);
    const skew = skewDegrees(found);
    const measureMs = performance.now() - tMeasureStart;

    const size = quadSize(found);
    const pageLongEdge = Math.round(Math.max(size.width, size.height) * (vw / pw));

    const tFocusStart = performance.now();
    const sharpnessScore = focusInPageOnMainThread(found, pw, ph, vw, vh, pageLongEdge);
    const focusMs = performance.now() - tFocusStart;

    return { found, exposure, skew, pageLongEdge, sharpness: sharpnessScore, detectMs, measureMs, focusMs };
  }

  /**
   * Everything after a search result exists: steadiness bookkeeping, the
   * live gate, publishing state, and the auto-capture decision. None of
   * this was ever the expensive part, so none of it moved — same logic,
   * same order, as before Phase 1, just no longer entangled with finding
   * the quad in the first place.
   */
  function finishStep(result, workerUsed, pw, ph, vw, vh) {
    // step() is async now — a search can still be waiting on the worker
    // when stop() runs (tab navigated away mid-search) and land after it.
    // The old synchronous step() could never straddle a stop() this way;
    // this guard keeps that same guarantee rather than publishing state for
    // a camera that has already been torn down.
    if (!running) return;
    const next = blankState();
    // AXON_SCAN_LAG_BRIEF.md §0 / scan-ground-up-revamp Phase 5 — the wall-clock
    // cost of one detection pass, split by stage, plus which thread it ran
    // on. Temporary instrumentation, landed rather than dropped: this is
    // what a "the border takes forever" report has to be measured against.
    next.timing = {
      detectMs: result.detectMs, measureMs: result.measureMs, focusMs: result.focusMs, workerUsed,
    };
    recordStepTiming(next.timing);

    if (!result.found) {
      lastDetection = steadyAnchor = null;
      steadySince = heldSince = consecutiveFinds = 0;
      quad = null;
      // Losing the page is what re-arms auto-capture. Without this, the first
      // automatic shot was the only one: `armed` went false on firing and was
      // only ever set back by a *blocking* frame, so lifting the phone to the
      // next page — which simply loses the quad — left it disarmed for the rest
      // of the session.
      armed = true;
      publish(next);
      return;
    }

    const found = result.found;
    next.hasPage = true;
    next.fill = quadFill(found, pw, ph);
    next.glare = result.exposure.glare;
    next.clipping = result.exposure.clipping;
    next.headroom = result.exposure.headroom;
    // Angle-only, so scale-invariant — this reads the same on the 240px
    // search proxy as it would on the full frame.
    next.skew = result.skew;
    consecutiveFinds++;

    // How big the page will be once it is warped flat, in the camera's own
    // pixels. This is the number the quality gate will judge the page on, so it
    // is the number the advice should come from — telling someone to move closer
    // because the page covers less than a third of a *frame* is advice about the
    // wrong thing, and it is wrong whenever the frame is mostly desk.
    next.pageLongEdge = result.pageLongEdge;

    // Focus, measured on real pixels at the scale the final gate will use.
    // Null rather than zero when the window landed on blank paper: "we could
    // not measure this" and "this is out of focus" are different claims and the
    // gate must not act on the first as though it were the second.
    next.sharpness = result.sharpness;

    const window_ = steadyWindow({
      anchor: steadyAnchor, found, width: pw, height: ph,
      since: steadySince, now: performance.now(),
    });
    steadyAnchor = window_.anchor;
    steadySince = window_.since;
    lastDetection = found;
    next.steady = window_.steady;

    quad = easeQuad(quad, scaleQuad(found, { width: pw, height: ph }, { width: vw, height: vh }));

    // ── the gate ───────────────────────────────────────────────────────────
    // See liveGateVerdict() above for the ordering and the reasoning behind
    // it — kept as one implementation rather than repeated here.
    const verdict = liveGateVerdict(next);
    next.blocking = verdict.blocking;
    next.hint = verdict.hint;

    // How long the page has been continuously found with nothing blocking. The
    // clock runs on the gate, not on stillness, so it survives the jitter that
    // steadiness is fussy about.
    if (next.blocking) heldSince = 0;
    else if (!heldSince) heldSince = performance.now();
    const heldFor = heldSince ? performance.now() - heldSince : 0;

    // Held a while and still not called steady: say so honestly rather than
    // repeating an instruction the student is already following.
    if (!next.blocking && !next.steady && heldFor > 1800) next.hint = 'Almost — keep it there';

    publish(next);

    if (shouldAutoCapture({
      autoCapture, armed, blocking: next.blocking,
      steady: next.steady, heldFor, consecutiveFinds,
    })) {
      armed = false;
      shoot(true);
    }
    if (next.blocking) armed = true;
  }

  function publish(next) {
    state = next;
    onState?.(next);
  }

  // ── the overlay ──────────────────────────────────────────────────────────
  // Corner brackets on the detected quad, drawn every frame from whatever the
  // last search found. No decorative motion: the capture flow is the one place
  // CLAUDE.md gives a zero budget for it.

  function loop() {
    if (!running) return;
    rafHandle = requestAnimationFrame(loop);

    const rect = video.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!quad || !video.videoWidth) return;

    // The video is object-fit: cover, so the drawn frame is cropped, not
    // letterboxed. Mapping has to match or the brackets sit off the page.
    const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
    const offsetX = (w - video.videoWidth * scale) / 2;
    const offsetY = (h - video.videoHeight * scale) / 2;
    const points = quad.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }));

    ctx.strokeStyle = state.blocking ? 'rgba(255,159,10,.95)' : 'rgba(255,255,255,.95)';
    ctx.lineWidth = 3 * dpr;
    ctx.lineCap = 'round';

    // Brackets rather than a full outline, matching the viewfinder in
    // index.html: an outline hides the page edge it is meant to confirm.
    const armLength = 26 * dpr;
    for (let i = 0; i < 4; i++) {
      const p = points[i];
      for (const q of [points[(i + 1) % 4], points[(i + 3) % 4]]) {
        const dx = q.x - p.x, dy = q.y - p.y;
        const length = Math.hypot(dx, dy) || 1;
        const t = Math.min(armLength, length * 0.4) / length;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx * t, p.y + dy * t);
        ctx.stroke();
      }
    }
  }

  // ── the shutter ──────────────────────────────────────────────────────────

  /**
   * A real photographic still where the platform can give one, a video-frame
   * grab where it can't. The primary path never touches the `<video>` element
   * at all — `takePhoto()` talks to the camera hardware directly, at whatever
   * resolution `getPhotoCapabilities()` reported, with a real per-shot
   * autofocus/exposure pass. The fallback is the old canvas grab, with a
   * settle delay inserted because that path previously grabbed with zero wait
   * after "the gate says go" and a live stream's autofocus is asynchronous.
   */
  async function grabStill() {
    if (imageCapture) {
      try {
        // `takePhoto()` hands back the encoder's own bytes. Those are the
        // original — kept and carried up rather than decoded and dropped, so
        // §7.6.4's "never discard the original" costs nothing on this path.
        const blob = await imageCapture.takePhoto();
        return { bitmap: await createImageBitmap(blob), path: 'image-capture', original: blob };
      } catch {
        // A track that advertised photo capabilities but refused the actual
        // shot (seen on some Android/Chromium builds) — fall through rather
        // than losing the page.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, CAPTURE.SETTLE_MS));
    if (!video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    // No encoder bytes on this path — the frame came off a video element — so
    // the original has to be made. q95 rather than the pipeline's own 0.92:
    // this is the copy a mistake gets recovered from, and it should be the
    // least degraded thing stored, not merely as good as the derivative.
    const original = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    return { bitmap: await createImageBitmap(canvas), path: 'canvas-grab', original };
  }

  /**
   * Does the quad the live gate found still hold up against the frame that
   * was actually captured? A rescaled 240px guess is exactly that — a guess —
   * and warping the page through a bad one is worse than not warping it at
   * all. Failing this does not retry detection at full resolution (a Hough
   * search over an eight-megapixel image is not a per-shot cost this budget
   * can absorb); it falls back to no quad, which conditionPage already
   * handles by resampling without perspective correction rather than warping
   * through a shape that turned out not to be there.
   */
  async function verifyQuad(bitmap, quad) {
    const scale = Math.min(1, VERIFY_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    const scaled = scaleQuad(quad, { width: bitmap.width, height: bitmap.height }, { width: w, height: h });
    if (!isPageShaped(scaled, w, h)) return false;
    return paperScore(ctx.getImageData(0, 0, w, h), scaled).paper >= VERIFY_PAPER_MIN;
  }

  async function shoot(auto = false) {
    if (!running || !video.videoWidth) return null;
    const tShotStart = performance.now();
    const captured = await grabStill();
    const grabMs = performance.now() - tShotStart;
    if (!captured) return null;
    const { bitmap, path, original } = captured;

    // The quad travels with the frame so conditioning can warp it. Scaled into
    // the captured still's own pixel space, which is the video's for a canvas
    // grab but is whatever the sensor actually returned for takePhoto() — the
    // two are not always the same size.
    let shotQuad = lastDetection
      ? scaleQuad(lastDetection,
          lastSearchSize ?? { width: proxy.width, height: proxy.height },
          { width: bitmap.width, height: bitmap.height })
      : null;

    const tVerifyStart = performance.now();
    if (shotQuad && !(await verifyQuad(bitmap, shotQuad))) shotQuad = null;
    const verifyMs = performance.now() - tVerifyStart;

    // AXON_SCAN_LAG_BRIEF.md §0 — shoot() → onShot, split by stage. This is
    // the whole of the "shutter fired, nothing happens for a beat" gap on the
    // capture side; ui.js/pipeline.js pick up the rest of it (acceptPage,
    // paintTray) on the other side of onShot.
    const timing = { grabMs: +grabMs.toFixed(1), verifyMs: +verifyMs.toFixed(1) };
    console.debug('[scan:shoot-timing]', { auto, capturePath: path, ...timing });

    const shot = { bitmap, quad: shotQuad, auto, capturePath: path, original, gate: { ...state }, timing };
    onShot?.(shot);
    // Re-arm on the next frame that is not ready, so holding steady over one
    // page does not fire twice, and turning to the next page fires once.
    armed = false;
    return shot;
  }

  return {
    start,
    stop,
    shoot: () => shoot(false),
    get state() { return state; },
    setAutoCapture(on) { autoCapture = !!on; armed = true; },
    get autoCapture() { return autoCapture; },
    /** 'image-capture' or 'canvas-grab' — which shutter path this session is using. */
    get capturePath() { return capturePath; },
    /** Whether a camera exists at all. Upload is a first-class path, not a fallback. */
    supported: !!navigator.mediaDevices?.getUserMedia,
  };
}
