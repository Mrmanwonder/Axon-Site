// Stage 0 · capture.
//
// What this controller promises, in order of importance:
//
//   1. The shutter always works. Detection assists the student; it never gates
//      the photograph. A frame with nothing detectable still becomes a page that
//      can be adjusted by hand and read.
//   2. Every "not found" has a reason that was measured, or says nothing.
//   3. Failures are visible. A worker that cannot start, a frame that cannot be
//      read and a torch that will not light are all reported, not swallowed.
//
// Detection is a public library used as shipped (src/scan/detector.js); the lock
// is a simple whole-page comparison over time (src/scan/lock.js); what the
// strip says comes from src/scan/guidance.js. This file is the camera, the loop
// that joins them, and the still.

import { CAPTURE } from './contract.js';
import { encodeStill } from './still-encoder.js';
import { withDeadline } from './deadline.js';
import {
  CAMERA_CONTROL_TIMEOUT_MS, FALLBACK_CAPTURE_HEIGHT, FALLBACK_CAPTURE_WIDTH,
  releaseCamera, requestCamera, requestContinuousFocus, requestFallbackCaptureResolution,
} from './camera.js';
import { DETECTOR } from './detector.js';
import { GUIDE, chooseGuidance, looksLikePaper, quadTouchesEdge } from './guidance.js';
import { quadFill, quadSize } from './geometry.js';
import { createLock } from './lock.js';
import { focusWindowRect, skewDegrees } from './quality.js';

// ── tunables (first guesses; see guidance.js and lock.js on why) ───────────
const DETECT_LONG_EDGE = 640;        // the frame the detector sees
const DETECT_PERIOD_MS = 90;         // aim for ~10 searches a second
const DETECT_TIMEOUT_MS = 6000;      // a search that takes this long has failed
const INIT_TIMEOUT_MS = 25000;       // first model download over a slow connection
const ENGINE_FAILURES_BEFORE_UNAVAILABLE = 3;
const FOCUS_WINDOW = 384;
const FOCUS_PERIOD_MS = 450;
const FOCUS_STALE_MS = 1500;
const STILL_DETECT_LONG_EDGE = 1024; // the photograph gets a bigger look
const STILL_DETECT_TIMEOUT_MS = 12000;
/** A still's page counts as "found with evidence" at or above this ML score. */
export const FINE_SCORE = 0.9;
const REARM_AFTER_LOSS_MS = 800;
const AUTO_RETRY_COOLDOWN_MS = 550;
// A 12 MP takePhoto() on a mid-range Android routinely takes 1.5 to 2.5 s, the
// first one longer. At 1200 ms the first shot timed out and the scanner demoted
// itself to grabbing video frames for the rest of the session: smaller pages,
// the "sharpened for readability" rescue on nearly every page, and the
// rolling-shutter banding of a video frame under mains lighting.
const NATIVE_PHOTO_TIMEOUT_MS = 4000;
const NATIVE_TIMEOUTS_BEFORE_DEMOTION = 2;
const VIDEO_FRAME_TIMEOUT_MS = 220;
const VIEWPORT_SCALE_TOLERANCE = 0.01;
const HINT_SEQUENCE_LIMIT = 32;
const TORCH_AUTO_AFTER_MS = 1000;

export const TORCH_MODES = Object.freeze(['auto', 'on', 'off']);


function viewportScaled() {
  return Math.abs((globalThis.visualViewport?.scale ?? 1) - 1) > VIEWPORT_SCALE_TOLERANCE;
}

