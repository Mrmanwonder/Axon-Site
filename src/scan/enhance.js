// Stage 1.5 · rescue, for a page that arrives under the resolution floor.
//
// ── why this exists ────────────────────────────────────────────────────────
//
// The floor (CONDITIONING.MIN_LONG_EDGE) is real: below it a question crop
// carries too few pixels per pen stroke for the marking to be read reliably.
// But refusing a page outright is the harshest thing this product can do to
// someone — the paper may not be in front of them any more, and "your photo is
// too small" with no way forward is, for a student who has already been through
// a chat app's recompression, simply the end of the road.
//
// So the floor stops being a refusal and becomes a decision: can this page be
// brought up to the floor honestly? Sometimes yes. A 1700px photo that is
// genuinely *in focus* has been low-pass filtered, not destroyed — the strokes
// are all still there, just soft and small. That is a recoverable condition.
// A 1700px photo that is also blurred has nothing left to recover, and no
// amount of processing changes that. This module does the first and refuses the
// second, and records which it did.
//
// ── the rule everything here obeys ─────────────────────────────────────────
//
// **Every operation is a per-pixel scalar gain on RGB.**
//
// That is not a stylistic choice, it is what makes this safe to put in front of
// the layer separation. `colour.js`'s shipping redness measure is
// `redRatio = (r+1)/(g+b+2)`, and its own comment states the property this
// depends on: "brightening a patch multiplies all three channels and cancels out
// of the ratio." So as long as a pixel's three channels are multiplied by the
// same number, the mask that finds the teacher's pen sees exactly what it would
// have seen.
//
// Not *exactly*, and it is worth being precise about where it stops being
// exact, because the first draft of this comment claimed a thousandth and the
// test disagreed. The +1/+2 that guard colour.js's divide, plus 8-bit rounding,
// hold the drift under 1% everywhere from about luma 40 upward — which is the
// whole range paper, faint pen and bold pen actually occupy. Below luma 15 the
// epsilon starts to dominate and the drift reaches several per cent. Those
// pixels are the near-black core of a heavy stroke or a deep shadow, and
// `RED.INK_LUMA_MAX` (165) already counts them as ink whatever the ratio says,
// so nothing downstream turns on it. bench/enhance.test.mjs measures both
// bands rather than asserting the convenient one.
//
// A multiplicative gain in sRGB byte space is also the physically right shape
// for the two things being corrected. sRGB is close to a pure power curve, so a
// lighting change that is multiplicative in linear light —
// `(k·x)^(1/2.2) = k^(1/2.2) · x^(1/2.2)` — is multiplicative in sRGB too. And
// sharpening applied as a luma gain leaves hue and saturation alone by
// construction, where sharpening each channel independently would pull the
// channels apart at exactly the high-contrast edges a pen stroke is made of.
//
// So: flattening produces a gain field, sharpening produces a gain field, and
// `applyGain` is the only thing that ever writes a pixel.
//
// ── and the rule about inventing detail ────────────────────────────────────
//
// Nothing here may put structure on the page that was not in the photograph.
// A model reading an invented stroke would produce a confident, sourced-looking
// misreading of a teacher's mark, which is the one failure this product cannot
// have (CLAUDE.md rules 1 and 4).
//
// Upscaling does not invent — it resamples what is there. Sharpening can, if it
// overshoots: an unsharp mask left unclamped rings, and a ring beside a stroke
// is a second, fainter stroke that nobody wrote. So the sharpening gain is
// clamped per pixel to the local minimum and maximum of the *source*
// neighbourhood. The output at any pixel is bounded by values that genuinely
// occurred next to it. No new extrema, no halo, no invented ink — and it is an
// invariant a test can check directly, which bench/enhance.test.mjs does.

import { CONDITIONING, ENHANCE, QUALITY } from './contract.js';
import { sharpness, toGray } from './quality.js';

