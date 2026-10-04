// Live page search, entirely off the UI thread.
//
// One job: take a frame, ask the detector (src/scan/detector.js) where the page
// is, and answer. Every request gets exactly one reply, success or failure; the
// old worker could drop an error on the floor (`workerError` was never read) and
// the viewfinder simply sat on "searching" with no reason.
//
//   in : { kind: 'init',    id, assetBaseUrl }
//        { kind: 'detect',  id, bitmap }
//        { kind: 'measure', id, bitmap, quad }   exposure + skew inside the quad
//        { kind: 'focus',   id, bitmap }         sharpness of a window
//   out : { id, ok: true,  ...payload }
//         { id, ok: false, error }
//         { kind: 'fatal', error }               the worker itself failed

import { detectPage, warmUp } from './detector.js';
import { lumaFromHistogram } from './guidance.js';
import { measureQuad, sharpness, skewDegrees } from './quality.js';

const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let assetBaseUrl;

// What the guidance strip is allowed to claim comes from here: measurements of
// the very frame the detector saw, never inferences.
const THUMB = 24;
let previousThumb = null;

function frameSignals(frame) {
  const { data, width, height } = frame;
  const hist = new Uint32Array(256);
  const thumb = new Float32Array(THUMB * THUMB);
  const counts = new Uint16Array(THUMB * THUMB);
  const step = 2; // every other pixel is plenty for a histogram
  for (let y = 0; y < height; y += step) {
    const ty = Math.min(THUMB - 1, Math.floor(y * THUMB / height));
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      hist[luma | 0]++;
      const t = ty * THUMB + Math.min(THUMB - 1, Math.floor(x * THUMB / width));
      thumb[t] += luma;
      counts[t]++;
    }
  }
  let motion = null;
  for (let i = 0; i < thumb.length; i++) thumb[i] = counts[i] ? thumb[i] / counts[i] : 0;
  if (previousThumb) {
    let sum = 0;
    for (let i = 0; i < thumb.length; i++) sum += Math.abs(thumb[i] - previousThumb[i]);
    motion = sum / thumb.length;
  }
  previousThumb = thumb;
  return { luma: lumaFromHistogram(hist), motion };
}

/**
 * Is there a visible edge where the quad says the page ends? Mean luminance
 * difference between a point just inside and just outside the quad, sampled
 * along all four edges. A quad drawn in the middle of a page that fills the
 * frame has no edge under it, so this is what stops "move closer, the page is
 * small" being said about a page that is actually too big. Pairs that would
 * fall outside the frame are skipped (unknown, not zero); null when fewer than
 * six pairs could be taken.
 */
/**
 * Is the inside of the quad plausibly paper? Paper is the light thing in the
 * picture: it is at least as bright as what surrounds it, or bright in its own
 * right. A laptop keyboard or a dark book cover is a confident four-cornered
 * shape that is clearly darker than its surroundings, and the model will call
 * it a page (owner's phone, 4 Oct 2026). Relative, not absolute: an absolute
 * brightness gate once dropped real pages in dim rooms (AXO-144), so a dim page
 * that is still the brightest thing in view passes.
 *
 * Returns { inside, outside } median luma or null when it cannot be measured.
 */
function interiorLight(frame, quad) {
  const { data, width, height } = frame;
  const at = (x, y) => {
    const xx = Math.round(x), yy = Math.round(y);
    if (xx < 0 || yy < 0 || xx >= width || yy >= height) return null;
    const i = (yy * width + xx) * 4;
    return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  };
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const inside = [];
  for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
    const top = lerp(quad[0], quad[1], i / 10), bottom = lerp(quad[3], quad[2], i / 10);
    const p = lerp(top, bottom, j / 10);
    const v = at(p.x, p.y);
    if (v !== null) inside.push(v);
  }
  const cx = quad.reduce((a, p) => a + p.x, 0) / 4;
  const cy = quad.reduce((a, p) => a + p.y, 0) / 4;
  const outside = [];
  for (let e = 0; e < 4; e++) {
    const a = quad[e], b = quad[(e + 1) % 4];
    for (let k = 1; k <= 8; k++) {
      const p = lerp(a, b, k / 9);
      const dx = p.x - cx, dy = p.y - cy, len = Math.hypot(dx, dy) || 1;
      const off = Math.max(6, Math.min(width, height) * 0.06);
      const v = at(p.x + dx / len * off, p.y + dy / len * off);
      if (v !== null) outside.push(v);
    }
  }
  if (inside.length < 40 || outside.length < 8) return null;
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  return { inside: median(inside), outside: median(outside) };
}

