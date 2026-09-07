// Stage 0's live search, off the main thread.
//
// scan-ground-up-revamp-2026-09-07.md, Phase 1: `step()` used to run
// synchronously on the same thread as the video decode and the overlay's
// rAF loop — a CPU-bound Hough search sharing a thread slice with rendering
// is a structural cause of "the border takes forever," independent of the
// detector's own accuracy. Everything CPU-bound in one search — the Hough
// line search (`detectQuad`), the exposure/skew read (`measureQuad`,
// `skewDegrees`), and the focus-window sharpness read (`sharpness`) — runs
// here instead.
//
// Two message kinds, because they run on different data at different points
// in a search: 'search' takes the small proxy frame and runs every cycle;
// 'focus' takes a native-resolution crop that only exists once a quad has
// been found, so it is a second, optional round trip per cycle rather than
// bundled into the first — capture.js only asks for it when there is a page
// to focus on.
//
// Pure functions in, off the main thread — `edges.js` and `quality.js` know
// nothing about a Worker or a DOM, which is what makes this file thin: it is
// the pixel-source boundary (turning a transferred ImageBitmap into the
// ImageData those functions expect) and nothing else.

import { detectQuad } from './edges.js';
import { findCorner } from './corner-search.js';
import { measureQuad, sharpness, skewDegrees } from './quality.js';

// Reused across messages rather than constructed per call — a fresh
// OffscreenCanvas is one more allocation on a loop that already runs up to
// ~12 times a second.
const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function imageDataFrom(bitmap) {
  if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
  }
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

function handleSearch(id, bitmap) {
  const frame = imageDataFrom(bitmap);
  bitmap.close?.();

  const tDetectStart = performance.now();
  const found = detectQuad(frame);
  const detectMs = performance.now() - tDetectStart;

  if (!found) {
    self.postMessage({ id, found: null, detectMs, measureMs: 0 });
    return;
  }

  const tMeasureStart = performance.now();
  const exposure = measureQuad(frame, found);
  const skew = skewDegrees(found);
  const measureMs = performance.now() - tMeasureStart;

  self.postMessage({ id, found, exposure, skew, detectMs, measureMs });
}

/**
 * Exposure and skew for a quad somebody else already found.
 *
 * Split out from 'search' once the tracker took over finding the page: the
 * expensive part of a search is `detectQuad`, and re-running it to get an
 * exposure reading for a page whose corners are already known would be paying
 * for the answer twice.
 */
function handleMeasure(id, bitmap, quad) {
  const frame = imageDataFrom(bitmap);
  bitmap.close?.();
  const started = performance.now();
  const exposure = measureQuad(frame, quad);
  const skew = skewDegrees(quad);
  self.postMessage({ id, exposure, skew, measureMs: performance.now() - started });
}

/**
 * The per-frame message: four small windows, four corners.
 *
 * The four windows are blitted into one canvas as tiles and read back once.
 * `getImageData` costs far more than the pixels in it — it is a readback
 * across the canvas boundary — so four reads of four thousand pixels each is
 * slower than one read of sixteen thousand, and this runs on every frame that
 * has a page in it.
 *
 * Coordinates come back in the caller's own space, not the window's: the
 * worker is the only side that knows where each tile came from, so converting
 * here is one addition rather than a convention both sides have to hold.
 */
function handleTrack(id, bitmap, windows) {
  const started = performance.now();
  const size = windows[0]?.size ?? 0;
  if (!size) {
    bitmap.close?.();
    self.postMessage({ id, observations: {}, trackMs: 0 });
    return;
  }

  const columns = Math.min(2, windows.length);
  const rows = Math.ceil(windows.length / columns);
  if (canvas.width !== columns * size || canvas.height !== rows * size) {
    canvas.width = columns * size;
    canvas.height = rows * size;
  }
  windows.forEach((w, i) => {
    const dx = (i % columns) * size, dy = Math.floor(i / columns) * size;
    ctx.drawImage(bitmap, w.sx, w.sy, size, size, dx, dy, size, size);
  });
  const tiles = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const observations = {};
  windows.forEach((w, i) => {
    const dx = (i % columns) * size, dy = Math.floor(i / columns) * size;
    const found = findCorner(tileAt(tiles, dx, dy, size), { edgeA: w.edgeA, edgeB: w.edgeB });
    observations[w.id] = found
      ? { x: w.sx + found.x, y: w.sy + found.y, confidence: found.confidence,
          edgeDirectionA: w.edgeA, edgeDirectionB: w.edgeB }
      : null;
  });

  self.postMessage({ id, observations, trackMs: performance.now() - started });
}

/** One tile out of the tiled readback, as the ImageData findCorner expects. */
function tileAt(tiles, x0, y0, size) {
  const out = new Uint8ClampedArray(size * size * 4);
  const stride = tiles.width * 4;
  for (let y = 0; y < size; y++) {
    const from = (y0 + y) * stride + x0 * 4;
    out.set(tiles.data.subarray(from, from + size * 4), y * size * 4);
  }
  return { data: out, width: size, height: size };
}

function handleFocus(id, bitmap) {
  const frame = imageDataFrom(bitmap);
  bitmap.close?.();

  const tFocusStart = performance.now();
  // scale: 1 — capture.js has already cropped and resized this to the
  // canonical page scale before sending it, and resampling it again here
  // would measure the resampler rather than the page. See capture.js's
  // searchOnWorker() and quality.js's focusWindowRect().
  const read = sharpness(frame, { scale: 1 });
  const focusMs = performance.now() - tFocusStart;

  self.postMessage({ id, sharpness: read.blank ? null : read.score, focusMs });
}

self.onmessage = (event) => {
  const { id, kind, bitmap, windows, quad } = event.data;
  try {
    if (kind === 'search') { handleSearch(id, bitmap); return; }
    if (kind === 'measure') { handleMeasure(id, bitmap, quad); return; }
    if (kind === 'track') { handleTrack(id, bitmap, windows); return; }
    if (kind === 'focus') { handleFocus(id, bitmap); return; }
  } catch {
    // A bad frame is not worth losing the worker for — respond as "nothing
    // found this cycle" so the client's search self-corrects on the next
    // one, the same way the main-thread fallback's per-call try/catch does.
    bitmap?.close?.();
    // Empty observations rather than none: for a tracking message, "looked and
    // found nothing" is what the tracker needs to hear, and it is the same
    // answer it would get from a frame where the page really had gone.
    self.postMessage({ id, found: null, sharpness: null, observations: {} });
  }
};