/**
 * Can this source be brought up to the floor, and should it be?
 *
 * Three answers, not two:
 *
 * · `{ needed: false }` — already at or above the floor. Nothing to do, and
 *   nothing is done: a page that clears the floor is never touched by this
 *   module at all. Enhancement is a rescue, not a pipeline stage everything
 *   passes through.
 * · `{ needed: true, possible: true, ... }` — under the floor and recoverable.
 * · `{ needed: true, possible: false, reason }` — under the floor and not
 *   recoverable, with the reason written for the student.
 *
 * Measured on the *source*, before any warp or resample, and told how big the
 * page is inside it. That is the only place the question can be answered
 * honestly: a page measured after being upscaled reads soft because it was
 * upscaled, so assessing there would refuse every page for the consequence of
 * the operation being assessed. `pageLongEdge` is the page's long edge in the
 * source's own pixels — the warped size, not the frame's — which is what makes
 * this the same number `scorePage` will report.
 *
 * @param {{data:Uint8ClampedArray,width:number,height:number}} img the source frame
 * @param {number} pageLongEdge the page's long edge, in that frame's pixels
 */
export function assessRescue(img, pageLongEdge = Math.max(img.width, img.height)) {
  const longEdge = Math.round(pageLongEdge);
  const floor = CONDITIONING.MIN_LONG_EDGE;
  if (longEdge >= floor) return { needed: false, possible: false, longEdge, scale: 1 };

  const scale = floor / longEdge;

  // Too far under. Past this the upscale is doing more inventing than
  // resampling: at 3x, eight of every nine output pixels are interpolated, and
  // a pen stroke a pixel and a half wide in the source does not survive being
  // asked to be four and a half pixels wide.
  if (scale > ENHANCE.MAX_SCALE) {
    return {
      needed: true, possible: false, longEdge, scale,
      reason: `This image is ${longEdge}px on its longest side. We need about ${Math.round(floor / ENHANCE.MAX_SCALE)}px to work with, and there is not enough detail here to make up the difference honestly. A photo straight from the camera roll usually clears that; one that has been through a chat app usually does not.`,
    };
  }

  // Soft *and* small is the case nothing can fix. Sharpening restores contrast
  // to edges that are still present; it cannot restore an edge that the lens or
  // the shake already removed. Measured at the page's own scale rather than the
  // frame's — the two differ whenever the page fills only part of the shot —
  // which makes this the same number the quality gate reports, and is the whole
  // reason that measure was made scale-invariant (quality.js).
  const focus = sharpness(img, { scale: QUALITY.MEASURE_LONG_EDGE / longEdge });
  if (!focus.blank && focus.score < ENHANCE.MIN_SOURCE_SHARPNESS) {
    return {
      needed: true, possible: false, longEdge, scale, sharpness: focus.score,
      reason: 'This photo is both small and soft, so there is no fine detail left in it to bring back. Take it again from a little closer, holding the phone still.',
    };
  }

  return { needed: true, possible: true, longEdge, scale, sharpness: focus.score };
}

// ── the one thing that writes a pixel ──────────────────────────────────────

/**
 * Multiply every pixel by its own gain, and never clip.
 *
 * The clamp is not cosmetic. A gain that pushes a channel past 255 destroys the
 * distinction between "bright paper" and "brighter paper", and on a red stroke
 * it destroys the red — which is the exact failure `clipping` exists to catch
 * and which this module must not cause while trying to fix a different one. So
 * a gain that would clip any channel is scaled back for that pixel until the
 * brightest channel lands exactly on 255. It stays a scalar, so the ratio the
 * mask reads is still preserved.
 */
export function applyGain(img, gain) {
  const { data, width, height } = img;
  const out = new Uint8ClampedArray(data.length);
  for (let p = 0, i = 0; p < width * height; p++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let k = gain[p];
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    if (max > 0 && k * max > 255) k = 255 / max;
    out[i] = r * k;
    out[i + 1] = g * k;
    out[i + 2] = b * k;
    out[i + 3] = data[i + 3];
  }
  return { data: out, width, height };
}

// ── illumination flattening ────────────────────────────────────────────────

/**
 * Separable box blur of a plane, repeated to approximate a Gaussian.
 *
 * Three box passes is the standard cheap Gaussian and it is more than enough
 * for an illumination field, which is by definition the part of the image with
 * no detail in it. Running at a decimated scale (see `illuminationGain`) is what
 * keeps a radius of a few hundred page pixels affordable on a phone.
 */
function boxBlur(plane, width, height, radius, passes = 3) {
  let src = plane;
  let dst = new Float64Array(plane.length);
  for (let pass = 0; pass < passes; pass++) {
    blurAxis(src, dst, width, height, radius, true);
    blurAxis(dst, src === plane ? (src = new Float64Array(plane.length)) : src, height, width, radius, false);
    const swap = dst; dst = src; src = swap;
  }
  return src;
}

