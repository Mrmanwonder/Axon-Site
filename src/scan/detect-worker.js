// Stage 0 live search, entirely off the UI thread.
//
// Normal frames take the cheapest path. If the global detector has failed for
// about two seconds, a second search runs on an illumination-normalised copy of
// the proxy. That fallback is specifically for hand/phone shadows: a shadow is
// a strong edge, but it should not become a stronger document candidate than
// the actual paper boundary.

import { detectQuad } from './edges.js';
import { findCorner } from './corner-search.js';
import { measureQuad, sharpness, skewDegrees } from './quality.js';

const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const SHADOW_FALLBACK_AFTER_MS = 2000;
const NORMALIZE_CELL = 24;
let missingSince = 0;

function imageDataFrom(bitmap) {
  if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
  }
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

/**
 * Cheap local V-channel normalisation for the rare shadow-recovery pass.
 *
 * We estimate illumination from the maximum RGB channel (HSV's V), smooth it
 * on a coarse grid, and apply only bounded scalar gain to RGB. Hue/chroma are
 * preserved well enough for geometry search, while broad hand shadows lose the
 * artificial edge that otherwise competes with the paper border.
 */
function normalizeIllumination(img) {
  const { data, width, height } = img;
  const cols = Math.max(1, Math.ceil(width / NORMALIZE_CELL));
  const rows = Math.max(1, Math.ceil(height / NORMALIZE_CELL));
  const sums = new Float64Array(cols * rows);
  const counts = new Uint32Array(cols * rows);

  for (let y = 0; y < height; y++) {
    const cy = Math.min(rows - 1, Math.floor(y / NORMALIZE_CELL));
    for (let x = 0; x < width; x++) {
      const cx = Math.min(cols - 1, Math.floor(x / NORMALIZE_CELL));
      const p = (y * width + x) * 4;
      sums[cy * cols + cx] += Math.max(data[p], data[p + 1], data[p + 2]);
      counts[cy * cols + cx]++;
    }
  }

  const field = new Float64Array(cols * rows);
  const values = [];
  for (let i = 0; i < field.length; i++) {
    field[i] = counts[i] ? sums[i] / counts[i] : 0;
    if (counts[i]) values.push(field[i]);
  }
  values.sort((a, b) => a - b);
  const target = values.length ? values[Math.floor(values.length * 0.6)] : 180;

  // Smooth the coarse field so cell boundaries cannot become new detector edges.
  const smooth = new Float64Array(field.length);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = cy + dy, xx = cx + dx;
          if (yy < 0 || yy >= rows || xx < 0 || xx >= cols) continue;
          const v = field[yy * cols + xx];
          if (!v) continue;
          sum += v;
          n++;
        }
      }
      smooth[cy * cols + cx] = n ? sum / n : target;
    }
  }

  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    const gy = Math.min(rows - 1, y / NORMALIZE_CELL);
    const y0 = Math.floor(gy), y1 = Math.min(rows - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < width; x++) {
      const gx = Math.min(cols - 1, x / NORMALIZE_CELL);
      const x0 = Math.floor(gx), x1 = Math.min(cols - 1, x0 + 1), fx = gx - x0;
      const a = smooth[y0 * cols + x0], b = smooth[y0 * cols + x1];
      const c = smooth[y1 * cols + x0], d = smooth[y1 * cols + x1];
      const local = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      // Conservative bounds: this is geometry recovery, not image enhancement.
      const gain = Math.max(0.82, Math.min(1.38, target / Math.max(24, local)));
      const p = (y * width + x) * 4;
      out[p] = Math.min(255, data[p] * gain);
      out[p + 1] = Math.min(255, data[p + 1] * gain);
      out[p + 2] = Math.min(255, data[p + 2] * gain);
      out[p + 3] = data[p + 3];
    }
  }
  return new ImageData(out, width, height);
}

function handleSearch(id, bitmap, minFill = null) {
  const frame = imageDataFrom(bitmap);
  bitmap.close?.();

  const tDetectStart = performance.now();
  const detectOptions = Number.isFinite(minFill) ? { minFill } : undefined;
  let found = detectQuad(frame, detectOptions);
  let shadowFallback = false;
  let normalizeMs = 0;

  if (!found) {
    const now = performance.now();
    if (!missingSince) missingSince = now;
    if (now - missingSince >= SHADOW_FALLBACK_AFTER_MS) {
      const normalizeStart = performance.now();
      const normalized = normalizeIllumination(frame);
      normalizeMs = performance.now() - normalizeStart;
      found = detectQuad(normalized, detectOptions);
      shadowFallback = !!found;
    }
  } else {
    missingSince = 0;
  }

  const detectMs = performance.now() - tDetectStart;
  if (!found) {
    self.postMessage({ id, found: null, detectMs, measureMs: 0, normalizeMs, shadowFallback: false });
    return;
  }
  missingSince = 0;

  // Quality is always measured on the real pixels. The normalized copy exists
  // only to recover geometry; it must never make exposure/glare look healthier.
  const tMeasureStart = performance.now();
  const exposure = measureQuad(frame, found);
  const skew = skewDegrees(found);
  const measureMs = performance.now() - tMeasureStart;

  self.postMessage({ id, found, exposure, skew, detectMs, measureMs, normalizeMs, shadowFallback });
}

function handleMeasure(id, bitmap, quad) {
  const frame = imageDataFrom(bitmap);
  bitmap.close?.();
  const started = performance.now();
  const exposure = measureQuad(frame, quad);
  const skew = skewDegrees(quad);
  self.postMessage({ id, exposure, skew, measureMs: performance.now() - started });
}

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
    const found = findCorner(tileAt(tiles, dx, dy, size), {
      edgeA: w.edgeA,
      edgeB: w.edgeB,
      expectedX: w.expectedX,
      expectedY: w.expectedY,
    });
    observations[w.id] = found
      ? {
          x: w.sx + found.x,
          y: w.sy + found.y,
          confidence: found.confidence,
          edgeDirectionA: w.edgeA,
          edgeDirectionB: w.edgeB,
        }
      : null;
  });

  self.postMessage({ id, observations, trackMs: performance.now() - started });
}

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
  const read = sharpness(frame, { scale: 1 });
  const focusMs = performance.now() - tFocusStart;
  self.postMessage({ id, sharpness: read.blank ? null : read.score, focusMs });
}

self.onmessage = (event) => {
  const { id, kind, bitmap, windows, quad, minFill } = event.data;
  try {
    if (kind === 'search') { handleSearch(id, bitmap, minFill); return; }
    if (kind === 'measure') { handleMeasure(id, bitmap, quad); return; }
    if (kind === 'track') { handleTrack(id, bitmap, windows); return; }
    if (kind === 'focus') { handleFocus(id, bitmap); return; }
  } catch (error) {
    bitmap?.close?.();
    self.postMessage({
      id,
      found: null,
      sharpness: null,
      observations: {},
      workerError: error?.message ?? 'worker frame failed',
    });
  }
};
