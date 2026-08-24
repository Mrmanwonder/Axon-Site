// Stage 2 · layer separation.
//
// Rewritten per IMAGE_PIPELINE.md §6. The teacher's ink is red and the student's
// is blue or black, and separating them on device costs no model call — but the
// old HSV hue mask was fragile in exactly the conditions that matter. Hue is
// numerically unstable at low saturation, faint red pen under warm indoor light
// *is* low saturation, and white paper under a tubelight drifts toward a hue a
// naive red test partly selects. So it missed the marks and found the paper.
//
// What replaces it is an opponent-colour measure taken relative to the page's
// own paper — see colour.js — emitted as a soft 8-bit probability rather than a
// binary mask. Soft matters twice over. A lightly-written half-tick and a bold
// cross both count, and the difference between them *is* the mark class, so
// binarising throws away the distinction the mask exists to carry. And because
// this is computed from decoded pixels before any lossy encode, a faint thin
// stroke that will not survive WebP survives here at full strength — which,
// measured, is the difference between keeping 12% of it and keeping all of it
// (bench/README.md).
//
// The mask is derived from the image and never written back to it. Nothing in
// this file changes a pixel that goes to a model.

import { RED, LAYER_FALLBACK, MARK_SHAPE } from './contract.js';
import { maskFrom, rednessPlane } from './colour.js';

/**
 * The soft red mask, and how much ink is on the page at all.
 *
 * Two passes rather than one: redness first, so the paper's baseline can be
 * measured from the whole page before any pixel is judged against it. A
 * threshold that does not know what this sheet looks like under this light is
 * the thing being replaced.
 */
export function maskPage(img, channel = RED.CHANNEL) {
  const { data, width, height } = img;
  const n = width * height;

  const redness = rednessPlane(img, channel);
  const [tLow, tHigh] = channel === 'lab'
    ? [RED.LAB_T_LOW, RED.LAB_T_HIGH]
    : [RED.RATIO_T_LOW, RED.RATIO_T_HIGH];
  const { mask } = maskFrom(redness, tLow, tHigh);

  // Ink coverage, for the fallback tests. Red counts as ink even where it is too
  // bright to pass the luma test.
  const ink = new Uint8Array(n);
  let inkCount = 0, redCount = 0, redWeight = 0;

  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    const isRed = mask[p] >= RED.COMPONENT_THRESHOLD;
    if (isRed) { redCount++; redWeight += mask[p] / 255; }
    if (luma <= RED.INK_LUMA_MAX || isRed) { ink[p] = 1; inkCount++; }
  }

  return {
    mask, red: thresholded(mask), ink,
    redCount, inkCount, redWeight,
    baseline: redness.baseline, channel,
    width, height,
  };
}

/** A binary copy, for component analysis only. The stored mask stays soft. */
function thresholded(mask) {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] >= RED.COMPONENT_THRESHOLD ? 1 : 0;
  return out;
}

/**
 * Label connected regions of a mask, 8-connected, with an explicit stack.
 *
 * Recursion is not an option: a single long underline on an eight-megapixel page
 * is tens of thousands of pixels deep, and the stack that flood fill would need
 * is exactly the stack a mid-tier phone does not have.
 *
 * Nothing per-pixel is retained. An earlier version pushed every pixel of every
 * component into an array, which on a page with real ink meant millions of array
 * slots built and thrown away per page — and, in the viewfinder, twelve times a
 * second. Everything the callers need is either accumulated as the fill runs or
 * recovered afterwards from the label map over one component's own bounding box.
 *
 * @returns {{components: Array, labels: Int32Array}}
 */
export function connectedComponents(mask, width, height, minPx = RED.MIN_COMPONENT_PX) {
  const n = width * height;
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const components = [];

  for (let seed = 0; seed < n; seed++) {
    if (!mask[seed] || labels[seed] !== -1) continue;
    const id = components.length;
    let top = 0;
    stack[top++] = seed;
    labels[seed] = id;

    let minX = width, minY = height, maxX = 0, maxY = 0, area = 0;
    let sumX = 0, sumY = 0;
    // Extremes of x+y and x-y, which on a rotated rectangle are its corners.
    // Tracked here so the viewfinder never needs the pixel list at all.
    let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
    let tl = null, tr = null, br = null, bl = null;

    while (top > 0) {
      const p = stack[--top];
      const x = p % width, y = (p / width) | 0;
      area++; sumX += x; sumY += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;

      const sum = x + y, diff = x - y;
      if (sum < minSum) { minSum = sum; tl = { x, y }; }
      if (sum > maxSum) { maxSum = sum; br = { x, y }; }
      if (diff > maxDiff) { maxDiff = diff; tr = { x, y }; }
      if (diff < minDiff) { minDiff = diff; bl = { x, y }; }

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width || (!dx && !dy)) continue;
          const q = ny * width + nx;
          if (mask[q] && labels[q] === -1) { labels[q] = id; stack[top++] = q; }
        }
      }
    }

    if (area < minPx) { components.push(null); continue; }
    components.push({
      id,
      box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      area,
      centroid: { x: sumX / area, y: sumY / area },
      corners: { tl, tr, br, bl },
    });
  }

  return { components: components.filter(Boolean), labels };
}