/**
 * Source rectangle visible through an object-fit: cover preview.
 *
 * Detection must search what the student can actually see; on a portrait phone
 * a 16:9 stream can be cropped by more than half horizontally.
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

/** Fit a rectangle inside a long-edge budget without changing its aspect. */
export function fitLongEdge(width, height, longEdge) {
  if (!(width > 0 && height > 0 && longEdge > 0)) return { width: 1, height: 1 };
  const scale = longEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function isVerifiedQuad(candidate) {
  return Array.isArray(candidate) && candidate.length === 4
    && candidate.every((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
}

/** Confidence in geometry that existed before the shutter was pressed. */
export function shutterQuadConfidence({ locked = false, hasCandidate = false } = {}) {
  if (locked) return 'locked';
  if (hasCandidate) return 'provisional';
  return 'none';
}

/**
 * May Auto fire on this frame? Pure so it can be tested without a camera.
 * Auto is an assist: it needs a locked, still, usable page and nothing the
 * student can fix by moving. Glare is advice, not a veto.
 */
export function shouldAutoCapture({
  auto, armed, processing = false, scaled = false,
  phase, stableMs = 0, lockedForMs = 0, reason = null,
}) {
  if (!auto || !armed || processing || scaled) return false;
  if (phase !== 'locked') return false;
  if (reason !== null && reason !== 'glare') return false;
  return stableMs >= CAPTURE.STABILITY_MS || lockedForMs >= CAPTURE.PATIENCE_MS;
}

/**
 * Is this still's page "fine", and if not, why? A page is fine only on
 * evidence: the detector's quad came from the ML engine at or above FINE_SCORE.
 * Quality (blur, glare) is judged downstream by scorePage on the stored page.
 */
export function judgeStillGeometry(detection) {
  if (detection?.status === 'found' && detection.quad) {
    if (detection.source === 'ml' && (detection.score ?? 0) >= FINE_SCORE) {
      return { confirmed: true, reason: null };
    }
    return { confirmed: false, reason: 'uncertain' };
  }
  if (detection?.status === 'none') return { confirmed: false, reason: 'not-found' };
  return { confirmed: false, reason: 'engine' };
}

// ── worker bridge ──────────────────────────────────────────────────────────
// One worker for the page's life: the model is a few MB, so it is loaded once.
let worker = null;
let nextRequestId = 1;
const pending = new Map();
let workerFatal = null;
let initPromise = null;

function failAllPending(error) {
  for (const settle of [...pending.values()]) settle({ ok: false, error });
  pending.clear();
}

function ensureWorker() {
  if (worker || workerFatal) return worker;
  try {
    worker = new Worker(new URL('./detect-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const data = event.data;
      if (data?.kind === 'fatal') { workerFatal = data.error; failAllPending(data.error); return; }
      const settle = pending.get(data?.id);
      if (settle) { pending.delete(data.id); settle(data); }
    };
    worker.onerror = (event) => {
      workerFatal = event?.message || 'the page-finder worker crashed';
      console.error('[scan] detect worker failed', workerFatal, event?.filename, event?.lineno);
      failAllPending(workerFatal);
      worker?.terminate?.();
      worker = null;
    };
  } catch (error) {
    workerFatal = String(error?.message ?? error);
    worker = null;
  }
  return worker;
}

/** Resolves to the worker's reply, or `{ ok:false, error }`. Never rejects. */
function request(kind, payload = {}, { transfer = [], timeoutMs = DETECT_TIMEOUT_MS } = {}) {
  const w = ensureWorker();
  if (!w) {
    transfer.forEach((b) => b?.close?.());
    return Promise.resolve({ ok: false, error: workerFatal ?? 'the page finder could not start' });
  }
  const id = nextRequestId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, error: `the page finder took longer than ${Math.round(timeoutMs / 1000)}s` });
    }, timeoutMs);
    pending.set(id, (reply) => { clearTimeout(timer); resolve(reply); });
    try {
      w.postMessage({ id, kind, ...payload }, transfer);
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      transfer.forEach((b) => b?.close?.());
      resolve({ ok: false, error: String(error?.message ?? error) });
    }
  });
}

/** Load the model once. Resolves to `{ ok, ml, error }`. */
function initEngine() {
  initPromise ??= request('init', {
    assetBaseUrl: new URL(`/${DETECTOR.ASSET_PATH}`, globalThis.location?.origin ?? 'http://localhost').href,
  }, { timeoutMs: INIT_TIMEOUT_MS }).then((reply) => {
    if (!reply.ok) initPromise = null; // allow a retry on the next start
    return reply;
  });
  return initPromise;
}

/** Warm the engine while the camera permission sheet is still open. */
export function prepareScanner() {
  ensureWorker();
  return initEngine();
}

/**
 * @param {Object} options
 * @param {HTMLVideoElement} options.video
 * @param {HTMLCanvasElement} options.overlay
 * @param {(state:Object) => void} options.onState
 * @param {(shot:Object) => void} options.onShot
 */
