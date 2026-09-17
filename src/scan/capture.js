// Stage 0 · capture.
//
// The viewfinder, the gate in front of the shutter, and the tray behind it.
//
// The capture boundary is deliberately dual-resolution. The live stream is a
// cheap tracking source; a photographic still is requested only when the gate
// has actually decided to shoot. Most importantly, the still is analysed again
// after capture. A quad measured on a video frame is never blindly scaled onto
// a sensor still taken hundreds of milliseconds later — the saved pixels are the
// source of truth for their own geometry and quality.

import { CAPTURE, CONDITIONING, ENHANCE, QUALITY } from './contract.js';
import {
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
// A global search does not need the full 720p tracking surface. 360px keeps the
// expensive whole-frame detector fast, while the per-frame corner tracker below
// works at 720px for visibly tighter overlay placement.
const PROXY_WIDTH = 360;
const TRACK_WIDTH = 720;
const FOCUS_WINDOW = 384;
const MEASUREMENT_STALE_MS = 900;
const VIEWPORT_SCALE_TOLERANCE = 0.01;
// The frame that is actually stored gets one independent 720px analysis pass.
// This is the transaction boundary that removes the old stale-frame race.
const STILL_ANALYSIS_LONG_EDGE = 720;
const AUTO_RETRY_COOLDOWN_MS = 550;

function viewportScale() {
  return globalThis.visualViewport?.scale ?? 1;
}

function viewportScaled() {
  return Math.abs(viewportScale() - 1) > VIEWPORT_SCALE_TOLERANCE;
}

/** Whether automatic capture is allowed to fire on this frame. */
export function shouldAutoCapture({
  autoCapture, armed, blocking, consecutiveFinds, globalConfirmations = 0,
  trackState = 'tracking', viewportScaled = false, processing = false,
}) {
  if (!autoCapture || !armed || blocking || viewportScaled || processing) return false;
  if (consecutiveFinds < CAPTURE.CONSECUTIVE_FINDS) return false;
  if (globalConfirmations < 2) return false;
  if (trackState !== 'tracking') return false;
  return true;
}

export const MIN_EDGE_COVERAGE = 0.72;
export const LIVE_SOURCE_FLOOR = Math.ceil(CONDITIONING.MIN_LONG_EDGE / ENHANCE.MAX_SCALE);

/**
 * One authoritative quality verdict. A stale measurement is not a good
 * measurement: the old implementation zeroed stale glare/exposure and turned
 * stale focus into null, which could accidentally produce "Ready" while the
 * phone or paper was still moving. `qualityReady` closes that hole.
 */
export function liveGateVerdict(
  {
    glare, clipping, fill, edgeCoverage = 1, sharpness, skew, pageLongEdge,
    resolutionStatus = 'known', qualityReady = true,
  },
  holding = null,
) {
  const easing = (reason) => (holding === reason ? 1 + GUIDANCE_HYSTERESIS : 1);

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

export function settledGuidance(showing, verdict, now) {
  const settled = { hint: verdict.hint, blocking: verdict.blocking, since: now };
  if (!showing || showing.hint === verdict.hint) {
    return { ...settled, since: showing?.since ?? now };
  }
  if (!showing.blocking !== !verdict.blocking) return settled;
  if (now - showing.since < GUIDANCE_DWELL_MS) return showing;
  return settled;
}

// ── worker bridge ──────────────────────────────────────────────────────────
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
      detectWorker = false;
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
    const finish = (value) => {
      if (done) return;
      done = true;
      detectPending.delete(id);
      resolve(value);
    };
    detectPending.set(id, finish);
    setTimeout(() => finish(null), DETECT_TIMEOUT_MS);
    w.postMessage({ id, kind, bitmap, ...extra }, [bitmap]);
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
  let videoFrameHandle = 0;
  let frameClock = null;
  let lastRenderedFrame = -1;
  let detectHandle = 0;

  let track = createTrack();
  let trackSize = null;
  let trackInFlight = false;
  let lastTrackedFrame = -1;
  let measured = null;
  let measuredAt = 0;
  let measuredQuad = null;
  let guidance = null;

  let quad = null;
  let lastDetection = null;
  let lastSearchSize = null;
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
  // Worker startup is paid while the camera permission/first frame is arriving,
  // not on the first useful page detection.
  ensureDetectWorker();

  function focusInPageOnMainThread(source, quadInProxy, pw, ph, sw, sh, pageLongEdge) {
    const inFrame = quadInProxy.map((p) => ({ x: p.x * (sw / pw), y: p.y * (sh / ph) }));
    const rect = focusWindowRect(inFrame, sw, sh, pageLongEdge, FOCUS_WINDOW);
    if (!rect) return null;
    focusCtx.drawImage(source, rect.sx, rect.sy, rect.size, rect.size, 0, 0, rect.target, rect.target);
    const read = sharpness(focusCtx.getImageData(0, 0, rect.target, rect.target), { scale: 1 });
    return read.blank ? null : read.score;
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
      qualityReady: false,
      steady: true,
      hint: 'Lay the page flat and fit all four corners in the frame',
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
        photoSettings = {
          ...(maxW > 0 ? { imageWidth: maxW } : {}),
          ...(maxH > 0 ? { imageHeight: maxH } : {}),
        };
      } catch {
        imageCapture = null;
        photoSettings = null;
        capturePath = 'canvas-grab';
      }
    }
    // Only browsers without a separate native still need a high-resolution
    // video stream. This is the dual-resolution architecture's Safari branch.
    if (cameraTrack && !imageCapture) {
      await requestFallbackCaptureResolution(cameraTrack);
    }
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
    quad = lastDetection = lastSearchSize = null;
    consecutiveFinds = globalConfirmations = 0;
    track = createTrack();
    trackSize = measured = measuredQuad = guidance = null;
    lastTrackedFrame = -1;
    video.style.removeProperty('transform');
    measuredAt = 0;
    trackInFlight = false;
    imageCapture = null;
    photoSettings = null;
    capturePath = 'canvas-grab';
    processingHold = false;
    autoRetryAfter = 0;
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
      if (needsGlobal(track, started)) await step();
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
    if (!search?.found) return { found: null, detectMs: search?.detectMs ?? 0, measureMs: 0, focusMs: 0 };
    const size = quadSize(search.found);
    const pageLongEdge = Math.round(Math.max(size.width, size.height) * (vw / pw));
    const { sharpness: sharpnessScore, focusMs } =
      await focusOnWorker(video, search.found, pw, ph, vw, vh, pageLongEdge);
    return {
      found: search.found, exposure: search.exposure, skew: search.skew, pageLongEdge,
      sharpness: sharpnessScore, detectMs: search.detectMs, measureMs: search.measureMs, focusMs,
    };
  }

  async function focusOnWorker(source, quadInProxy, pw, ph, sw, sh, pageLongEdge) {
    const inFrame = quadInProxy.map((p) => ({ x: p.x * (sw / pw), y: p.y * (sh / ph) }));
    const rect = focusWindowRect(inFrame, sw, sh, pageLongEdge, FOCUS_WINDOW);
    if (!rect) return { sharpness: null, focusMs: 0 };
    const focusBitmap = await createImageBitmap(
      source, rect.sx, rect.sy, rect.size, rect.size,
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
      detectMs: result.detectMs, measureMs: result.measureMs, focusMs: result.focusMs, workerUsed,
    };
    recordStepTiming(next.timing);
    trackSize = { width: TRACK_WIDTH, height: Math.round(TRACK_WIDTH * vh / vw) };

    if (!result.found) {
      track = createTrack();
      lastDetection = null;
      consecutiveFinds = globalConfirmations = 0;
      measured = measuredQuad = guidance = null;
      quad = null;
      armed = true;
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

    if (!tracked || !geometryValid(track, tw, th) || track.state === 'searching') {
      lastDetection = guidance = null;
      consecutiveFinds = globalConfirmations = 0;
      quad = null;
      armed = true;
      publish(next);
      return;
    }

    next.hasPage = true;
    next.fill = quadFill(tracked, tw, th);
    consecutiveFinds++;
    const stale = measurementsStale(tracked, tw, th);
    next.qualityReady = !stale;
    next.glare = stale ? 0 : measured.glare;
    next.clipping = stale ? 0 : measured.clipping;
    next.headroom = stale ? 0 : measured.headroom;
    next.skew = stale ? 0 : measured.skew;
    const size = quadSize(tracked);
    next.pageLongEdge = Math.round(Math.max(size.width, size.height) * (vw / tw));
    next.sharpness = stale ? null : measured.sharpness;

    lastDetection = tracked;
    lastSearchSize = { width: tw, height: th };
    next.steady = !stale;
    next.trackState = track.state;
    next.trackConfidence = documentConfidence(track);
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
    guidance = settledGuidance(guidance, verdict, performance.now());
    next.blocking = guidance.blocking;
    next.hint = guidance.hint;
    publish(next);

    if (performance.now() < autoRetryAfter) return;
    if (shouldAutoCapture({
      autoCapture, armed, blocking: next.blocking,
      consecutiveFinds, globalConfirmations, trackState: track.state,
      viewportScaled: viewportScaled(), processing: processingHold || shootInFlight,
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
    if (typeof video.requestVideoFrameCallback === 'function') {
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
    if (frameClock === 'animation' && video.currentTime === lastRenderedFrame) return;
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
    if (!quad || viewportScaled()) return;
    const points = quad.map(toOverlay);

    ctx.strokeStyle = state.blocking ? 'rgba(255,159,10,.95)' : 'rgba(255,255,255,.95)';
    ctx.lineWidth = 3 * dpr;
    ctx.lineCap = 'round';
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

  // ── shutter ──────────────────────────────────────────────────────────────
  async function waitForNextVideoFrame() {
    if (!running) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      await new Promise((resolve) => video.requestVideoFrameCallback(() => resolve()));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(CAPTURE.SETTLE_MS, 100)));
  }

  async function grabStill() {
    if (imageCapture) {
      try {
        const blob = Object.keys(photoSettings ?? {}).length
          ? await imageCapture.takePhoto(photoSettings)
          : await imageCapture.takePhoto();
        return { bitmap: await createImageBitmap(blob), path: 'image-capture', original: blob };
      } catch {
        // Some Chromium camera stacks advertise ImageCapture then reject the
        // real shot. Fall through to the stream frame rather than losing it.
      }
    }
    await waitForNextVideoFrame();
    if (!video.videoWidth) return null;
    // createImageBitmap freezes one decoded video frame immediately; the old
    // canvas path performed an extra main-thread draw before the frame existed
    // as an owned object and made the shutter/display race wider.
    const bitmap = await createImageBitmap(video);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const original = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    return { bitmap, path: 'canvas-grab', original };
  }

  /**
   * Analyse the pixels that will actually be stored. This is intentionally a
   * fresh detection, not a verification of old coordinates. ImageCapture may
   * refocus, change field of view, or return a different aspect/resolution; the
   * old video quad is therefore evidence about the wrong frame.
   */
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
      if (found) {
        result = { found, exposure: measureQuad(frame, found), skew: skewDegrees(found) };
      }
    }

    if (!result?.found) {
      return {
        quad: null,
        gate: {
          ...blankState(),
          hint: 'Fit all four paper corners in the frame',
          blocking: 'framing',
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
      quad: scaleQuad(result.found, { width: pw, height: ph }, { width: bitmap.width, height: bitmap.height }),
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
    const tShotStart = performance.now();
    let captured = null;

    try {
      captured = await grabStill();
      const grabMs = performance.now() - tShotStart;
      if (!captured) return null;
      const { bitmap, path, original } = captured;

      const tAnalyseStart = performance.now();
      const analysed = await analyseStill(bitmap);
      const analyseMs = performance.now() - tAnalyseStart;

      // Automatic capture is allowed to assist, not to knowingly store a frame
      // its own captured-pixel gate rejects. Manual shutter remains sovereign.
      if (auto && analysed.gate.blocking) {
        publish({ ...analysed.gate, autoRejected: true });
        bitmap.close?.();
        scheduleAutoRetry();
        console.debug('[scan:auto-rejected-still]', {
          transactionId, reason: analysed.gate.blocking, grabMs: +grabMs.toFixed(1),
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
    setAutoCapture(on) { autoCapture = !!on; armed = true; },
    get autoCapture() { return autoCapture; },
    /** Holds automatic capture while the previous page is being conditioned. */
    setProcessing(on) {
      processingHold = !!on;
      if (!processingHold) armed = true;
    },
    get capturePath() { return capturePath; },
    supported: !!navigator.mediaDevices?.getUserMedia,
  };
}