function edgeContrast(frame, quad) {
  const { data, width, height } = frame;
  const luma = (x, y) => {
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.round(x) + dx, yy = Math.round(y) + dy;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const i = (yy * width + xx) * 4;
      sum += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      n++;
    }
    return n ? sum / n : null;
  };
  const offset = Math.max(4, Math.min(width, height) * 0.03);
  const cx = quad.reduce((a, p) => a + p.x, 0) / 4;
  const cy = quad.reduce((a, p) => a + p.y, 0) / 4;
  let total = 0, pairs = 0;
  for (let e = 0; e < 4; e++) {
    const a = quad[e], b = quad[(e + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    // Normal pointing toward the quad's centre.
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
    for (let k = 1; k <= 8; k++) {
      const t = k / 9;
      const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
      const ix = px + nx * offset, iy = py + ny * offset;
      const ox = px - nx * offset, oy = py - ny * offset;
      if (ox < 0 || oy < 0 || ox >= width || oy >= height) continue;
      const inside = luma(ix, iy), outside = luma(ox, oy);
      if (inside === null || outside === null) continue;
      total += Math.abs(inside - outside);
      pairs++;
    }
  }
  return pairs >= 6 ? total / pairs : null;
}

function imageDataFrom(bitmap) {
  if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
  }
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function handle({ kind, id, bitmap, quad, assetBaseUrl: base }) {
  if (kind === 'init') {
    assetBaseUrl = base;
    const ready = await warmUp({ assetBaseUrl });
    return { id, ok: true, ml: ready.ml, error: ready.error };
  }
  if (kind === 'detect') {
    const frame = imageDataFrom(bitmap);
    bitmap.close?.();
    const signals = frameSignals(frame);
    const detection = await detectPage(frame, { assetBaseUrl });
    const exposure = detection.quad ? measureQuad(frame, detection.quad) : null;
    signals.edgeContrast = detection.quad ? edgeContrast(frame, detection.quad) : null;
    signals.interior = detection.quad ? interiorLight(frame, detection.quad) : null;
    return { id, ok: true, detection, signals, exposure, width: frame.width, height: frame.height };
  }
  if (kind === 'measure') {
    const frame = imageDataFrom(bitmap);
    bitmap.close?.();
    const started = performance.now();
    return {
      id, ok: true,
      exposure: measureQuad(frame, quad),
      skew: skewDegrees(quad),
      measureMs: performance.now() - started,
    };
  }
  if (kind === 'focus') {
    const frame = imageDataFrom(bitmap);
    bitmap.close?.();
    const read = sharpness(frame, { scale: 1 });
    return { id, ok: true, sharpness: read.blank ? null : read.score };
  }
  throw new Error(`unknown request: ${kind}`);
}

self.onmessage = async (event) => {
  const { id, bitmap } = event.data;
  try {
    self.postMessage(await handle(event.data));
  } catch (error) {
    bitmap?.close?.();
    self.postMessage({ id, ok: false, error: String(error?.message ?? error).slice(0, 240) });
  }
};

self.addEventListener('unhandledrejection', (event) => {
  self.postMessage({ kind: 'fatal', error: String(event.reason?.message ?? event.reason).slice(0, 240) });
});
