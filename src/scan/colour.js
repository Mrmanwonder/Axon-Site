// Redness, measured two ways.
//
// IMAGE_PIPELINE.md §6 retires the HSV hue mask. Hue is numerically unstable at
// low saturation, and faint red pen under a warm indoor light is exactly low
// saturation — while white paper under a tubelight drifts toward a hue a naive
// red test will partly select. So the page ends up with a mask that misses the
// marks and finds the paper.
//
// Two replacements, because §6.1 offers both and says to measure rather than
// choose: CIELAB's a* axis, which is built to be perceptually uniform and
// reasonably illumination-stable, and a plain illumination ratio, which is
// cruder and much cheaper. bench/mask.html runs them against each other.
//
// What makes either robust is not the channel, it is the baseline: redness is
// measured relative to *this page's paper under this light*, not against a fixed
// threshold that assumes daylight and a white sheet.

/** sRGB 0–255 to linear 0–1. Exact, and a lookup because the input is 8-bit. */
const LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// D65 white point.
const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
const DELTA = 6 / 29;
const D3 = DELTA ** 3;
const labF = (t) => (t > D3 ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29);

/**
 * CIELAB a* for one sRGB triple. Positive is red, negative is green.
 *
 * Only a* is computed — L* and b* cost more cube roots and nothing here reads
 * them. The Z term drops out of a* entirely, so the blue channel only matters
 * through its contribution to X and Y.
 */
export function redA(r, g, b) {
  const R = LINEAR[r], G = LINEAR[g], B = LINEAR[b];
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / Xn;
  const Y = (0.2126729 * R + 0.7151522 * G + 0.0721750 * B) / Yn;
  return 500 * (labF(X) - labF(Y));
}

/**
 * The cheap one: how much more red there is than everything else.
 *
 * Scale-invariant, so it survives the lighting gradient across a page without
 * any of the flattening that IMAGE_PIPELINE.md forbids — brightening a patch
 * multiplies all three channels and cancels out of the ratio. Much less
 * principled than a*, one divide instead of two cube roots.
 */
export function redRatio(r, g, b) {
  return (r + 1) / (g + b + 2);
}

export const CHANNELS = /** @type {const} */ (['lab', 'ratio']);

/**
 * A redness plane for a whole image, plus the paper's own baseline.
 *
 * The baseline is the modal value — the single most common redness on the page,
 * which is the paper, because paper is most of what a page is. Subtracting it is
 * what turns "how red is this pixel" into "how much redder than this sheet",
 * which is the only question with a stable answer across kitchens, classrooms
 * and tubelights.
 */
export function rednessPlane(img, channel = 'lab') {
  const { data, width, height } = img;
  const n = width * height;
  const plane = new Float32Array(n);
  const measure = channel === 'lab' ? redA : redRatio;

  for (let p = 0, i = 0; p < n; p++, i += 4) {
    plane[p] = measure(data[i], data[i + 1], data[i + 2]);
  }

  return { plane, width, height, baseline: modeOf(plane), channel };
}

// The share of the plane trimmed from each end before the mode is measured.
// Small, because this is not robustness against a noisy population — it is
// protection against the handful of pixels that set the raw maximum.
const MODE_TRIM = 0.005;

