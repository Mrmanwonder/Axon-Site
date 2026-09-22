// Stage 0 · capture.
//
// The viewfinder, gate and shutter are a transaction. Live tracking is only a
// prediction about a future photograph; the saved still is re-detected and
// re-measured before automatic capture is allowed to commit it.

import { CAPTURE, CONDITIONING, ENHANCE, QUALITY } from './contract.js';
import {
  FALLBACK_CAPTURE_HEIGHT, FALLBACK_CAPTURE_WIDTH,
  releaseCamera, requestCamera, requestContinuousFocus, requestFallbackCaptureResolution,
} from './camera.js';
import { detectQuad, easeQuad, scaleQuad } from './edges.js';
import { focusWindowRect, measureQuad, sharpness, skewDegrees } from './quality.js';
import { quadDrift, quadFill, quadSize } from './geometry.js';
import {
  acquire, createTrack, documentConfidence, geometryValid, isSameDocument,
  needsGlobal, observe, quadOf, searchWindows,
} from './track.js';

const DETECT_INTERVAL_MS = 80;
const DETECT_MAX_INTERVAL_MS = 320;
const DETECT_TIMEOUT_MS = DETECT_MAX_INTERVAL_MS * 3;
const DETECT_DUTY = 0.3;
const PROXY_WIDTH = 360;
const TRACK_WIDTH = 720;
const FOCUS_WINDOW = 384;
const MEASUREMENT_STALE_MS = 900;
const VIEWPORT_SCALE_TOLERANCE = 0.01;
const STILL_ANALYSIS_LONG_EDGE = 720;
const AUTO_RETRY_COOLDOWN_MS = 550;
const TRACK_CONFIDENCE_FLOOR = 0.64;
const FOCUS_BREATHING_AREA_DELTA = 0.05;
const NATIVE_PHOTO_TIMEOUT_MS = 1200;
const VIDEO_FRAME_TIMEOUT_MS = 220;
const STILL_MIN_FILL = 0.07;
const DETECT_TIMEOUT_LIMIT = 2;

export const CAPTURE_CONFIRM_TIMING = Object.freeze({
  freezeEnd: 40,
  morphEnd: 90,
  edgesEnd: 160,
  end: 180,
});

export const PAPER_EVIDENCE_CONFIRMATIONS = 2;
export const PAPER_EVIDENCE_LOSS_MS = 700;
export const SEARCH_GUIDANCE = Object.freeze({
  blocking: null,
  hint: 'Fit all four page corners in frame',
});

function viewportScale() {
  return globalThis.visualViewport?.scale ?? 1;
}

function viewportScaled() {
  return Math.abs(viewportScale() - 1) > VIEWPORT_SCALE_TOLERANCE;
}

/**
 * Source rectangle visible through an object-fit: cover preview.
 *
 * Global detection must search what the student can actually see. On a portrait
 * phone a 16:9 camera stream can be horizontally cropped by more than half; the
 * old detector searched those invisible sensor margins and then rejected the
 * visible sheet for occupying too little of the full source frame.
 */
export function coverCropRect(sourceWidth, sourceHeight, viewWidth, viewHeight) {
  if (!(sourceWidth > 0 && sourceHeight > 0 && viewWidth > 0 && viewHeight > 0)) {
    return { x: 0, y: 0, width: Math.max(1, sourceWidth || 1), height: Math.max(1, sourceHeight || 1) };
  }
  const sourceAspect = sourceWidth / sourceHeight;
  const viewAspect = viewWidth / viewHeight;
  if (sourceAspect > viewAspect) {
    const width = sourceHeight * viewAspect;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / viewAspect;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));

// cubic-bezier(0.2, 0.9, 0.2, 1), solved from x to y. The strong initial
// response makes the confirmation read as feedback rather than progress.
export function captureConfirmEase(progress) {
  const x = clamp01(progress);
  const sample = (a, b, t) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  const slope = (a, b, t) => 3 * a * (1 - t) ** 2
    + 6 * (b - a) * (1 - t) * t
    + 3 * (1 - b) * t ** 2;
  let t = x;
  for (let i = 0; i < 5; i++) {
    const dx = sample(0.2, 0.2, t) - x;
    const d = slope(0.2, 0.2, t);
    if (Math.abs(dx) < 0.0001 || Math.abs(d) < 0.0001) break;
    t = clamp01(t - dx / d);
  }
  return sample(0.9, 1, t);
}

export function captureConfirmFrame(elapsedMs, reducedMotion = false) {
  if (elapsedMs < 0 || elapsedMs >= CAPTURE_CONFIRM_TIMING.end) {
    return { active: false, morph: 0, edges: 0, opacity: 0 };
  }
  if (reducedMotion) {
    const fadeStart = 120;
    return {
      active: true,
      morph: 1,
      edges: 1,
      opacity: elapsedMs < fadeStart
        ? 1
        : 1 - clamp01((elapsedMs - fadeStart) / (CAPTURE_CONFIRM_TIMING.end - fadeStart)),
    };
  }
  const morph = captureConfirmEase(
    (elapsedMs - CAPTURE_CONFIRM_TIMING.freezeEnd)
      / (CAPTURE_CONFIRM_TIMING.morphEnd - CAPTURE_CONFIRM_TIMING.freezeEnd),
  );
  const edges = captureConfirmEase(
    (elapsedMs - CAPTURE_CONFIRM_TIMING.morphEnd)
      / (CAPTURE_CONFIRM_TIMING.edgesEnd - CAPTURE_CONFIRM_TIMING.morphEnd),
  );
  const opacity = elapsedMs < CAPTURE_CONFIRM_TIMING.edgesEnd
    ? 1
    : 1 - clamp01(
        (elapsedMs - CAPTURE_CONFIRM_TIMING.edgesEnd)
          / (CAPTURE_CONFIRM_TIMING.end - CAPTURE_CONFIRM_TIMING.edgesEnd),
      );
  return { active: true, morph, edges, opacity };
}