function blurAxis(src, dst, major, minor, radius, horizontal) {
  const width = horizontal ? major : minor;
  for (let line = 0; line < (horizontal ? minor : major); line++) {
    const at = horizontal
      ? (i) => line * width + i
      : (i) => i * width + line;
    const length = horizontal ? major : minor;
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += src[at(Math.min(length - 1, Math.max(0, i)))];
    const norm = 1 / (2 * radius + 1);
    for (let i = 0; i < length; i++) {
      dst[at(i)] = sum * norm;
      const drop = at(Math.min(length - 1, Math.max(0, i - radius)));
      const add = at(Math.min(length - 1, Math.max(0, i + radius + 1)));
      sum += src[add] - src[drop];
    }
  }
}

/**
 * The gain field that evens out the lighting across a page.
 *
 * AXON_FIX_BRIEF.md §7.6.1 asks for exactly this and rules out the alternative
 * in the same breath: "Illumination flattening, never binarization." The two are
 * often conflated and they could not be less alike. Binarisation decides, per
 * pixel, whether something is ink — and having decided, throws away the soft
 * half-tick that `layers.js` needs in order to tell a half-tick from a cross.
 * Flattening decides nothing. It removes the lighting gradient and leaves every
 * local relationship exactly as it was.
 *
 * It matters most for the thing this whole app rests on. `colour.js` measures
 * redness *relative to the page's own paper*, and estimates that baseline once
 * for the whole sheet. On a page with a lighting gradient there is no single
 * paper level, so one end of the sheet is compared against the other end's
 * paper. Flattening gives the baseline something true to be.
 *
 * The field is estimated at a decimated scale — an illumination gradient has no
 * high frequencies by definition, so measuring it at full resolution is paying
 * for detail that is then blurred away.
 */
export function illuminationGain(img) {
  const { width, height } = img;
  const gray = toGray(img);

  const step = Math.max(1, Math.round(Math.max(width, height) / ENHANCE.FIELD_LONG_EDGE));
  const fw = Math.max(1, Math.ceil(width / step));
  const fh = Math.max(1, Math.ceil(height / step));

  const small = new Float64Array(fw * fh);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const sy = Math.min(height - 1, y * step);
      const sx = Math.min(width - 1, x * step);
      small[y * fw + x] = gray[sy * width + sx];
    }
  }

  const radius = Math.max(2, Math.round(ENHANCE.FIELD_RADIUS_SHARE * Math.max(fw, fh)));
  const field = boxBlur(small, fw, fh, radius);

  // The reference is a high percentile of the field, not its maximum: one
  // stray bright cell would otherwise set the target for the whole page and
  // every gain would be pinned against the no-clip clamp.
  const sorted = Array.from(field).sort((a, b) => a - b);
  const reference = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ENHANCE.FIELD_REFERENCE))];

  const gain = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = Math.min(fh - 1, Math.floor(y / step));
    for (let x = 0; x < width; x++) {
      const fx = Math.min(fw - 1, Math.floor(x / step));
      const local = field[fy * fw + fx];
      // Clamped both ways. A very dark corner is a shadow, not an
      // under-exposure to be undone by a factor of four — pushing it that far
      // amplifies the sensor noise in it into something that reads as texture.
      const k = local > 1 ? reference / local : 1;
      gain[y * width + x] = Math.min(ENHANCE.GAIN_MAX, Math.max(ENHANCE.GAIN_MIN, k));
    }
  }
  return gain;
}

// ── detail restoration ─────────────────────────────────────────────────────

/**
 * The gain field that puts the acutance back after an upscale.
 *
 * A plain unsharp mask, with the one addition that makes it safe here: the
 * result is clamped, per pixel, to the minimum and maximum luma of that pixel's
 * own neighbourhood. That single clamp is what separates "restoring contrast
 * that the resample softened" from "drawing a stroke that nobody wrote".
 *
 * Unclamped, an unsharp mask overshoots on both sides of a hard edge — a dark
 * undershoot just outside a pen stroke and a bright overshoot just inside it.
 * On a photograph that reads as crispness. On an exam page it reads as a
 * hairline second stroke beside the teacher's tick, and the stage that comes
 * next is a model being asked what the teacher wrote.
 *
 * With the clamp, the output at every pixel is a value that genuinely occurred
 * within RADIUS pixels of it. Structure can be made more distinct. It cannot be
 * added. bench/enhance.test.mjs asserts this directly rather than trusting the
 * argument.
 */