export function createCapture({ video, overlay, onState, onShot }) {
  const debug = new URLSearchParams(globalThis.location?.search ?? '').has('scandebug');
  const lock = createLock();

  let stream = null;
  let running = false;
  let activation = 0;
  let starting = null;
  let frameClock = null;
  let videoFrameHandle = 0;
  let rafHandle = 0;
  let autoRetryHandle = 0;

  let autoCapture = true;
  let armed = true;
  let processingHold = false;
  let autoRetryAfter = 0;
  let lostSince = 0;
  let lockedSince = 0;
  let shootInFlight = false;
  let nextTransactionId = 1;

  let imageCapture = null;
  let cameraTrack = null;
  let photoSettings = null;
  let capturePath = 'canvas-grab';
  let nativeStillDemoted = false;
  let nativeTimeouts = 0;

  // torch
  let torch = { supported: false, mode: 'auto', on: false, error: null };
  let darkSince = 0;

  // live evidence
  let engine = { status: 'loading', source: null, score: null, error: null, ms: null };
  let engineFailures = 0;
  let frameFailures = 0;
  let signals = { luma: null, motion: null, glare: null, edgeContrast: null, sharpness: null, sharpnessAt: 0 };
  let snapshot = lock.snapshot(0);
  let noPageSince = 0;
  let lastFocusAt = 0;
  let lastFocusInFlight = false;
  let shown = null; // the quad being drawn, eased toward the lock, in video pixels
  let state = blankState();
  let lastPublishKey = '';

  let hintSequence = [];
  let hintSequenceStartedAt = performance.now();

  function recordHintState(next) {
    const last = hintSequence[hintSequence.length - 1];
    if (last?.hint === next.hint && last?.blocking === (next.blocking ?? null)) return;
    hintSequence.push({
      at_ms: Math.max(0, Math.round(performance.now() - hintSequenceStartedAt)),
      hint: next.hint,
      blocking: next.blocking ?? null,
    });
    if (hintSequence.length > HINT_SEQUENCE_LIMIT) hintSequence.shift();
  }

  function consumeHintSequence() {
    const out = hintSequence.map((entry) => ({ ...entry }));
    hintSequence = [];
    hintSequenceStartedAt = performance.now();
    if (state?.hint) recordHintState(state);
    return out;
  }

  function blankState() {
    return {
      phase: 'starting',
      hasPage: false,
      hint: 'Starting the camera',
      blocking: null,
      tone: 'neutral',
      reason: null,
      action: null,
      fill: 0,
      pageLongEdge: 0,
      sharpness: null,
      glare: 0,
      clipping: 0,
      skew: 0,
      steady: false,
      engine,
      torch,
      timing: null,
    };
  }

  // ── start / stop ─────────────────────────────────────────────────────────
  function start(adopt = null) {
    if (starting) return starting;
    if (running) return Promise.resolve();
    const generation = ++activation;
    const run = startActivation(adopt, generation).catch((error) => {
      if (generation === activation) stop();
      throw error;
    }).finally(() => {
      if (starting === run) starting = null;
    });
    starting = run;
    return run;
  }

  async function startActivation(adopt, generation) {
    // The model starts loading now, in parallel with the camera permission.
    void prepareScanner();

    const resolved = adopt ? await adopt : await requestCamera();
    if (resolved instanceof Error) throw resolved;
    if (generation !== activation) {
      resolved?.getTracks?.().forEach((t) => t.stop());
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
    await withDeadline(() => video.play(), 5000);
    if (generation !== activation) {
      resolved.getTracks().forEach((t) => t.stop());
      return;
    }
    armed = true;

    cameraTrack = stream.getVideoTracks?.()[0] ?? null;
    const setupTrack = cameraTrack;
    imageCapture = null;
    photoSettings = null;
    capturePath = 'canvas-grab';
    nativeStillDemoted = false;
    nativeTimeouts = 0;

    if (cameraTrack && typeof ImageCapture !== 'undefined') {
      try {
        const candidate = new ImageCapture(cameraTrack);
        const caps = await withDeadline(() => candidate.getPhotoCapabilities(), CAMERA_CONTROL_TIMEOUT_MS);
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
        if (generation !== activation) return;
        imageCapture = null;
        photoSettings = null;
        capturePath = 'canvas-grab';
      }
    }

    if (generation !== activation) return;
    if (setupTrack && !imageCapture) await requestFallbackCaptureResolution(setupTrack);
    if (generation !== activation) return;
    if (setupTrack) await requestContinuousFocus(setupTrack);
    if (generation !== activation) return;

    // Torch exists only where the browser exposes it (Chrome on Android). Never
    // offered, never claimed, anywhere else.
    let torchSupported = false;
    try { torchSupported = !!setupTrack?.getCapabilities?.().torch; } catch { torchSupported = false; }
    torch = { supported: torchSupported, mode: torch.mode, on: false, error: null };
    darkSince = 0;
    if (torchSupported && torch.mode === 'on') await applyTorch(true);

    running = true;
    noPageSince = performance.now();
    publish();
    paintLoop();
    void searchLoop(generation);
  }

  function stop() {
    ++activation;
    starting = null;
    running = false;
    if (frameClock === 'video') video.cancelVideoFrameCallback?.(videoFrameHandle);
    else cancelAnimationFrame(rafHandle);
    videoFrameHandle = rafHandle = 0;
    frameClock = null;
    clearTimeout(autoRetryHandle);
    // Releasing the track releases the torch with it; record that honestly.
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    lock.reset();
    snapshot = lock.snapshot(0);
    shown = null;
    engineFailures = frameFailures = 0;
    signals = { luma: null, motion: null, glare: null, edgeContrast: null, sharpness: null, sharpnessAt: 0 };
    torch = { ...torch, on: false, error: null };
    darkSince = 0;
    imageCapture = null;
    cameraTrack = null;
    photoSettings = null;
    capturePath = 'canvas-grab';
    nativeStillDemoted = false;
    nativeTimeouts = 0;
    processingHold = false;
    shootInFlight = false;
    autoRetryAfter = 0;
    lostSince = lockedSince = 0;
    state = blankState();
    lastPublishKey = '';
    hintSequence = [];
    hintSequenceStartedAt = performance.now();
    overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    releaseCamera();
  }

  // ── torch ────────────────────────────────────────────────────────────────
  async function applyTorch(on) {
    if (!torch.supported || !cameraTrack) return false;
    const track = cameraTrack;
    try {
      await withDeadline(() => track.applyConstraints({ advanced: [{ torch: on }] }), CAMERA_CONTROL_TIMEOUT_MS);
      torch = { ...torch, on, error: null };
      return true;
    } catch (error) {
      torch = { ...torch, on: false, error: String(error?.message ?? error).slice(0, 120) };
      console.warn('[scan] torch change failed', torch.error);
      return false;
    } finally {
      publish();
    }
  }

  async function setTorchMode(mode) {
    if (!TORCH_MODES.includes(mode)) return;
    torch = { ...torch, mode };
    darkSince = 0;
    if (!torch.supported) { publish(); return; }
    if (mode === 'on') await applyTorch(true);
    else if (mode === 'off') await applyTorch(false);
    else publish();
  }

  /** Auto: light up after sustained darkness, and then stay lit for the session so
      the extra light cannot make the scene "bright enough" and flicker the torch. */
  function autoTorch(now, reason) {
    if (torch.mode !== 'auto' || !torch.supported || torch.on) return;
    if (reason !== 'dark') { darkSince = 0; return; }
    darkSince ||= now;
    if (now - darkSince >= TORCH_AUTO_AFTER_MS) void applyTorch(true);
  }

  // ── the search loop ──────────────────────────────────────────────────────
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function visibleSourceCrop() {
    const rect = video.getBoundingClientRect();
    return coverCropRect(video.videoWidth, video.videoHeight, rect.width, rect.height);
  }

  async function searchLoop(generation) {
    const alive = () => running && generation === activation;
    const init = await initEngine();
    if (!alive()) return;
    if (!init.ok) {
      engine = { status: 'unavailable', source: null, score: null, error: init.error, ms: null };
      console.error('[scan] page finder did not start:', init.error);
    } else {
      engine = { status: init.ml ? 'ready' : 'degraded', source: init.ml ? 'ml' : 'classical',
        score: null, error: init.error, ms: null };
    }
    refresh();

    while (alive()) {
      const startedAt = performance.now();
      if (document.hidden || !video.videoWidth || video.readyState < 2) {
        await sleep(200);
        continue;
      }
      // Give the still's evidence pass priority over live detection. The video
      // and paint loop stay alive; another live search cannot improve this shot.
      if (shootInFlight) { await sleep(50); continue; }
      try {
        await searchOnce(generation);
      } catch (error) {
        // Never let one bad iteration end the loop, and never hide it.
        console.error('[scan] search step failed', error);
        noteEngineFailure(String(error?.message ?? error));
        refresh();
      }
      await sleep(Math.max(engine.status === 'unavailable' ? 1500 : 30,
        DETECT_PERIOD_MS - (performance.now() - startedAt)));
    }
  }

  /** Recompute guidance from the evidence held now, then publish. Used by every
      path that changes what is known (a failure included), so the strip can
      never keep saying something the evidence no longer supports. */
  function refresh() {
    evaluate(performance.now(), visibleSourceCrop());
  }

  function noteEngineFailure(message) {
    engineFailures++;
    if (engineFailures >= ENGINE_FAILURES_BEFORE_UNAVAILABLE) {
      engine = { ...engine, status: 'unavailable', error: message };
    }
  }

  async function searchOnce(generation) {
    const crop = visibleSourceCrop();
    const { width: pw, height: ph } = fitLongEdge(crop.width, crop.height, DETECT_LONG_EDGE);
    let bitmap;
    try {
      bitmap = await createImageBitmap(video, crop.x, crop.y, crop.width, crop.height,
        { resizeWidth: pw, resizeHeight: ph, resizeQuality: 'low' });
      frameFailures = 0;
    } catch (error) {
      // Seen on some Android WebViews. It used to be swallowed, leaving the
      // viewfinder "searching" forever with no reason.
      frameFailures++;
      console.warn('[scan] could not read a camera frame', error);
      if (frameFailures >= 3) {
        engine = { ...engine, status: 'unavailable', error: 'camera frames could not be read' };
        refresh();
      }
      return;
    }
    if (generation !== activation) { bitmap.close?.(); return; }

    const reply = await request('detect', { bitmap }, { transfer: [bitmap] });
    if (generation !== activation || !running) return;
    const now = performance.now();

    if (!reply.ok) {
      noteEngineFailure(reply.error);
      refresh();
      return;
    }

    const detection = reply.detection;
    if (detection.status === 'unavailable') {
      noteEngineFailure(detection.error ?? 'the page finder failed');
      refresh();
      return;
    }
    engineFailures = 0;
    engine = {
      status: detection.degraded ? 'degraded' : 'ready',
      source: detection.source,
      score: detection.score,
      error: detection.error,
      ms: Math.round(detection.ms),
    };

    signals.luma = reply.signals?.luma ?? signals.luma;
    signals.motion = reply.signals?.motion ?? null;
    signals.glare = reply.exposure ? reply.exposure.glare : null;
    signals.edgeContrast = reply.signals?.edgeContrast ?? null;

    // A confident shape that is darker than everything around it (a keyboard,
    // a laptop lid) is not followed: no lock, no Auto. The shutter still works.
    const paper = looksLikePaper(reply.signals?.interior ?? null);
    const quadNorm = detection.status === 'found' && detection.quad && paper
      ? detection.quad.map((p) => ({ x: p.x / reply.width, y: p.y / reply.height }))
      : null;
    const before = snapshot.phase;
    snapshot = lock.observe(now, quadNorm);
    if (snapshot.phase === 'locked' && before !== 'locked') lockedSince = now;
    if (snapshot.phase !== 'locked') lockedSince = 0;
    if (quadNorm) noPageSince = 0; else if (!noPageSince) noPageSince = now;
    if (snapshot.phase === 'searching' && !noPageSince) noPageSince = now;

    // Re-arm Auto once the page has really gone, not on a one-frame flicker.
    if (snapshot.phase === 'searching') {
      lostSince ||= now;
      if (now - lostSince >= REARM_AFTER_LOSS_MS && !shootInFlight && !processingHold) armed = true;
    } else {
      lostSince = 0;
    }

    if (snapshot.phase === 'locked') void focusStep(generation, crop, now);
    else signals.sharpness = null;

    evaluate(now, crop);
  }

  /** Sharpness of a window of the real video, at the page-relative scale the
      contract's blur thresholds were measured at. Only while locked. */
  async function focusStep(generation, crop, now) {
    if (lastFocusInFlight || now - lastFocusAt < FOCUS_PERIOD_MS || !snapshot.quad) return;
    const vq = snapshot.quad.map((p) => ({ x: crop.x + p.x * crop.width, y: crop.y + p.y * crop.height }));
    const size = quadSize(vq);
    const rect = focusWindowRect(vq, video.videoWidth, video.videoHeight,
      Math.round(Math.max(size.width, size.height)), FOCUS_WINDOW);
    if (!rect) return;
    lastFocusInFlight = true;
    lastFocusAt = now;
    try {
      const bitmap = await createImageBitmap(video, rect.sx, rect.sy, rect.size, rect.size,
        { resizeWidth: rect.target, resizeHeight: rect.target });
      const reply = await request('focus', { bitmap }, { transfer: [bitmap], timeoutMs: 2000 });
      if (generation === activation && reply.ok) {
        signals.sharpness = reply.sharpness;
        signals.sharpnessAt = performance.now();
      }
    } catch (error) {
      console.warn('[scan] focus read failed', error);
    } finally {
      lastFocusInFlight = false;
    }
  }

  /** Join the evidence into one guidance verdict, publish it, and let Auto decide. */
  function evaluate(now, crop) {
    const quad = snapshot.quad;
    const touches = quad ? quadTouchesEdge(quad) : false;
    const fill = quad ? quadFill(quad, 1, 1) : 0;
    const sharp = signals.sharpness !== null && now - signals.sharpnessAt < FOCUS_STALE_MS
      ? signals.sharpness : null;

    const guidance = chooseGuidance({
      phase: snapshot.phase,
      engine,
      luma: signals.luma,
      motion: signals.motion,
      fill,
      edgeContrast: signals.edgeContrast,
      touchesEdge: touches,
      sharpness: sharp,
      glare: signals.glare,
      searchingMs: noPageSince ? now - noPageSince : 0,
      torch,
      auto: autoCapture,
      nativeStill: capturePath === 'image-capture',
    });
    autoTorch(now, guidance.reason);

    let pageLongEdge = 0;
    let skew = 0;
    if (quad) {
      const vq = quad.map((p) => ({ x: crop.x + p.x * crop.width, y: crop.y + p.y * crop.height }));
      const size = quadSize(vq);
      pageLongEdge = Math.round(Math.max(size.width, size.height));
      skew = skewDegrees(vq);
    }

    state = {
      phase: snapshot.phase,
      hasPage: snapshot.phase === 'locked',
      hint: guidance.text,
      blocking: guidance.tone === 'attention' ? guidance.reason : null,
      tone: guidance.tone,
      reason: guidance.reason,
      action: guidance.action,
      fill,
      pageLongEdge,
      sharpness: sharp,
      glare: signals.glare ?? 0,
      clipping: 0,
      skew,
      steady: snapshot.stableMs >= CAPTURE.STABILITY_MS,
      engine,
      torch,
      timing: { detectMs: engine.ms },
    };
    publish();

    if (shouldAutoCapture({
      auto: autoCapture, armed, processing: processingHold || shootInFlight,
      scaled: viewportScaled(), phase: snapshot.phase, stableMs: snapshot.stableMs,
      lockedForMs: lockedSince ? now - lockedSince : 0, reason: guidance.reason,
    }) && now >= autoRetryAfter) {
      armed = false;
      void shoot(true);
    }
  }

  function publish() {
    // Engine/torch can change between detections, so refresh those before comparing.
    state = { ...state, engine, torch, capturing: shootInFlight };
    const key = [state.phase, state.hint, state.blocking, state.tone, state.action,
      engine.status, engine.source, torch.supported, torch.mode, torch.on, torch.error,
      state.steady, state.capturing, debug ? Math.round(performance.now() / 500) : 0].join('|');
    if (key === lastPublishKey) return;
    lastPublishKey = key;
    recordHintState(state);
    onState?.(state);
  }

  // ── overlay ──────────────────────────────────────────────────────────────
  function paintLoop() {
    const generation = activation;
    const next = () => { if (generation === activation && running) paint(); };
    if (typeof video.requestVideoFrameCallback === 'function') {
      frameClock = 'video';
      videoFrameHandle = video.requestVideoFrameCallback(next);
    } else {
      frameClock = 'animation';
      rafHandle = requestAnimationFrame(next);
    }
  }

  function paint() {
    if (!running) return;
    paintLoop();

    const rect = overlay.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!video.videoWidth) return;

    // Quad → video pixels → the on-screen position of an object-fit: cover video.
    const crop = coverCropRect(video.videoWidth, video.videoHeight, rect.width, rect.height);
    const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const offX = (rect.width - video.videoWidth * scale) / 2;
    const offY = (rect.height - video.videoHeight * scale) / 2;
    const toOverlay = (p) => ({ x: (p.x * scale + offX) * dpr, y: (p.y * scale + offY) * dpr });

    // Nothing is drawn without a candidate: a bracket floating over the desk
    // teaches the wrong pose, and a missing one is honest.
    if (snapshot.quad && snapshot.phase !== 'searching' && !viewportScaled()) {
      const target = snapshot.quad.map((p) => ({ x: crop.x + p.x * crop.width, y: crop.y + p.y * crop.height }));
      shown = shown ? shown.map((p, i) => ({
        x: p.x + (target[i].x - p.x) * 0.4, y: p.y + (target[i].y - p.y) * 0.4,
      })) : target;
      drawBrackets(ctx, shown.map(toOverlay), dpr, snapshot.phase === 'locked');
    } else {
      shown = null;
    }
    if (debug) drawDebug(ctx, dpr);
  }

  function drawBrackets(ctx, pts, dpr, locked) {
    const accent = getComputedStyle(overlay).getPropertyValue('--accent').trim() || '#3a86ff';
    ctx.save();
    ctx.lineWidth = 3 * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = locked ? accent : 'rgba(255,255,255,.92)';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const p = pts[i], a = pts[(i + 1) % 4], b = pts[(i + 3) % 4];
      for (const q of [a, b]) {
        const dx = q.x - p.x, dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const arm = Math.min(26 * dpr, len * 0.3);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (dx / len) * arm, p.y + (dy / len) * arm);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawDebug(ctx, dpr) {
    const lines = [
      `phase ${snapshot.phase} hits ${snapshot.hits} stable ${Math.round(snapshot.stableMs)}ms`,
      `engine ${engine.status}/${engine.source ?? '-'} score ${engine.score?.toFixed?.(2) ?? '-'} ${engine.ms ?? '-'}ms`,
      `luma ${signals.luma ? `${signals.luma.median}/${signals.luma.p95}` : '-'} motion ${signals.motion?.toFixed?.(1) ?? '-'}`,
      `fill ${state.fill.toFixed(2)} sharp ${state.sharpness?.toFixed?.(2) ?? '-'} glare ${state.glare?.toFixed?.(3) ?? '-'}`,
      `reason ${state.reason ?? '-'} torch ${torch.supported ? `${torch.mode}/${torch.on ? 'lit' : 'dark'}` : 'n/a'}`,
      engine.error ? `error ${engine.error}` : '',
    ].filter(Boolean);
    ctx.save();
    ctx.font = `${11 * dpr}px ui-monospace, monospace`;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(6 * dpr, 6 * dpr, 330 * dpr, (lines.length * 14 + 8) * dpr);
    ctx.fillStyle = '#fff';
    lines.forEach((line, i) => ctx.fillText(line, 12 * dpr, (20 + i * 14) * dpr));
    ctx.restore();
  }

  // ── shutter ──────────────────────────────────────────────────────────────
  async function waitForNextVideoFrame() {
    if (!running) return;
    if (typeof video.requestVideoFrameCallback === 'function') {
      await new Promise((resolve) => {
        let settled = false;
        const id = video.requestVideoFrameCallback(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve();
        });
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          video.cancelVideoFrameCallback?.(id);
          resolve();
        }, VIDEO_FRAME_TIMEOUT_MS);
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(CAPTURE.SETTLE_MS, VIDEO_FRAME_TIMEOUT_MS)));
  }

  async function takePhotoAttempt(settings) {
    const source = imageCapture;
    if (!source) return { blob: null, timedOut: false };
    try {
      const blob = await withDeadline(() => source.takePhoto(settings), NATIVE_PHOTO_TIMEOUT_MS);
      return { blob, timedOut: false };
    } catch (error) {
      return { blob: null, timedOut: error?.name === 'TimeoutError' };
    }
  }

  async function demoteNativeStill(generation) {
    if (generation !== activation || nativeStillDemoted) return;
    nativeStillDemoted = true;
    imageCapture = null;
    photoSettings = null;
    capturePath = 'canvas-grab';
    // A browser that exposed ImageCapture but cannot complete a still should not
    // pay that stall on every press. Promote the live stream once instead.
    const fallbackTrack = cameraTrack;
    if (fallbackTrack) {
      await requestFallbackCaptureResolution(fallbackTrack);
      if (generation !== activation) return;
      await requestContinuousFocus(fallbackTrack);
    }
  }

  /** One slow photo is not a broken camera: this shot falls back to a video
      frame, and only repeated timeouts demote the session for good. */
  async function nativeTimedOut(generation) {
    nativeTimeouts += 1;
    console.warn('[scan] native photo timed out', { nativeTimeouts, timeoutMs: NATIVE_PHOTO_TIMEOUT_MS });
    if (nativeTimeouts >= NATIVE_TIMEOUTS_BEFORE_DEMOTION) await demoteNativeStill(generation);
    return null;
  }

  async function takeNativePhoto(generation) {
    if (!imageCapture) return null;
    if (Object.keys(photoSettings ?? {}).length) {
      const first = await takePhotoAttempt(photoSettings);
      if (generation !== activation) return null;
      if (first.blob) { nativeTimeouts = 0; return first.blob; }
      if (first.timedOut) return nativeTimedOut(generation);
      // Some stacks advertise dimensions they reject at capture time.
    }
    const second = await takePhotoAttempt(undefined);
    if (generation !== activation) return null;
    if (second.timedOut) return nativeTimedOut(generation);
    if (!second.blob) await demoteNativeStill(generation);
    else nativeTimeouts = 0;
    return second.blob;
  }

  async function grabStill(generation) {
    const nativeBlob = await takeNativePhoto(generation);
    if (!running || generation !== activation) return null;
    if (nativeBlob) {
      try {
        return { bitmap: await createImageBitmap(nativeBlob), path: 'image-capture', original: nativeBlob };
      } catch (error) {
        console.warn('[scan] native still could not be decoded', error);
        await demoteNativeStill(generation);
      }
    }

    if (!running || generation !== activation) return null;
    await waitForNextVideoFrame();
    if (!running || generation !== activation || !video.videoWidth) return null;

    const bitmap = await createImageBitmap(video);
    if (!running || generation !== activation) { bitmap.close?.(); return null; }
    const original = encodeStill(bitmap);
    // Observe early rejection while geometry is in flight; shoot still awaits
    // this same promise and surfaces an encoding failure rather than saving it.
    void original.catch(() => {});
    return { bitmap, path: 'canvas-grab', original };
  }

  /**
   * Look for the page on the photograph that will actually be stored. This has
   * no time pressure, so it gets a bigger frame than the live search. Whatever
   * happens, the answer is a result, never an exception: "no quad" is a valid
   * outcome and becomes a flagged page the student can adjust.
   */
  async function analyseStill(bitmap) {
    const { width: pw, height: ph } = fitLongEdge(bitmap.width, bitmap.height, STILL_DETECT_LONG_EDGE);
    let proxy;
    try {
      proxy = await createImageBitmap(bitmap, { resizeWidth: pw, resizeHeight: ph, resizeQuality: 'medium' });
    } catch (error) {
      console.warn('[scan] could not prepare the photo for the page finder', error);
      return { detection: { status: 'unavailable', source: null, quad: null, score: null,
        degraded: false, error: String(error?.message ?? error), ms: 0 }, quad: null,
      measurements: null };
    }
    const reply = await request('detect', { bitmap: proxy }, { transfer: [proxy], timeoutMs: STILL_DETECT_TIMEOUT_MS });
    const detection = reply.ok
      ? reply.detection
      : { status: 'unavailable', source: null, quad: null, score: null, degraded: false, error: reply.error, ms: 0 };

    let quad = null;
    if (detection.status === 'found' && detection.quad) {
      const sx = bitmap.width / pw, sy = bitmap.height / ph;
      quad = detection.quad.map((p) => ({ x: p.x * sx, y: p.y * sy }));
    }
    return { detection, quad, glare: reply.ok ? (reply.exposure?.glare ?? null) : null,
      clipping: reply.ok ? (reply.exposure?.clipping ?? null) : null };
  }

  async function readStillFocus(bitmap, quad) {
    const size = quadSize(quad);
    const pageLongEdge = Math.round(Math.max(size.width, size.height));
    const rect = focusWindowRect(quad, bitmap.width, bitmap.height, pageLongEdge, FOCUS_WINDOW);
    if (!rect) return { sharpness: null, pageLongEdge };
    try {
      const crop = await createImageBitmap(bitmap, rect.sx, rect.sy, rect.size, rect.size,
        { resizeWidth: rect.target, resizeHeight: rect.target });
      const reply = await request('focus', { bitmap: crop }, { transfer: [crop], timeoutMs: 4000 });
      return { sharpness: reply.ok ? reply.sharpness : null, pageLongEdge };
    } catch (error) {
      console.warn('[scan] could not read the photo sharpness', error);
      return { sharpness: null, pageLongEdge };
    }
  }

  function scheduleAutoRetry() {
    const generation = activation;
    clearTimeout(autoRetryHandle);
    autoRetryAfter = performance.now() + AUTO_RETRY_COOLDOWN_MS;
    armed = false;
    autoRetryHandle = setTimeout(() => {
      if (!running || generation !== activation || processingHold || shootInFlight) return;
      armed = true;
    }, AUTO_RETRY_COOLDOWN_MS);
  }

  async function shoot(auto = false) {
    if (!running || !video.videoWidth || shootInFlight) return null;
    if (auto && (processingHold || performance.now() < autoRetryAfter)) return null;
    shootInFlight = true;
    publish(); // Acknowledge before still acquisition, detection or encoding.
    const transactionId = nextTransactionId++;
    const mediaTime = video.currentTime;
    const quadConfidenceAtShutter = shutterQuadConfidence({
      locked: snapshot.phase === 'locked', hasCandidate: snapshot.phase === 'candidate',
    });
    const liveHintSequence = hintSequence.map((entry) => ({ ...entry }));
    const shotActivation = activation;
    const tStart = performance.now();
    let ownedBitmap = null;

    try {
      const captured = await grabStill(shotActivation);
      const grabMs = performance.now() - tStart;
      if (!captured) return null;
      const { bitmap, path } = captured;
      ownedBitmap = bitmap;
      if (!running || shotActivation !== activation) return null;

      const tAnalyse = performance.now();
      const analysed = await analyseStill(bitmap);
      const judged = judgeStillGeometry(analysed.detection);
      const quad = analysed.quad;
      const measured = quad ? await readStillFocus(bitmap, quad) : { sharpness: null, pageLongEdge: 0 };
      const original = await captured.original;
      const analyseMs = performance.now() - tAnalyse;
      if (!running || shotActivation !== activation) return null;

      // Auto assists; it does not knowingly store a frame it can see is
      // unreadable. The shutter is sovereign: a manual press always stores.
      if (auto && measured.sharpness !== null && measured.sharpness < GUIDE.BLURRY) {
        scheduleAutoRetry();
        console.debug('[scan:auto-rejected-still]', { transactionId, reason: 'blurry' });
        return null;
      }

      const geometryConfirmed = judged.confirmed;
      // Only evidence-backed geometry is applied. Anything less stores the whole
      // photograph, flagged, for the student to adjust or keep as it is.
      const appliedQuad = geometryConfirmed ? quad : null;
      const timing = { grabMs: +grabMs.toFixed(1), analyseMs: +analyseMs.toFixed(1) };

      const gate = {
        hasPage: !!quad,
        fill: quad ? quadFill(quad, bitmap.width, bitmap.height) : 0,
        pageLongEdge: measured.pageLongEdge,
        sharpness: measured.sharpness,
        glare: analysed.glare ?? 0,
        clipping: analysed.clipping ?? 0,
        skew: quad ? skewDegrees(quad) : 0,
        steady: snapshot.stableMs >= CAPTURE.STABILITY_MS,
        blocking: geometryConfirmed ? null : 'geometry',
        hint: geometryConfirmed ? 'Ready' : 'Page edges not confirmed',
        captureVerified: geometryConfirmed,
        geometryReady: geometryConfirmed,
        quadConfidenceAtShutter,
        // Kept for the stored telemetry: the live quad is never reused on the
        // still (different field of view), the still is always searched afresh.
        rescueRedetectAttempted: quadConfidenceAtShutter !== 'locked',
        rescueRedetectSucceeded: quadConfidenceAtShutter !== 'locked' && !!quad,
        geometryConfirmed,
        liveHintSequence,
        timing: { detectMs: analysed.detection.ms ?? 0, measureMs: 0, focusMs: 0, workerUsed: true },
      };

      const shot = {
        bitmap,
        quad: appliedQuad,
        // The page the detector saw, applied or not, so Adjust edges can start
        // from it instead of an arbitrary rectangle.
        suggestedQuad: quad,
        detection: {
          status: analysed.detection.status,
          source: analysed.detection.source,
          score: analysed.detection.score,
          error: analysed.detection.error,
          flagReason: judged.reason,
        },
        auto,
        capturePath: path,
        original,
        gate,
        timing,
        transactionId,
        capturedAt: Date.now(),
        mediaTime,
        sourceKind: 'camera',
      };
      console.debug('[scan:shoot]', {
        transactionId, auto, path, quadConfidenceAtShutter, ...timing,
        detection: shot.detection,
      });
      onShot?.(shot);
      consumeHintSequence();
      ownedBitmap = null; // ownership passes to the accepted shot
      armed = false;
      return shot;
    } catch (error) {
      // A failed photograph is reported to the student, not dropped.
      console.error('[scan] capture failed', error);
      publishError('The photo could not be taken. Try again, or add the page from your files.');
      scheduleAutoRetry();
      return null;
    } finally {
      ownedBitmap?.close?.();
      if (shotActivation === activation) {
        shootInFlight = false;
        publish();
      }
    }
  }

  function publishError(message) {
    state = { ...state, hint: message, blocking: 'capture', tone: 'attention', reason: 'capture' };
    lastPublishKey = '';
    recordHintState(state);
    onState?.(state);
  }

  return {
    start,
    stop,
    shoot: () => shoot(false),
    get state() { return state; },
    get overlayPhase() { return snapshot.phase; },
    setAutoCapture(on) {
      const next = !!on;
      if (autoCapture === next) return;
      autoCapture = next;
      clearTimeout(autoRetryHandle);
      armed = true;
      autoRetryAfter = 0;
      lastPublishKey = '';
    },
    get autoCapture() { return autoCapture; },
    /** Holds Auto while earlier pages are being prepared. Releasing the hold must
        not itself arm another shot: the same page may still be under the camera. */
    setProcessing(on) { processingHold = !!on; },
    setTorchMode,
    get torch() { return torch; },
    get capturePath() { return capturePath; },
    supported: !!navigator.mediaDevices?.getUserMedia,
  };
}