export function isVerifiedQuad(candidate) {
  return Array.isArray(candidate) && candidate.length === 4
    && candidate.every((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
}

export function resolveOverlayPhase({
  confirming = false,
  hasQuad = false,
  trackState = 'searching',
  trackConfidence = 0,
  scaledViewport = false,
} = {}) {
  if (confirming) return 'captured-confirm';
  if (hasQuad && trackState === 'tracking'
      && trackConfidence >= TRACK_CONFIDENCE_FLOOR && !scaledViewport) return 'locked';
  return 'searching';
}

/** Whether automatic capture is allowed to fire on this frame. */
export function shouldAutoCapture({
  autoCapture, armed, blocking, consecutiveFinds, globalConfirmations = 0,
  trackState = 'tracking', viewportScaled = false, processing = false,
}) {
  if (!autoCapture || !armed || blocking || viewportScaled || processing) return false;
  if (consecutiveFinds < CAPTURE.CONSECUTIVE_FINDS) return false;
  if (globalConfirmations < PAPER_EVIDENCE_CONFIRMATIONS) return false;
  if (trackState !== 'tracking') return false;
  return true;
}

export const MIN_EDGE_COVERAGE = 0.72;
export const LIVE_SOURCE_FLOOR = Math.ceil(CONDITIONING.MIN_LONG_EDGE / ENHANCE.MAX_SCALE);

/** One authoritative quality verdict for both live guidance and captured stills. */
export function liveGateVerdict(
  {
    glare, clipping, fill, edgeCoverage = 1, sharpness, skew, pageLongEdge,
    resolutionStatus = 'known', qualityReady = true, geometryReady = true,
  },
  holding = null,
) {
  const easing = (reason) => (holding === reason ? 1 + GUIDANCE_HYSTERESIS : 1);

  if (!geometryReady) {
    return { blocking: 'tracking', hint: 'Hold steady while I lock onto all four corners' };
  }
  if (resolutionStatus !== 'unknown'
      && pageLongEdge < LIVE_SOURCE_FLOOR * easing('resolution')) {
    return { blocking: 'resolution', hint: 'Move a little closer while keeping all four paper corners visible' };
  }
  if (edgeCoverage < MIN_EDGE_COVERAGE * easing('distance')) {
    return { blocking: 'distance', hint: 'Move closer while keeping all four paper corners visible' };
  }
  if (!qualityReady) {
    return { blocking: 'measuring', hint: 'Hold steady for a moment' };
  }
  if (glare > QUALITY.GLARE_WARN / easing('glare')) {
    return { blocking: 'glare', hint: 'Light is bouncing off the page — tilt it slightly away from the light' };
  }
  if (clipping > QUALITY.CLIP_WARN / easing('exposure')) {
    return { blocking: 'exposure', hint: 'Too bright — move into shade, or turn a lamp away from the page' };
  }
  if (sharpness !== null && sharpness < QUALITY.BLUR_WARN * easing('focus')) {
    return { blocking: 'focus', hint: 'Hold still — the page is not sharp yet' };
  }
  if (skew > QUALITY.SKEW_WARN_DEG) {
    return { blocking: null, hint: 'Square the page up a little if you can' };
  }
  return { blocking: null, hint: 'Ready' };
}

export const GUIDANCE_DWELL_MS = 700;
export const GUIDANCE_HYSTERESIS = 0.05;

/**
 * Paper presence is deliberately stricter than a detector hit. A single
 * document-shaped rectangle is only a candidate; two agreeing global searches
 * plus a healthy local track are evidence. Once confirmed, brief corner misses
 * retain that evidence so guidance cannot bounce back to searching frame by
 * frame.
 */
export function settledPaperEvidence(
  showing,
  { globalConfirmations = 0, geometryReady = false, observedGeometry = false },
  now,
) {
  const current = showing ?? { confirmed: false, lastObservedAt: null };
  const confirmedNow = geometryReady
    && globalConfirmations >= PAPER_EVIDENCE_CONFIRMATIONS;

  if (!current.confirmed) {
    return confirmedNow
      ? { confirmed: true, lastObservedAt: now }
      : { confirmed: false, lastObservedAt: null };
  }
  if (observedGeometry || confirmedNow) {
    return { confirmed: true, lastObservedAt: now };
  }
  if (current.lastObservedAt != null
      && now - current.lastObservedAt < PAPER_EVIDENCE_LOSS_MS) {
    return current;
  }
  return { confirmed: false, lastObservedAt: null };
}

export function settledScannerGuidance(showing, verdict, paperEvidence, now) {
  return settledGuidance(
    showing,
    paperEvidence?.confirmed ? verdict : SEARCH_GUIDANCE,
    now,
  );
}

export function settledGuidance(showing, verdict, now) {
  const settled = { hint: verdict.hint, blocking: verdict.blocking, since: now };
  if (!showing || showing.hint === verdict.hint) {
    return { ...settled, since: showing?.since ?? now };
  }
  // Entering/leaving a blocking state affects capture correctness, so it is
  // immediate. Switching between two pieces of advice is debounced.
  if (!showing.blocking !== !verdict.blocking) return settled;
  if (now - showing.since < GUIDANCE_DWELL_MS) return showing;
  return settled;
}

// ── worker bridge ──────────────────────────────────────────────────────────
let detectWorker = null;
let nextDetectId = 1;
let detectTimeouts = 0;
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
      detectTimeouts = 0;
      resolve(rest);
    };
    detectWorker.onerror = (event) => {
      console.error('[scan] detect worker failed, falling back to main-thread search', {
        message: event?.message, filename: event?.filename, lineno: event?.lineno,
      });
      detectWorker = false;
      detectTimeouts = 0;
    };
  } catch {
    detectWorker = false;
  }
  return detectWorker;
}