/**
 * The most common value in the plane, to a useful precision.
 *
 * A histogram rather than a mean: a page with a lot of red on it would drag a
 * mean upward and quietly raise the bar for detecting the red, which is the
 * opposite of what is wanted. The mode is the paper however much ink is on it.
 *
 * Two passes, and the second one is not an optimisation — it is the whole
 * correctness of this function.
 *
 * A single histogram spanning the plane's raw minimum to its raw maximum spends
 * all of its resolution on outliers. `redRatio` is (r+1)/(g+b+2), so one pixel
 * with almost no green or blue in it — a saturated red, a black speck, a JPEG
 * artefact on an edge — reads 85 or more, while the paper this function is
 * looking for sits near 0.5 and every value that matters lives under 1. Across
 * 512 bins that put the paper's mode in bin two or bin three and nowhere else:
 * a resolution of 0.16 on a quantity the entire red separation is measured
 * against.
 *
 * It was not merely imprecise, it was unstable. Which of those two bins the
 * mode fell in was decided by whichever single pixel happened to be the
 * reddest, so resizing a page by ONE pixel moved the baseline from 0.49 to
 * 0.34, the mask threshold from 0.61 to 0.46, and the red share of the page's
 * ink from 0.126 to 0.257 — across `LAYER_FALLBACK.RED_INK_SHARE_MAX`, which
 * decides whether a page is a teacher's marking or a student writing in red.
 * On the corpus's real submitted pages, at exactly the size conditioning
 * produces, that verdict came out "the student wrote in red" and 141 genuine
 * teacher marks became zero. See bench/marks-report.mjs.
 *
 * So: one pass to find where the mass actually is, discarding half a percent
 * from each end, and a second over that range where all 512 bins buy real
 * precision. Two passes over the plane, once per page.
 */
export function modeOf(plane, bins = 512) {
  const range = trimmedRange(plane, bins);
  if (!range) return plane.length ? plane[0] : 0;
  const { lo, hi } = range;

  const hist = new Uint32Array(bins);
  const scale = (bins - 1) / (hi - lo);
  for (let i = 0; i < plane.length; i++) {
    const bin = (plane[i] - lo) * scale;
    // Everything outside the trimmed range folds into the nearest end bin. It
    // cannot become the mode — that is the point — but discarding it outright
    // would be a third pass for no gain.
    hist[bin < 0 ? 0 : bin > bins - 1 ? bins - 1 : bin | 0]++;
  }

  let best = 0, bestCount = 0;
  for (let i = 0; i < bins; i++) if (hist[i] > bestCount) { bestCount = hist[i]; best = i; }
  return lo + best / scale;
}

/**
 * Where the plane's values actually are, with the extremes trimmed off.
 *
 * A coarse histogram over the raw range, read back as a cumulative count. The
 * raw range is outlier-driven and that is fine here: the outliers are few by
 * definition, so the position of the half-percent mark barely moves even when
 * the maximum does. Null when the plane is empty or flat.
 */
function trimmedRange(plane, bins) {
  if (!plane.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < plane.length; i++) {
    const v = plane[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!(hi > lo)) return null;

  const coarse = new Uint32Array(bins);
  const scale = (bins - 1) / (hi - lo);
  for (let i = 0; i < plane.length; i++) coarse[((plane[i] - lo) * scale) | 0]++;

  const cut = plane.length * MODE_TRIM;
  let seen = 0, low = 0, high = bins - 1;
  for (let i = 0; i < bins; i++) { seen += coarse[i]; if (seen >= cut) { low = i; break; } }
  seen = 0;
  for (let i = bins - 1; i >= 0; i--) { seen += coarse[i]; if (seen >= cut) { high = i; break; } }
  if (high <= low) return null;

  return { lo: lo + low / scale, hi: lo + high / scale };
}

/** Hermite smoothstep. Soft edges are the point — see maskFrom. */
export function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The soft mask: an 8-bit probability that this pixel is the teacher's ink.
 *
 * Deliberately not binary. A half-tick written lightly and a bold cross both
 * matter and the difference between them *is* the mark class — binarising here
 * throws away the one distinction the mask exists to carry. It is also what
 * rescues the faint thin strokes a lossy page encoder loses: this is computed
 * from decoded pixels, before any encode, so a stroke that will not survive
 * WebP still survives here at full strength.
 */
export function maskFrom({ plane, width, height, baseline }, tLow, tHigh) {
  const mask = new Uint8ClampedArray(width * height);
  const e0 = baseline + tLow, e1 = baseline + tHigh;
  for (let i = 0; i < plane.length; i++) {
    mask[i] = smoothstep(e0, e1, plane[i]) * 255;
  }
  return { mask, width, height };
}
