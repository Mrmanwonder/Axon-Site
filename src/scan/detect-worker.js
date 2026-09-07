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
  const { id, kind, bitmap } = event.data;
  try {
    if (kind === 'search') { handleSearch(id, bitmap); return; }
    if (kind === 'focus') { handleFocus(id, bitmap); return; }
  } catch {
    // A bad frame is not worth losing the worker for — respond as "nothing
    // found this cycle" so the client's search self-corrects on the next
    // one, the same way the main-thread fallback's per-call try/catch does.
    bitmap?.close?.();
    self.postMessage({ id, found: null, sharpness: null });
  }
};