function runDetectWorker(kind, bitmap, extra = null) {
  const w = ensureDetectWorker();
  if (!w) { bitmap.close?.(); return Promise.resolve(null); }
  const id = nextDetectId++;
  return new Promise((resolve) => {
    let done = false;
    let timeout = 0;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      detectPending.delete(id);
      resolve(value);
    };
    detectPending.set(id, finish);
    timeout = setTimeout(() => {
      detectTimeouts++;
      finish(null);
      // A worker that repeatedly misses its deadline is not a worker path at
      // all. Falling back to the 360px main-thread detector is preferable to a
      // scanner that can search forever without ever publishing a page.
      if (detectTimeouts >= DETECT_TIMEOUT_LIMIT && detectWorker === w) {
        w.terminate?.();
        detectWorker = false;
        detectTimeouts = 0;
      }
    }, DETECT_TIMEOUT_MS);
    w.postMessage({ id, kind, bitmap, ...extra }, [bitmap]);
  });
}

/**
 * @param {Object} options
 * @param {HTMLVideoElement} options.video
 * @param {HTMLCanvasElement} options.overlay
 * @param {(state:Object) => void} options.onState
 * @param {(shot:Object) => void} options.onShot
 */
export function createCapture({ video, overlay, onState, onShot }) {
  let stream = null;
  let running = false;
  let rafHandle = 0;
  let videoFrameHandle = 0;
  let frameClock = null;
  let lastRenderedFrame = -1;
  let detectHandle = 0;

  let track = createTrack();
  let trackSize = null;
  let trackInFlight = false;
  let lastTrackedFrame = -1;
  let lastTrackedArea = null;
  let measured = null;
  let measuredAt = 0;
  let measuredQuad = null;
  let guidance = null;
  let paperEvidence = null;
  let captureConfirmation = null;
  let overlayPhase = 'searching';

  let quad = null;
  let consecutiveFinds = 0;
  let globalConfirmations = 0;
  let autoCapture = true;
  let armed = true;
  let processingHold = false;
  let autoRetryAfter = 0;

  let imageCapture = null;
  let photoSettings = null;
  let capturePath = 'canvas-grab';
  let shootInFlight = false;
  let state = blankState();
  let nextTransactionId = 1;

  const stepStats = { count: 0, sumMs: 0, maxMs: 0, lastFlush: 0 };

  function recordStepTiming({ detectMs = 0, measureMs = 0, focusMs = 0, workerUsed = false }) {
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

  // Worker startup is paid while camera permission / the first frame is arriving.
  ensureDetectWorker();

  function focusInFrameOnMainThread(source, quadInFrame, sw, sh, pageLongEdge) {
    const rect = focusWindowRect(quadInFrame, sw, sh, pageLongEdge, FOCUS_WINDOW);
    if (!rect) return null;
    focusCtx.drawImage(source, rect.sx, rect.sy, rect.size, rect.size, 0, 0, rect.target, rect.target);
    const read = sharpness(focusCtx.getImageData(0, 0, rect.target, rect.target), { scale: 1 });
    return read.blank ? null : read.score;
  }

  function visibleSourceCrop(vw = video.videoWidth, vh = video.videoHeight) {
    const rect = video.getBoundingClientRect();
    return coverCropRect(vw, vh, rect.width, rect.height);
  }

  function cropQuadToVideo(quadInCrop, crop, pw, ph) {
    return quadInCrop.map((p) => ({
      x: crop.x + p.x * (crop.width / pw),
      y: crop.y + p.y * (crop.height / ph),
    }));
  }

  function blankState() {
    return {
      hasPage: false,
      fill: 0,
      edgeCoverage: 0,
      pageLongEdge: 0,
      resolutionStatus: capturePath === 'image-capture' ? 'unknown' : 'known',
      sharpness: null,
      glare: 0,
      clipping: 0,
      headroom: 0,
      skew: 0,
      geometryReady: false,
      qualityReady: false,
      steady: true,
      hint: SEARCH_GUIDANCE.hint,
      blocking: null,
      trackState: 'searching',
      trackConfidence: 0,
      timing: null,
    };
  }

  let activation = 0;
  async function start(adopt = null) {
    const generation = ++activation;
    if (running) return;
    const resolved = adopt ? await adopt : await requestCamera();
    if (resolved instanceof Error) throw resolved;
    if (generation !== activation) {
      resolved?.getTracks?.().forEach((cameraTrack) => cameraTrack.stop());
      return;
    }
    stream = resolved;

    video.autoplay = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.srcObject = stream;
    await video.play();
    if (generation !== activation) {
      resolved.getTracks().forEach((cameraTrack) => cameraTrack.stop());
      return;
    }
    running = true;
    armed = true;

    const cameraTrack = stream.getVideoTracks?.()[0] ?? null;
    imageCapture = null;
    photoSettings = null;
    capturePath = 'canvas-grab';

    if (cameraTrack && typeof ImageCapture !== 'undefined') {
      try {
        const candidate = new ImageCapture(cameraTrack);
        const caps = await candidate.getPhotoCapabilities();
        if (generation !== activation) return;
        imageCapture = candidate;
        capturePath = 'image-capture';
        const maxW = Number(caps?.imageWidth?.max ?? 0);
        const maxH = Number(caps?.imageHeight?.max ?? 0);
        const minW = Number(caps?.imageWidth?.min ?? 0);
        const minH = Number(caps?.imageHeight?.min ?? 0);
        const targetW = Math.min(maxW, FALLBACK_CAPTURE_WIDTH);
        const targetH = Math.min(maxH, FALLBACK_CAPTURE_HEIGHT);
        photoSettings = {
          ...(targetW > 0 && targetW >= minW ? { imageWidth: targetW } : {}),
          ...(targetH > 0 && targetH >= minH ? { imageHeight: targetH } : {}),
        };
      } catch {
        imageCapture = null;
        photoSettings = null;
        capturePath = 'canvas-grab';
      }
    }

    if (cameraTrack && !imageCapture) await requestFallbackCaptureResolution(cameraTrack);
    if (cameraTrack) await requestContinuousFocus(cameraTrack);

    loop();
    detect();
  }

  function stop() {
    ++activation;
    running = false;
    if (frameClock === 'video') video.cancelVideoFrameCallback?.(videoFrameHandle);
    else cancelAnimationFrame(rafHandle);
    videoFrameHandle = rafHandle = 0;
    frameClock = null;
    lastRenderedFrame = -1;
    clearTimeout(detectHandle);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    quad = null;
    consecutiveFinds = globalConfirmations = 0;
    track = createTrack();
    trackSize = measured = measuredQuad = guidance = paperEvidence = null;
    captureConfirmation = null;
    overlayPhase = 'searching';
    lastTrackedFrame = -1;
    lastTrackedArea = null;
    measuredAt = 0;
    trackInFlight = false;
    imageCapture = null;
    photoSettings = null;
    capturePath = 'canvas-grab';
    processingHold = false;
    autoRetryAfter = 0;
    video.style.removeProperty('transform');
    releaseCamera();
  }

  // ── live search ──────────────────────────────────────────────────────────
  async function detect() {
    if (!running) return;
    if (document.hidden) {
      detectHandle = setTimeout(detect, DETECT_MAX_INTERVAL_MS);
      return;
    }
    const started = performance.now();
    try {
      // A tentative rectangle gets another independent whole-frame search
      // immediately. Local corner tracking alone must not promote a face or a
      // background rectangle into user-visible paper guidance.
      if (globalConfirmations < PAPER_EVIDENCE_CONFIRMATIONS || needsGlobal(track, started)) await step();
      else await measureStep(video.videoWidth, video.videoHeight);
    } catch { /* one bad frame costs one cycle */ }
    const cost = performance.now() - started;
    const wait = Math.min(DETECT_MAX_INTERVAL_MS, Math.max(DETECT_INTERVAL_MS, cost / DETECT_DUTY));
    detectHandle = setTimeout(detect, wait);
  }

  async function step() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    const pw = PROXY_WIDTH, ph = Math.round(PROXY_WIDTH * vh / vw);
    const workerUsed = !!ensureDetectWorker();
    const result = workerUsed
      ? await searchOnWorker(pw, ph, vw, vh)
      : searchOnMainThread(pw, ph, vw, vh);
    track.lastGlobalDetection = performance.now();
    finishStep(result, workerUsed, pw, ph, vw, vh);
  }

  async function trackStep() {
    if (trackInFlight || !running || document.hidden) return;
    if (!ensureDetectWorker()) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh || !trackSize) return;
    if (video.currentTime === lastTrackedFrame) return;
    lastTrackedFrame = video.currentTime;
    const { width: tw, height: th } = trackSize;
    const windows = searchWindows(track, performance.now(), { width: tw, height: th });
    if (!windows.length) return;

    trackInFlight = true;
    try {
      const bitmap = await createImageBitmap(video, { resizeWidth: tw, resizeHeight: th });
      const reply = await runDetectWorker('track', bitmap, { windows });
      if (!running) return;
      track = observe(track, reply?.observations ?? {}, performance.now(), { width: tw, height: th });
      publishFromTrack(tw, th, vw, vh, reply?.trackMs ?? 0);
    } catch {
      /* one bad frame costs one tracking cycle */
    } finally {
      trackInFlight = false;
    }
  }

  async function searchOnWorker(pw, ph, vw, vh) {
    const proxyBitmap = await createImageBitmap(video, { resizeWidth: pw, resizeHeight: ph });
    const search = await runDetectWorker('search', proxyBitmap);
    if (!search?.found) {
      return { found: null, detectMs: search?.detectMs ?? 0, measureMs: 0, focusMs: 0 };
    }
    const size = quadSize(search.found);
    const pageLongEdge = Math.round(Math.max(size.width, size.height) * (vw / pw));
    const { sharpness: sharpnessScore, focusMs } =
      await focusOnWorker(video, search.found, pw, ph, vw, vh, pageLongEdge);
    return {
      found: search.found,
      exposure: search.exposure,
      skew: search.skew,
      pageLongEdge,
      sharpness: sharpnessScore,
      detectMs: search.detectMs,
      measureMs: search.measureMs,
      focusMs,
    };
  }

  async function focusOnWorker(source, quadInProxy, pw, ph, sw, sh, pageLongEdge) {
    const inFrame = quadInProxy.map((p) => ({ x: p.x * (sw / pw), y: p.y * (sh / ph) }));
    const rect = focusWindowRect(inFrame, sw, sh, pageLongEdge, FOCUS_WINDOW);
    if (!rect) return { sharpness: null, focusMs: 0 };
    const focusBitmap = await createImageBitmap(
      source,
      rect.sx, rect.sy, rect.size, rect.size,
      { resizeWidth: rect.target, resizeHeight: rect.target },
    );
    const read = await runDetectWorker('focus', focusBitmap);
    return { sharpness: read?.sharpness ?? null, focusMs: read?.focusMs ?? 0 };
  }

  async function measureStep(vw, vh) {
    const tracked = quadOf(track);
    if (!tracked || !trackSize || !ensureDetectWorker()) return;
    const pw = PROXY_WIDTH, ph = Math.round(PROXY_WIDTH * vh / vw);
    const inProxy = scaleQuad(tracked, trackSize, { width: pw, height: ph });
    const size = quadSize(inProxy);
    const pageLongEdge = Math.round(Math.max(size.width, size.height) * (vw / pw));
    const bitmap = await createImageBitmap(video, { resizeWidth: pw, resizeHeight: ph });
    const read = await runDetectWorker('measure', bitmap, { quad: inProxy });
    if (!running || !read?.exposure) return;
    const { sharpness: sharpnessScore, focusMs } =
      await focusOnWorker(video, inProxy, pw, ph, vw, vh, pageLongEdge);
    if (!running) return;
    measured = {
      glare: read.exposure.glare,
      clipping: read.exposure.clipping,
      headroom: read.exposure.headroom,
      skew: read.skew,
      sharpness: sharpnessScore,
    };
    measuredAt = performance.now();
    measuredQuad = quadOf(track);
    recordStepTiming({ detectMs: 0, measureMs: read.measureMs ?? 0, focusMs, workerUsed: true });
  }

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
    const sharpnessScore = focusInPageOnMainThread(video, found, pw, ph, vw, vh, pageLongEdge);
    const focusMs = performance.now() - tFocusStart;
    return { found, exposure, skew, pageLongEdge, sharpness: sharpnessScore, detectMs, measureMs, focusMs };
  }

  function finishStep(result, workerUsed, pw, ph, vw, vh) {
    if (!running) return;
    const next = blankState();
    next.timing = {
      detectMs: result.detectMs,
      measureMs: result.measureMs,
      focusMs: result.focusMs,
      workerUsed,
    };
    recordStepTiming(next.timing);
    trackSize = { width: TRACK_WIDTH, height: Math.round(TRACK_WIDTH * vh / vw) };

    if (!result.found) {
      const now = performance.now();
      const tracked = quadOf(track);
      const valid = !!tracked && geometryValid(track, trackSize.width, trackSize.height)
        && track.state !== 'searching';
      const observedGeometry = valid
        && (track.state === 'tracking' || track.state === 'reacquiring');
      const geometryReady = valid && track.state === 'tracking'
        && documentConfidence(track) >= TRACK_CONFIDENCE_FLOOR;
      paperEvidence = settledPaperEvidence(paperEvidence, {
        globalConfirmations, geometryReady, observedGeometry,
      }, now);

      // One failed global re-check is not evidence that a confirmed page
      // vanished. The local tracker owns that decision and the presence latch
      // gives it time to recover without changing the sentence on screen.
      if (paperEvidence.confirmed) {
        if (!valid) publishFromTrack(trackSize.width, trackSize.height, vw, vh, 0, next.timing);
        return;
      }

      track = createTrack();
      consecutiveFinds = globalConfirmations = 0;
      measured = measuredQuad = null;
      lastTrackedArea = null;
      quad = null;
      armed = true;
      guidance = settledScannerGuidance(guidance, null, paperEvidence, now);
      next.blocking = guidance.blocking;
      next.hint = guidance.hint;
      publish(next);
      return;
    }

    const found = scaleQuad(result.found, { width: pw, height: ph }, trackSize);
    const now = performance.now();
    const sameDetectedDocument = isSameDocument(track, found, trackSize.width, trackSize.height);
    globalConfirmations = sameDetectedDocument ? Math.min(3, globalConfirmations + 1) : 1;
    track = sameDetectedDocument
      ? observe(track, {
          topLeft: { ...found[0], confidence: 0.9 },
          topRight: { ...found[1], confidence: 0.9 },
          bottomRight: { ...found[2], confidence: 0.9 },
          bottomLeft: { ...found[3], confidence: 0.9 },
        }, now, trackSize)
      : acquire(createTrack(), found, now, trackSize);

    measured = {
      glare: result.exposure.glare,
      clipping: result.exposure.clipping,
      headroom: result.exposure.headroom,
      skew: result.skew,
      sharpness: result.sharpness,
    };
    measuredAt = now;
    measuredQuad = found;
    publishFromTrack(trackSize.width, trackSize.height, vw, vh, 0, next.timing);
  }

  function measurementsStale(current, width, height) {
    if (!measured || !measuredQuad) return true;
    if (performance.now() - measuredAt > MEASUREMENT_STALE_MS) return true;
    return quadDrift(current, measuredQuad, width, height) > CAPTURE.STABILITY_TOLERANCE;
  }

  function publishFromTrack(tw, th, vw, vh, trackMs, timing = null) {
    if (!running) return;
    const tracked = quadOf(track);
    const next = blankState();
    next.timing = timing ?? { detectMs: 0, measureMs: 0, focusMs: 0, trackMs, workerUsed: true };

    const now = performance.now();
    const valid = !!tracked && geometryValid(track, tw, th) && track.state !== 'searching';
    const confidence = documentConfidence(track);
    const observedGeometry = valid
      && (track.state === 'tracking' || track.state === 'reacquiring');
    const geometryReady = valid && track.state === 'tracking'
      && confidence >= TRACK_CONFIDENCE_FLOOR;
    paperEvidence = settledPaperEvidence(paperEvidence, {
      globalConfirmations, geometryReady, observedGeometry,
    }, now);

    // Keep searching guidance while the detector only has a candidate. This is
    // the important separation: internal tracking may begin immediately, but a
    // face/non-paper false positive never earns a "lock onto corners" message.
    if (!paperEvidence.confirmed) {
      consecutiveFinds = 0;
      lastTrackedArea = null;
      quad = null;
      armed = true;
      guidance = settledScannerGuidance(guidance, null, paperEvidence, now);
      next.blocking = guidance.blocking;
      next.hint = guidance.hint;
      publish(next);
      return;
    }

    next.hasPage = true;
    next.trackState = track.state;
    next.trackConfidence = confidence;
    next.geometryReady = geometryReady;

    // Confirmed paper gets a short loss grace period. During it the capture is
    // safely blocked, but the UI stays in the paper/locking family instead of
    // alternating with the searching sentence on every weak frame.
    if (!valid) {
      consecutiveFinds = 0;
      lastTrackedArea = null;
      quad = null;
      const verdict = liveGateVerdict(next, guidance?.blocking ?? null);
      guidance = settledScannerGuidance(guidance, verdict, paperEvidence, now);
      next.blocking = guidance.blocking;
      next.hint = guidance.hint;
      armed = true;
      publish(next);
      return;
    }

    next.fill = quadFill(tracked, tw, th);
    consecutiveFinds++;

    const size = quadSize(tracked);
    const area = Math.max(1, size.width * size.height);
    const areaChange = lastTrackedArea === null ? 0 : Math.abs(area - lastTrackedArea) / lastTrackedArea;
    lastTrackedArea = area;

    // Autofocus breathing changes effective focal length and therefore the quad
    // area. Treat >5% frame-to-frame change as transient even if the corners
    // themselves still happen to fit the drift tolerance.
    const focusBreathing = areaChange > FOCUS_BREATHING_AREA_DELTA;
    const stale = measurementsStale(tracked, tw, th);
    next.qualityReady = next.geometryReady && !stale && !focusBreathing;
    next.glare = stale ? 0 : measured.glare;
    next.clipping = stale ? 0 : measured.clipping;
    next.headroom = stale ? 0 : measured.headroom;
    next.skew = stale ? 0 : measured.skew;
    next.pageLongEdge = Math.round(Math.max(size.width, size.height) * (vw / tw));
    next.sharpness = stale ? null : measured.sharpness;
    next.steady = !stale && !focusBreathing;
    next.edgeCoverage = next.pageLongEdge / Math.max(1, Math.min(vw, vh));
    next.resolutionStatus =
      capturePath === 'image-capture' || Math.min(vw, vh) < LIVE_SOURCE_FLOOR
        ? 'unknown' : 'known';

    quad = easeQuad(
      quad,
      scaleQuad(tracked, { width: tw, height: th }, { width: vw, height: vh }),
      { width: vw, height: vh },
    );

    const verdict = liveGateVerdict(next, guidance?.blocking ?? null);
    guidance = settledScannerGuidance(guidance, verdict, paperEvidence, now);
    next.blocking = guidance.blocking;
    next.hint = guidance.hint;
    publish(next);

    if (performance.now() < autoRetryAfter) return;
    if (shouldAutoCapture({
      autoCapture,
      armed,
      blocking: next.blocking,
      consecutiveFinds,
      globalConfirmations,
      trackState: track.state,
      viewportScaled: viewportScaled(),
      processing: processingHold || shootInFlight,
    })) {
      armed = false;
      void shoot(true);
    }
    if (next.blocking) armed = true;
  }

  function publish(next) {
    state = next;
    onState?.(next);
  }

  // ── overlay ──────────────────────────────────────────────────────────────
  function scheduleLoop() {
    // Capture confirmation is clocked independently from the camera. Native
    // still capture can briefly stall preview frames; feedback must remain fast.
    if (!captureConfirmation && typeof video.requestVideoFrameCallback === 'function') {
      frameClock = 'video';
      videoFrameHandle = video.requestVideoFrameCallback(loop);
    } else {
      frameClock = 'animation';
      rafHandle = requestAnimationFrame(loop);
    }
  }

  function loop() {
    if (!running) return;
    scheduleLoop();
    if (frameClock === 'animation' && !captureConfirmation
        && video.currentTime === lastRenderedFrame) return;
    lastRenderedFrame = video.currentTime;
    trackStep();

    const rect = video.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!video.videoWidth) return;

    const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
    const offsetX = (w - video.videoWidth * scale) / 2;
    const offsetY = (h - video.videoHeight * scale) / 2;
    const toOverlay = (p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY });

    overlayPhase = resolveOverlayPhase({
      confirming: !!captureConfirmation,
      hasQuad: !!quad,
      trackState: state.trackState,
      trackConfidence: state.trackConfidence,
      scaledViewport: viewportScaled(),
    });

    if (overlayPhase === 'captured-confirm') {
      const frame = captureConfirmFrame(
        performance.now() - captureConfirmation.startedAt,
        captureConfirmation.reducedMotion,
      );
      if (!frame.active) {
        captureConfirmation = null;
        overlayPhase = 'searching';
        return;
      }
      drawQuadMarkers(
        ctx,
        captureConfirmation.quad.map(toOverlay),
        dpr,
        { morph: frame.morph, edges: frame.edges, opacity: frame.opacity, captured: true },
      );
      return;
    }

    // Never paint extrapolated/recovering corners. A missing marker is honest;
    // a marker floating over the desk actively teaches the wrong pose.
    if (overlayPhase !== 'locked') return;
    drawQuadMarkers(ctx, quad.map(toOverlay), dpr, {
      morph: 0,
      edges: 0,
      opacity: 1,
      captured: false,
      blocking: !!state.blocking,
    });
  }

  function unitVector(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  function mixedUnit(from, to, amount) {
    const x = from.x + (to.x - from.x) * amount;
    const y = from.y + (to.y - from.y) * amount;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function lineAround(ctx, point, direction, behind, ahead) {
    ctx.moveTo(point.x - direction.x * behind, point.y - direction.y * behind);
    ctx.lineTo(point.x + direction.x * ahead, point.y + direction.y * ahead);
  }

  function drawQuadMarkers(ctx, points, dpr, {
    morph, edges, opacity, captured, blocking = false,
  }) {
    const radius = 7 * dpr;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = captured
      ? 'rgba(255,255,255,.98)'
      : blocking ? 'rgba(255,159,10,.95)' : 'rgba(255,255,255,.95)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const point = points[i];
      const alongNext = unitVector(point, points[(i + 1) % 4]);
      const alongPrevious = unitVector(point, points[(i + 3) % 4]);
      const diagonalA = unitVector(
        { x: 0, y: 0 },
        { x: alongNext.x + alongPrevious.x, y: alongNext.y + alongPrevious.y },
      );
      const diagonalB = unitVector(
        { x: 0, y: 0 },
        { x: alongNext.x - alongPrevious.x, y: alongNext.y - alongPrevious.y },
      );
      // The cross first rotates into a plus. As its inward arms become the
      // border, the two outward halves retract so the final shape is a clean
      // document rectangle rather than a box with decorative whiskers.
      const behind = captured ? radius * (1 - edges) : radius;
      lineAround(ctx, point, mixedUnit(diagonalA, alongNext, morph), behind, radius);
      lineAround(ctx, point, mixedUnit(diagonalB, alongPrevious, morph), behind, radius);
    }
    ctx.stroke();

    if (edges > 0) {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const from = points[i], to = points[(i + 1) % 4];
        const direction = unitVector(from, to);
        const half = Math.hypot(to.x - from.x, to.y - from.y) / 2;
        const reach = radius + Math.max(0, half - radius) * edges;
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(from.x + direction.x * reach, from.y + direction.y * reach);
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - direction.x * reach, to.y - direction.y * reach);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function beginCaptureConfirmation(verifiedQuad) {
    if (!isVerifiedQuad(verifiedQuad) || !running) return false;
    if (frameClock === 'video') video.cancelVideoFrameCallback?.(videoFrameHandle);
    else if (frameClock === 'animation') cancelAnimationFrame(rafHandle);
    videoFrameHandle = rafHandle = 0;
    frameClock = 'animation';
    captureConfirmation = {
      quad: verifiedQuad.map((point) => ({ ...point })),
      startedAt: performance.now(),
      reducedMotion: !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    };
    overlayPhase = 'captured-confirm';
    rafHandle = requestAnimationFrame(loop);
    return true;
  }

  // ── shutter ──────────────────────────────────────────────────────────────
  async function waitForNextVideoFrame() {
    if (!running) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      await new Promise((resolve) => video.requestVideoFrameCallback(() => resolve()));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(CAPTURE.SETTLE_MS, 100)));
  }

  async function takeNativePhoto() {
    if (!imageCapture) return null;
    if (Object.keys(photoSettings ?? {}).length) {
      try {
        return await imageCapture.takePhoto(photoSettings);
      } catch {
        // Some camera stacks advertise dimensions they reject at capture time.
        // Retry with browser-chosen settings before abandoning the native still.
      }
    }
    try {
      return await imageCapture.takePhoto();
    } catch {
      return null;
    }
  }

  async function grabStill() {
    const nativeBlob = await takeNativePhoto();
    if (nativeBlob) {
      return { bitmap: await createImageBitmap(nativeBlob), path: 'image-capture', original: nativeBlob };
    }

    await waitForNextVideoFrame();
    if (!running || !video.videoWidth) return null;

    // Freeze exactly one decoded frame first. The old path performed an extra
    // draw before owning the frame, widening the preview/shutter race.
    const bitmap = await createImageBitmap(video);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const original = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    // Release the only high-resolution canvas backing store immediately. The
    // ImageBitmap remains the one live uncompressed source for conditioning.
    canvas.width = 1;
    canvas.height = 1;
    return { bitmap, path: 'canvas-grab', original };
  }

  /** Re-detect and re-measure the actual pixels that will be stored. */
  async function analyseStill(bitmap) {
    const scale = Math.min(1, STILL_ANALYSIS_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const pw = Math.max(1, Math.round(bitmap.width * scale));
    const ph = Math.max(1, Math.round(bitmap.height * scale));
    let result = null;
    const workerUsed = !!ensureDetectWorker();

    if (workerUsed) {
      const stillProxy = await createImageBitmap(bitmap, { resizeWidth: pw, resizeHeight: ph });
      result = await runDetectWorker('search', stillProxy);
    } else {
      if (proxy.width !== pw || proxy.height !== ph) { proxy.width = pw; proxy.height = ph; }
      proxyCtx.drawImage(bitmap, 0, 0, pw, ph);
      const frame = proxyCtx.getImageData(0, 0, pw, ph);
      const found = detectQuad(frame);
      if (found) result = { found, exposure: measureQuad(frame, found), skew: skewDegrees(found) };
    }

    if (!result?.found) {
      return {
        quad: null,
        gate: {
          ...blankState(),
          hint: 'Fit all four paper corners in the frame',
          blocking: 'framing',
          geometryReady: false,
          qualityReady: true,
          captureVerified: true,
        },
      };
    }

    const size = quadSize(result.found);
    const sx = bitmap.width / pw, sy = bitmap.height / ph;
    const pageLongEdge = Math.round(Math.max(size.width * sx, size.height * sy));
    let sharpnessScore = null;
    let focusMs = 0;
    if (workerUsed) {
      const focusRead = await focusOnWorker(
        bitmap, result.found, pw, ph, bitmap.width, bitmap.height, pageLongEdge,
      );
      sharpnessScore = focusRead.sharpness;
      focusMs = focusRead.focusMs;
    } else {
      const started = performance.now();
      sharpnessScore = focusInPageOnMainThread(
        bitmap, result.found, pw, ph, bitmap.width, bitmap.height, pageLongEdge,
      );
      focusMs = performance.now() - started;
    }

    const next = blankState();
    next.hasPage = true;
    next.fill = quadFill(result.found, pw, ph);
    next.edgeCoverage = pageLongEdge / Math.max(1, Math.min(bitmap.width, bitmap.height));
    next.pageLongEdge = pageLongEdge;
    next.resolutionStatus = 'known';
    next.sharpness = sharpnessScore;
    next.glare = result.exposure?.glare ?? 0;
    next.clipping = result.exposure?.clipping ?? 0;
    next.headroom = result.exposure?.headroom ?? 0;
    next.skew = result.skew ?? 0;
    next.geometryReady = true;
    next.qualityReady = true;
    next.trackState = 'captured';
    next.trackConfidence = 1;
    next.captureVerified = true;
    next.timing = {
      detectMs: result.detectMs ?? 0,
      measureMs: result.measureMs ?? 0,
      focusMs,
      workerUsed,
    };
    const verdict = liveGateVerdict(next, null);
    next.blocking = verdict.blocking;
    next.hint = verdict.hint;

    return {
      quad: scaleQuad(
        result.found,
        { width: pw, height: ph },
        { width: bitmap.width, height: bitmap.height },
      ),
      gate: next,
    };
  }

  function scheduleAutoRetry() {
    autoRetryAfter = performance.now() + AUTO_RETRY_COOLDOWN_MS;
    armed = false;
    setTimeout(() => {
      if (!running || processingHold || shootInFlight) return;
      armed = true;
    }, AUTO_RETRY_COOLDOWN_MS);
  }

  async function shoot(auto = false) {
    if (!running || !video.videoWidth || shootInFlight) return null;
    if (auto && (processingHold || performance.now() < autoRetryAfter)) return null;
    shootInFlight = true;
    const transactionId = nextTransactionId++;
    const mediaTime = video.currentTime;
    const liveQuadAtShutter = overlayPhase === 'locked' && isVerifiedQuad(quad)
      ? quad.map((point) => ({ ...point }))
      : null;
    const shotActivation = activation;
    const tShotStart = performance.now();

    try {
      const captured = await grabStill();
      const grabMs = performance.now() - tShotStart;
      if (!captured) return null;
      const { bitmap, path, original } = captured;
      if (!running || shotActivation !== activation) {
        bitmap.close?.();
        return null;
      }

      const tAnalyseStart = performance.now();
      const analysed = await analyseStill(bitmap);
      const analyseMs = performance.now() - tAnalyseStart;
      if (!running || shotActivation !== activation) {
        bitmap.close?.();
        return null;
      }

      // Automatic capture is allowed to assist, not knowingly store a frame its
      // own captured-pixel gate rejects. Manual shutter remains sovereign.
      if (auto && analysed.gate.blocking) {
        publish({ ...analysed.gate, autoRejected: true });
        bitmap.close?.();
        scheduleAutoRetry();
        console.debug('[scan:auto-rejected-still]', {
          transactionId,
          reason: analysed.gate.blocking,
          grabMs: +grabMs.toFixed(1),
          analyseMs: +analyseMs.toFixed(1),
        });
        return null;
      }

      const timing = { grabMs: +grabMs.toFixed(1), analyseMs: +analyseMs.toFixed(1) };
      console.debug('[scan:shoot-timing]', { transactionId, auto, capturePath: path, ...timing });

      const shot = {
        bitmap,
        quad: analysed.quad,
        auto,
        capturePath: path,
        original,
        gate: { ...analysed.gate },
        timing,
        transactionId,
        capturedAt: Date.now(),
        mediaTime,
        sourceKind: 'camera',
      };
      // This line is deliberately below every failure/rejection return. The
      // completed rectangle is a receipt for an accepted capture, never an
      // optimistic loading animation. Prefer the frozen live quad because it
      // is exactly what the student saw; fall back to the independently
      // verified still geometry when manual capture preceded a live lock.
      const confirmationQuad = liveQuadAtShutter ?? (isVerifiedQuad(analysed.quad)
        ? scaleQuad(
            analysed.quad,
            { width: bitmap.width, height: bitmap.height },
            { width: video.videoWidth, height: video.videoHeight },
          )
        : null);
      beginCaptureConfirmation(confirmationQuad);
      onShot?.(shot);
      armed = false;
      return shot;
    } finally {
      shootInFlight = false;
    }
  }

  return {
    start,
    stop,
    shoot: () => shoot(false),
    get state() { return state; },
    get overlayPhase() { return overlayPhase; },
    setAutoCapture(on) { autoCapture = !!on; armed = true; },
    get autoCapture() { return autoCapture; },
    /** Holds automatic capture while the previous page is being conditioned.
        Releasing the hold must not itself arm another shot: the same document
        may still be under the camera. Losing/blocking that document is what
        arms the next automatic capture in publishFromTrack(). */
    setProcessing(on) {
      processingHold = !!on;
    },
    get capturePath() { return capturePath; },
    supported: !!navigator.mediaDevices?.getUserMedia,
  };
}