/**
 * Measure a component, then name its shape only where the geometry is decisive.
 *
 * Everything reported here is measured, not inferred. The device knows that a
 * component encloses background; it does not know that means "circled
 * deduction", because that depends on where the question regions are and what
 * the content pass read. So shape stays structural and the meaning is decided at
 * stage 5, where the context to decide it exists. Where the geometry does not
 * decide, the answer is `unknown` — an honest gap the review step can surface,
 * rather than a plausible label nothing downstream can question.
 */
export function measureComponent(comp, labels, pageWidth, pageHeight) {
  const { box, area, id } = comp;
  const fill = area / (box.w * box.h);
  const aspect = Math.max(box.w, box.h) / Math.max(1, Math.min(box.w, box.h));

  // Local copy of the component, padded by one so the background flood has a
  // guaranteed route around the outside of the shape. Read back out of the label
  // map over this component's own box, which is far less work than carrying
  // every pixel of every component through the fill.
  const lw = box.w + 2, lh = box.h + 2;
  const local = new Uint8Array(lw * lh);
  const quad = [0, 0, 0, 0];
  const midX = box.x + box.w / 2, midY = box.y + box.h / 2;

  for (let y = 0; y < box.h; y++) {
    const row = (box.y + y) * pageWidth;
    for (let x = 0; x < box.w; x++) {
      if (labels[row + box.x + x] !== id) continue;
      local[(y + 1) * lw + (x + 1)] = 1;
      // Ink distribution across the four quadrants of the bounding box. A cross
      // reaches all four corners; a tick leaves the top-left comparatively
      // empty. Reported rather than resolved — the device measures, stage 5
      // decides what it means.
      quad[((box.y + y) < midY ? 0 : 2) + ((box.x + x) < midX ? 0 : 1)]++;
    }
  }

  const holes = countHoles(local, lw, lh);

  // Mean stroke width, as area over the longer axis. A digit is thick relative
  // to its size; an underline is one stroke wide however long it runs.
  const strokeWidth = area / Math.max(box.w, box.h);

  const relativeHeight = box.h / pageHeight;
  const metrics = {
    fill: r4(fill),
    aspect: r4(aspect),
    holes,
    stroke_width: r4(strokeWidth),
    relative_height: r4(relativeHeight),
    quadrants: quad.map((q) => r4(q / area)),
  };

  return { ...comp, metrics, shape: nameShape(metrics) };
}

function nameShape(m) {
  if (m.aspect >= 4 && m.fill >= 0.12) return 'stroke';
  if (m.holes >= 1 && m.fill <= 0.62) return 'enclosure';
  if (m.fill >= 0.72 && m.aspect < 2.5) return 'blob';
  // Compact, moderately dense, roughly upright: the shape of a written digit in
  // a margin. Whether it *is* one is stage 5's call, once it knows about the
  // margin band.
  if (m.aspect < 2.4 && m.fill > 0.16 && m.fill < 0.72 &&
      m.relative_height > 0.006 && m.relative_height < 0.055) {
    const spread = m.quadrants.filter((q) => q > 0.12).length;
    if (spread >= 3 && m.fill < 0.45) return 'crossing';
    return 'glyph';
  }
  if (m.aspect < 3.2 && m.fill < 0.45 && m.quadrants.filter((q) => q > 0.1).length >= 3) {
    return 'crossing';
  }
  return 'unknown';
}

/** Background regions fully enclosed by the shape, by flooding from the padded border. */
function countHoles(local, w, h) {
  const seen = new Uint8Array(local.length);
  const stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    const push = (q, ok) => { if (ok && !local[q] && !seen[q]) { seen[q] = 1; stack.push(q); } };
    push(p - 1, x > 0); push(p + 1, x < w - 1);
    push(p - w, y > 0); push(p + w, y < h - 1);
  }
  let holes = 0;
  const counted = new Uint8Array(local.length);
  for (let p = 0; p < local.length; p++) {
    if (local[p] || seen[p] || counted[p]) continue;
    holes++;
    const s = [p]; counted[p] = 1;
    while (s.length) {
      const q = s.pop();
      const x = q % w, y = (q / w) | 0;
      const push = (r, ok) => { if (ok && !local[r] && !counted[r]) { counted[r] = 1; s.push(r); } };
      push(q - 1, x > 0); push(q + 1, x < w - 1);
      push(q - w, y > 0); push(q + w, y < h - 1);
    }
  }
  return holes;
}

