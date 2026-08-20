// Stage 2 · layer separation.
//
// The cheapest high-value trick in the pipeline, and it happens on device before
// any model sees the page. The teacher's ink is red; the student's is blue or
// black. A hue mask splits them for free — no model, no cost, no latency — and
// what comes out is a spatial map of every teacher mark on the page, with
// coordinates, before a single token has been spent. Stage 5 is then mostly a
// join between that map and the question regions stage 3 finds.
//
// It also produces a cleaner input for text recognition than the raw page,
// because teacher ink routinely strikes straight through student writing.
//
// The failure modes here are known and handled rather than assumed away: a
// teacher who marked in green, a student who wrote in red. Neither fails the
// scan. Both drop the page a confidence tier and route it down a colour-agnostic
// path, because a page we read cautiously is worth far more than one we refuse.

import { RED, LAYER_FALLBACK, MARK_SHAPE } from './contract.js';
import { coarsePlane, samplePlane, dilate } from './raster.js';
import { wrapImageData } from './imagedata.js';

/**
 * Two masks in one pass: is this pixel ink at all, and is this pixel red ink.
 *
 * Red is tested two ways and the results unioned. The HSV test is the principled
 * one, but ballpoint red on warm-lit paper often lands at a saturation an HSV
 * threshold rejects while still being unmistakable as a channel margin — R
 * clearly above both G and B. Either test alone loses real marks.
 */
export function maskPage(img) {
  const { data, width, height } = img;
  const n = width * height;
  const red = new Uint8Array(n);
  const ink = new Uint8Array(n);
  let redCount = 0, inkCount = 0;

  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const luma = (r * 299 + g * 587 + b * 114) / 1000;
    const isInk = luma <= RED.INK_LUMA_MAX;
    if (isInk) { ink[p] = 1; inkCount++; }

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < RED.VALUE_MIN * 255) continue;

    const delta = max - min;
    const sat = max === 0 ? 0 : delta / max;
    let isRed = false;

    if (sat >= RED.SATURATION_MIN && delta > 0) {
      let hue;
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
      isRed = hue <= RED.HUE_LOW_MAX || hue >= RED.HUE_HIGH_MIN;
    }
    if (!isRed && r - Math.max(g, b) >= RED.CHANNEL_MARGIN) isRed = true;

    if (isRed) {
      red[p] = 1; redCount++;
      // Red pen is ink even where it is too bright to pass the luma test.
      if (!ink[p]) { ink[p] = 1; inkCount++; }
    }
  }

  return { red, ink, redCount, inkCount, width, height };
}

/**
 * Label connected regions of a mask, 8-connected, with an explicit stack.
 *
 * Recursion is not an option: a single long underline on an eight-megapixel page
 * is tens of thousands of pixels deep, and the stack that flood fill would need
 * is exactly the stack a mid-tier phone does not have.
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
    const pixels = [];

    while (top > 0) {
      const p = stack[--top];
      const x = p % width, y = (p / width) | 0;
      area++; sumX += x; sumY += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      pixels.push(p);

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
      pixels,
    });
  }

  return components.filter(Boolean);
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
export function measureComponent(comp, pageWidth, pageHeight) {
  const { box, area, pixels } = comp;
  const fill = area / (box.w * box.h);
  const aspect = Math.max(box.w, box.h) / Math.max(1, Math.min(box.w, box.h));

  // Local copy of the component, padded by one so the background flood has a
  // guaranteed route around the outside of the shape.
  const lw = box.w + 2, lh = box.h + 2;
  const local = new Uint8Array(lw * lh);
  for (const p of pixels) {
    const x = (p % pageWidth) - box.x + 1;
    const y = ((p / pageWidth) | 0) - box.y + 1;
    local[y * lw + x] = 1;
  }

  const holes = countHoles(local, lw, lh);

  // Ink distribution across the four quadrants of the bounding box. A cross
  // reaches all four corners; a tick leaves the top-left comparatively empty.
  // Reported rather than resolved, for the same reason as above.
  const quad = [0, 0, 0, 0];
  const midX = box.x + box.w / 2, midY = box.y + box.h / 2;
  for (const p of pixels) {
    const x = p % pageWidth, y = (p / pageWidth) | 0;
    quad[(y < midY ? 0 : 2) + (x < midX ? 0 : 1)]++;
  }

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
 * The content layer: the page with red taken out and the paper put back.
 *
 * Not erased to white — filled from an estimate of the page built by averaging
 * down while ignoring red, so a strikethrough across an answer leaves the
 * surrounding paper tone rather than a bright scar. Text recognition reads the
 * result far more reliably than the raw page, where teacher ink crosses student
 * writing constantly.
 */
export function suppressRed(img, redMask) {
  const { data, width, height } = img;
  const grown = dilate(redMask, width, height);
  const pw = Math.max(8, Math.round(width / 24));
  const ph = Math.max(8, Math.round(height / 24));
  const plane = coarsePlane(img, pw, ph, grown);

  const out = new Uint8ClampedArray(data.length);
  out.set(data);
  const sample = new Float32Array(3);

  for (let p = 0; p < grown.length; p++) {
    if (!grown[p]) continue;
    const x = p % width, y = (p / width) | 0;
    samplePlane(plane, pw, ph, x, y, width, height, sample);
    const i = p * 4;
    out[i] = sample[0]; out[i + 1] = sample[1]; out[i + 2] = sample[2]; out[i + 3] = 255;
  }
  return wrapImageData(out, width, height);
}

/**
 * Stage 2 in one call.
 *
 * Returns the teacher layer as measured components, the content layer as an
 * image, and — where the page broke the colour assumption — which way it broke,
 * so the caller can drop the page a tier and take the colour-agnostic path
 * instead of failing the scan.
 */
export function separateLayers(img, { withContentLayer = true } = {}) {
  const { red, ink, redCount, inkCount, width, height } = maskPage(img);

  const inkShare = inkCount / (width * height);
  const redShare = inkCount ? redCount / inkCount : 0;

  let fallback = null;
  // A page with real content and effectively no red on it was marked in green,
  // black or pencil. Common enough to matter, and not a reason to refuse.
  if (inkShare > 0.004 && redShare < LAYER_FALLBACK.RED_INK_SHARE_MIN) {
    fallback = LAYER_FALLBACK.NON_RED_MARKING;
  } else if (redShare > LAYER_FALLBACK.RED_INK_SHARE_MAX) {
    // Red is most of the ink on the page, so it is not marginalia. Rare, and it
    // breaks the assumption completely.
    fallback = LAYER_FALLBACK.STUDENT_WROTE_RED;
  }

  const raw = fallback === LAYER_FALLBACK.STUDENT_WROTE_RED
    ? [] // the mask is meaningless here; do not hand stage 5 a map of the answer
    : connectedComponents(red, width, height);
  const components = raw.map((c) => measureComponent(c, width, height))
    .map(({ pixels, ...rest }) => rest); // drop the pixel lists; only geometry travels

  return {
    teacher: {
      components,
      margin_band: findMarginBand(components, width),
      shapes: tally(components),
    },
    content: withContentLayer && fallback !== LAYER_FALLBACK.STUDENT_WROTE_RED
      ? suppressRed(img, red)
      : img,
    fallback,
    coverage: { ink_share: r4(inkShare), red_share_of_ink: r4(redShare) },
  };
}

function tally(components) {
  const out = Object.fromEntries(MARK_SHAPE.map((s) => [s, 0]));
  for (const c of components) out[c.shape]++;
  return out;
}

const r4 = (n) => Math.round(n * 10000) / 10000;
