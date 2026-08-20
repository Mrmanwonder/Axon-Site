// Stage 0 · capture.
//
// The viewfinder, the gate in front of the shutter, and the tray behind it.
//
// The container question in SCANNING_SYSTEM.md §3 is still open — a native
// document scanner behind Capacitor would do this better than any web build can,
// and until that is decided this is the competent-but-modest in-app camera the
// document names as the honest fallback. Everything below the capture boundary
// is unaffected by that choice: what this produces is a conditioned page, a
// teacher-mark map and a quality verdict, and a native scanner would produce the
// same three things.
//
// Two rules shape all of it. The gate assists, it never blocks: auto-capture can
// refuse, the shutter never does. And the quality verdict happens here, while
// the paper is still in front of the student, because the same verdict forty
// seconds later at review usually means the page is simply lost.

import { CAPTURE, QUALITY } from './contract.js';
import { detectQuad, easeQuad, scaleQuad } from './edges.js';
import { blurScore, glareInQuad, toGray } from './quality.js';
import { quadDrift, quadFill } from './geometry.js';

const DETECT_INTERVAL_MS = 80;   // ~12 searches a second; the overlay still runs at frame rate
const PROXY_WIDTH = 240;

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
  let lastDetection = null; // raw, for stability comparison
  let steadySince = 0;
  let autoCapture = true;
  let armed = true;         // disarms after a shot so one steady page is one page
  let state = blankState();

  const proxy = document.createElement('canvas');
  const proxyCtx = proxy.getContext('2d', { willReadFrequently: true });

  function blankState() {
    return {
      hasPage: false,
      fill: 0,
      sharpness: 0,
      glare: 0,
      steady: false,
      /** What the student is told, right now. One line, actionable. */
      hint: 'Lay the page flat and fit all four corners in the frame',
      blocking: null,
    };
  }

  async function start() {
    if (running) return;
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1440 },
      },
      audio: false,
    });
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    await video.play();
    running = true;
    armed = true;
    loop();
    detect();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafHandle);
    clearTimeout(detectHandle);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    quad = lastDetection = null;
  }

  // ── the search ───────────────────────────────────────────────────────────

  function detect() {
    if (!running) return;
    try { step(); } catch { /* a bad frame is not worth stopping the camera for */ }
    detectHandle = setTimeout(detect, DETECT_INTERVAL_MS);
  }

  function step() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;

    const pw = PROXY_WIDTH, ph = Math.round(PROXY_WIDTH * vh / vw);
    if (proxy.width !== pw || proxy.height !== ph) { proxy.width = pw; proxy.height = ph; }
    proxyCtx.drawImage(video, 0, 0, pw, ph);
    const frame = proxyCtx.getImageData(0, 0, pw, ph);

    const found = detectQuad(frame);
    const next = blankState();

    if (!found) {
      lastDetection = null;
      steadySince = 0;
      quad = null;
      publish(next);
      return;
    }

    next.hasPage = true;
    next.fill = quadFill(found, pw, ph);
    next.sharpness = blurScore(toGray(frame), pw, ph);
    next.glare = glareInQuad(frame, found);

    // Steady means the corners have stopped moving, not that the phone has.
    const drift = quadDrift(lastDetection, found, pw, ph);
    if (drift > CAPTURE.STABILITY_TOLERANCE) steadySince = performance.now();
    else if (!steadySince) steadySince = performance.now();
    lastDetection = found;
    next.steady = performance.now() - steadySince >= CAPTURE.STABILITY_MS;

    quad = easeQuad(quad, scaleQuad(found, { width: pw, height: ph }, { width: vw, height: vh }));

    // ── the gate ───────────────────────────────────────────────────────────
    // Ordered by what the student should fix first. Glare comes before
    // sharpness because a washed-out red tick reads as no tick at all — the
    // page looks fine and the marks are simply gone.

    if (next.glare > QUALITY.GLARE_WARN) {
      next.blocking = 'glare';
      next.hint = 'Light is bouncing off the page — tilt it slightly away from the light';
    } else if (next.fill < CAPTURE.MIN_FILL) {
      next.blocking = 'distance';
      next.hint = 'Move closer so the page fills the frame';
    } else if (next.sharpness < QUALITY.BLUR_WARN) {
      next.blocking = 'focus';
      next.hint = 'Hold still — the page is not sharp yet';
    } else if (!next.steady) {
      next.hint = 'Hold still';
    } else {
      next.hint = 'Ready';
    }

    publish(next);

    if (autoCapture && armed && !next.blocking && next.steady) {
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

  async function shoot(auto = false) {
    if (!running || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const bitmap = await createImageBitmap(canvas);

    // The quad travels with the frame so conditioning can warp it. Full-frame
    // coordinates, because the quad on screen is the smoothed display copy.
    const shotQuad = lastDetection && video.videoWidth
      ? scaleQuad(lastDetection,
          { width: proxy.width, height: proxy.height },
          { width: video.videoWidth, height: video.videoHeight })
      : null;

    const shot = { bitmap, quad: shotQuad, auto, gate: { ...state } };
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
    /** Whether a camera exists at all. Upload is a first-class path, not a fallback. */
    supported: !!navigator.mediaDevices?.getUserMedia,
  };
}