/**
 * Find the vertical band the teacher's marks cluster in.
 *
 * Worth its own pass because of what it buys stage 5: with a band, attributing a
 * mark to a question is a one-dimensional search down the page instead of a
 * two-dimensional one across it. Usually right-hand, but not assumed to be —
 * plenty of teachers work down the left margin, and assuming would silently
 * misattribute every mark on those papers.
 */
export function findMarginBand(components, width) {
  if (components.length < 3) return null;
  const bins = 24;
  const hist = new Array(bins).fill(0);
  for (const c of components) hist[Math.min(bins - 1, ((c.centroid.x / width) * bins) | 0)]++;

  let bestStart = 0, bestCount = 0;
  for (let i = 0; i < bins - 1; i++) {
    const count = hist[i] + hist[i + 1];
    if (count > bestCount) { bestCount = count; bestStart = i; }
  }
  // A band has to hold most of the marks to be a band at all; otherwise the
  // marks are spread through the answers and there is nothing to exploit.
  if (bestCount < Math.max(3, components.length * 0.5)) return null;

  const inBand = components.filter((c) => {
    const bin = Math.min(bins - 1, ((c.centroid.x / width) * bins) | 0);
    return bin === bestStart || bin === bestStart + 1;
  });
  const xs = inBand.map((c) => c.centroid.x);
  return {
    x0: Math.min(...xs.map((x, i) => inBand[i].box.x)),
    x1: Math.max(...inBand.map((c) => c.box.x + c.box.w)),
    side: Math.min(...xs) / width > 0.5 ? 'right' : 'left',
    count: inBand.length,
  };
}

/**
 * Stage 2 in one call.
 *
 * Returns the teacher layer as measured components, the soft mask itself, and —
 * where the page broke the colour assumption — which way it broke, so the caller
 * can drop the page a tier and take the colour-agnostic path rather than failing
 * the scan.
 *
 * There is no content layer any more. The old build produced a red-suppressed
 * copy of the page and nothing ever read it: the server crops from the
 * conditioned page, and IMAGE_PIPELINE.md §3 forbids writing tonal changes back
 * to the pixels a model sees in any case.
 */
export function separateLayers(img, { channel = RED.CHANNEL } = {}) {
  const m = maskPage(img, channel);
  const { width, height } = m;

  const inkShare = m.inkCount / (width * height);
  const redShare = m.inkCount ? m.redCount / m.inkCount : 0;

  let fallback = null;
  // A page with real content and effectively no red on it was marked in green,
  // black or pencil. Common enough to matter, and not a reason to refuse.
  if (inkShare > 0.004 && redShare < LAYER_FALLBACK.RED_INK_SHARE_MIN) {
    fallback = LAYER_FALLBACK.NON_RED_MARKING;
  } else if (redShare > LAYER_FALLBACK.RED_INK_SHARE_MAX) {
    // Red is most of the ink, so it is not marginalia — the student wrote in it.
    fallback = LAYER_FALLBACK.STUDENT_WROTE_RED;
  }

  // The mask is meaningless when the student wrote in red; do not hand stage 5 a
  // map of the answer and call it the marking.
  const { components: raw, labels } = fallback === LAYER_FALLBACK.STUDENT_WROTE_RED
    ? { components: [], labels: null }
    : connectedComponents(m.red, width, height);
  const components = raw.map((c) => measureComponent(c, labels, width, height));

  return {
    teacher: {
      components,
      margin_band: findMarginBand(components, width),
      shapes: tally(components),
    },
    mask: { data: m.mask, width, height },
    fallback,
    coverage: {
      ink_share: r4(inkShare),
      red_share_of_ink: r4(redShare),
      // IMAGE_PIPELINE.md §6.3 wants both stored: they route the same downgrade
      // for different reasons and need different fixes later.
      red_component_area_ratio: r4(m.redCount / (width * height)),
      mask_baseline: r4(m.baseline),
      mask_channel: m.channel,
    },
  };
}

function tally(components) {
  const out = Object.fromEntries(MARK_SHAPE.map((s) => [s, 0]));
  for (const c of components) out[c.shape]++;
  return out;
}

const r4 = (n) => Math.round(n * 10000) / 10000;