export function detailGain(img, amount = ENHANCE.SHARPEN_AMOUNT, radius = ENHANCE.SHARPEN_RADIUS) {
  const { width, height } = img;
  const gray = toGray(img);
  const luma = Float64Array.from(gray);
  const blurred = boxBlur(Float64Array.from(gray), width, height, radius, 2);

  const gain = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const value = luma[p];
      const sharpened = value + amount * (value - blurred[p]);

      // The neighbourhood's own range, which is the ceiling and floor on what
      // this pixel is allowed to become.
      let lo = 255, hi = 0;
      const y0 = Math.max(0, y - radius), y1 = Math.min(height - 1, y + radius);
      const x0 = Math.max(0, x - radius), x1 = Math.min(width - 1, x + radius);
      for (let ny = y0; ny <= y1; ny++) {
        const row = ny * width;
        for (let nx = x0; nx <= x1; nx++) {
          const v = luma[row + nx];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }

      const clamped = sharpened < lo ? lo : sharpened > hi ? hi : sharpened;
      gain[p] = value > 1 ? clamped / value : 1;
    }
  }
  return gain;
}

/**
 * The neighbourhood clamp above is O(radius²) per pixel, which on a 2400px page
 * at radius 2 is 25 reads per pixel — affordable, and this only ever runs on a
 * page that needed rescuing. It is written plainly rather than as a sliding
 * min/max because the correctness of the clamp is the entire safety argument
 * for this file, and a clever implementation of it would be the wrong thing to
 * have to re-derive later.
 */

/** Compose two gain fields. Still a scalar per pixel, so still ratio-safe. */
function combine(a, b) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * b[i];
  return out;
}

/**
 * Bring a page up to the floor, or say why it cannot be.
 *
 * The upscale itself is not done here — it is folded into the single geometric
 * operation `conditionPage` already performs, so the page is resampled once
 * rather than warped and then enlarged. This is what runs on the result:
 * flatten the lighting, restore the acutance the resample cost, and report
 * honestly what was done and what it achieved.
 *
 * @param {{data:Uint8ClampedArray,width:number,height:number}} img the upscaled page
 * @param {{scale:number, longEdge:number, sharpness?:number}} rescue from `assessRescue`
 */
export function enhancePage(img, rescue) {
  const before = sharpness(img);

  const light = illuminationGain(img);
  const flattened = applyGain(img, light);

  const detail = detailGain(flattened);
  const out = applyGain(flattened, detail);

  const after = sharpness(out);

  return {
    image: out,
    meta: {
      applied: true,
      // The size the student's photograph actually was. This is what the
      // quality gate scores and what `quality_signals.long_edge` reports:
      // enhancement changes how the page reads, never what it is, and a page
      // that says 2400px when the camera gave 1800px would be the pipeline
      // lying to its own telemetry.
      native_long_edge: rescue.longEdge,
      scale: Math.round(rescue.scale * 1000) / 1000,
      flattened: true,
      sharpen_amount: ENHANCE.SHARPEN_AMOUNT,
      sharpen_radius: ENHANCE.SHARPEN_RADIUS,
      // Both measured, because "we enhanced it" is not a claim anyone should
      // take on trust — including us, later, reading production data to find
      // out whether this was worth doing.
      //
      // The raw statistic travels alongside the normalised score because the
      // score is clamped at 1.0, and a bare upscale of a genuinely sharp page
      // already pins it there — so on exactly the pages this stage handles
      // best, the two scores would both read 1.0 and the telemetry would say
      // the rescue did nothing. The raw numbers show what actually moved.
      sharpness_before: Math.round(before.score * 10000) / 10000,
      sharpness_after: Math.round(after.score * 10000) / 10000,
      sharpness_raw_before: before.raw,
      sharpness_raw_after: after.raw,
    },
  };
}

/** What the student is told about a page that was rescued. Not an apology and
    not a boast: a fact and the one thing it changes about what they should do. */
export const RESCUED_NOTICE =
  'This photo was smaller than we would like, so we have sharpened it as far as we honestly can. Worth a closer look at the marks on this page when you check them.';
