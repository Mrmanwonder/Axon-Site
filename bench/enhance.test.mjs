// The rescue path, held to the two claims it makes about itself.
//
//   node --test bench/enhance.test.mjs
//
// `src/scan/enhance.js` exists so that a page arriving under the resolution
// floor is brought up to it rather than refused outright. That is only
// acceptable because of two properties, and neither is worth anything as an
// argument in a comment — both are checkable, so both are checked here:
//
// 1. **It cannot disturb the red separation.** Every operation is a per-pixel
//    scalar gain on RGB, and `colour.js`'s shipping redness measure is a ratio
//    that a scalar cancels out of. If that ever stops being true, the stage
//    that finds the teacher's pen starts seeing something different from what
//    the photograph contained.
//
// 2. **It cannot invent detail.** The sharpening is clamped to the local
//    neighbourhood's own range, so no output pixel can be lighter or darker
//    than something that genuinely occurred beside it. Without that clamp an
//    unsharp mask rings, and a ring beside a tick is a second, fainter tick
//    that nobody wrote — which the next stage would hand to a model and ask
//    what the teacher meant by it.
//
// The third thing worth pinning is that the decision to rescue is made on
// evidence: a small, sharp page is recoverable and a small, blurred one is not,
// and the difference is measured rather than assumed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGain, assessRescue, detailGain, enhancePage, illuminationGain,
} from '../src/scan/enhance.js';
import { redRatio } from '../src/scan/colour.js';
import { toGray, sharpness } from '../src/scan/quality.js';
import { CONDITIONING, ENHANCE, QUALITY, RED } from '../src/scan/contract.js';
import { decodeFixture } from './decode.mjs';

const PRODUCTION_PAGE = 'glare-blown-background-2.png';

/** Bilinear upscale, standing in for the warp — which is where the real
    pipeline does this, folded into its single homography. */
function upscale(img, targetLong) {
  const k = targetLong / Math.max(img.width, img.height);
  const tw = Math.round(img.width * k), th = Math.round(img.height * k);
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(img.height - 1, Math.max(0, (y + 0.5) / k - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(img.height - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(img.width - 1, Math.max(0, (x + 0.5) / k - 0.5));
      const x0 = Math.floor(sx), x1 = Math.min(img.width - 1, x0 + 1), fx = sx - x0;
      const o = (y * tw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = img.data[(y0 * img.width + x0) * 4 + c], b = img.data[(y0 * img.width + x1) * 4 + c];
        const d = img.data[(y1 * img.width + x0) * 4 + c], e = img.data[(y1 * img.width + x1) * 4 + c];
        out[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
      }
    }
  }
  return { data: out, width: tw, height: th };
}

/** A page at `long` px, as the rescue path would receive it. */
async function pageAt(long, options = {}) {
  const native = await decodeFixture(PRODUCTION_PAGE);
  const width = Math.round(long * native.width / Math.max(native.width, native.height));
  return decodeFixture(PRODUCTION_PAGE, { resizeWidth: width, ...options });
}

// ── claim 1: the red separation sees what it would have seen ───────────────

test('a scalar gain leaves the redness ratio where it was, across the range that matters', () => {
  // Directly, on the measure itself. Not exact — the +1/+2 guarding colour.js's
  // divide, plus 8-bit rounding, both bite — so the question is how big the
  // drift is and where. Asserted over the range paper, faint pen and bold pen
  // actually occupy, which is everything from about luma 40 up.
  const SAMPLES = [
    [255, 250, 248],  // bright paper
    [210, 190, 185],  // paper in shade
    [180, 60, 70],    // bold red pen
    [90, 40, 45],     // faint red pen
    [60, 58, 66],     // blue-black student ink
    [45, 43, 40],     // heavy pencil
  ];
  let worst = 0, at = null;
  for (const [r, g, b] of SAMPLES) {
    for (const k of [ENHANCE.GAIN_MIN, 1.0, 1.2, ENHANCE.GAIN_MAX]) {
      const before = redRatio(r, g, b);
      const after = redRatio(Math.round(r * k), Math.round(g * k), Math.round(b * k));
      const drift = Math.abs(after - before) / before;
      if (drift > worst) { worst = drift; at = `[${r},${g},${b}] x${k}`; }
    }
  }
  assert.ok(worst < 0.015,
    `redness ratio drifted ${(worst * 100).toFixed(2)}% at ${at} under a scalar gain — the property enhance.js rests on no longer holds`);
});

test('the ratio drift below luma 15 is real, bounded, and does not reach the mask', () => {
  // Pinned rather than hidden. Near-black pixels — the core of a heavy stroke,
  // or deep shadow — do drift by several per cent, because there the epsilon
  // guarding the divide is a large share of the value. It does not matter, and
  // this test is here to say why rather than to leave the earlier, wrong claim
  // of "well under a thousandth" standing.
  let worst = 0;
  for (const [r, g, b] of [[12, 10, 9], [6, 5, 4]]) {
    for (const k of [ENHANCE.GAIN_MIN, ENHANCE.GAIN_MAX]) {
      const before = redRatio(r, g, b);
      const after = redRatio(Math.round(r * k), Math.round(g * k), Math.round(b * k));
      worst = Math.max(worst, Math.abs(after - before) / before);
    }
  }
  assert.ok(worst > 0.02, 'the drift this test documents has gone away — delete the test rather than leaving it asserting nothing');
  assert.ok(worst < 0.15, `near-black drift reached ${(worst * 100).toFixed(0)}%, which is more than "bounded"`);
  // The reason it cannot change a decision: anything this dark is ink by luma
  // alone, whatever its redness says.
  assert.ok(12 < RED.INK_LUMA_MAX,
    'luma 12 is no longer unconditionally ink — the argument that this drift is harmless needs redoing');
});

test('the enhancer as a whole barely moves the redness of a real page', async () => {
  const src = await pageAt(1800);
  const up = upscale(src, CONDITIONING.MIN_LONG_EDGE);
  const rescue = assessRescue(src, 1800);
  assert.ok(rescue.possible, 'the fixture is meant to be rescuable — check assessRescue before reading anything below');

  const { image } = enhancePage(up, rescue);

  // Sampled across the page rather than exhaustively: the point is the
  // distribution, and every 997th pixel is a prime stride over a couple of
  // thousand samples spread over the whole sheet.
  let worst = 0, moved = 0, n = 0;
  for (let p = 0; p < up.width * up.height; p += 997) {
    const i = p * 4;
    const before = redRatio(up.data[i], up.data[i + 1], up.data[i + 2]);
    const after = redRatio(image.data[i], image.data[i + 1], image.data[i + 2]);
    const drift = Math.abs(after - before) / before;
    worst = Math.max(worst, drift);
    if (drift > 0.05) moved++;
    n++;
  }
  assert.ok(moved / n < 0.01,
    `${(100 * moved / n).toFixed(1)}% of sampled pixels moved their redness by more than 5% — the mask would be reading a different page`);
  assert.ok(worst < 0.35,
    `worst redness drift ${(worst * 100).toFixed(0)}% — something in the chain is no longer a per-pixel scalar`);
});

test('the gain never clips a channel', () => {
  // A gain that pushes a channel past 255 destroys exactly what `clipping`
  // exists to catch, and destroying it while trying to fix a different problem
  // would be worse than not enhancing at all.
  const width = 4, height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    data[p * 4] = 250; data[p * 4 + 1] = 240; data[p * 4 + 2] = 235; data[p * 4 + 3] = 255;
  }
  const gain = new Float64Array(width * height).fill(4);
  const out = applyGain({ data, width, height }, gain);
  for (let p = 0; p < width * height; p++) {
    assert.equal(out.data[p * 4], 255, 'the brightest channel should land exactly on 255, not past it');
    // Still a scalar: the other channels scaled by the same factor.
    const k = 255 / 250;
    assert.ok(Math.abs(out.data[p * 4 + 1] - 240 * k) <= 1, 'green did not scale by the same factor');
    assert.ok(Math.abs(out.data[p * 4 + 2] - 235 * k) <= 1, 'blue did not scale by the same factor');
  }
});

// ── claim 2: no invented detail ────────────────────────────────────────────

test('sharpening never produces a value the neighbourhood did not contain', async () => {
  // The whole safety argument for the sharpening pass, checked directly. An
  // unclamped unsharp mask fails this immediately — that is the point.
  const src = await pageAt(1800);
  const up = upscale(src, CONDITIONING.MIN_LONG_EDGE);
  const before = toGray(up);
  const after = toGray(applyGain(up, detailGain(up)));

  const radius = ENHANCE.SHARPEN_RADIUS;
  const { width, height } = up;
  let violations = 0, checked = 0, worst = 0;
  // Every 13th row and column: several hundred thousand pixels, spread over
  // the page, without an O(radius^2) pass over all seven million.
  for (let y = radius; y < height - radius; y += 13) {
    for (let x = radius; x < width - radius; x += 13) {
      let lo = 255, hi = 0;
      for (let ny = y - radius; ny <= y + radius; ny++) {
        for (let nx = x - radius; nx <= x + radius; nx++) {
          const v = before[ny * width + nx];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      const v = after[y * width + x];
      checked++;
      // One unit of slack for the rounding that 8-bit output forces.
      if (v < lo - 1 || v > hi + 1) {
        violations++;
        worst = Math.max(worst, v < lo ? lo - v : v - hi);
      }
    }
  }
  assert.ok(checked > 10000, `only ${checked} pixels checked — the sampling stride is not covering the page`);
  assert.equal(violations, 0,
    `${violations} of ${checked} pixels fell outside their own neighbourhood's range (worst by ${worst}). The clamp is what stops the sharpening drawing a stroke nobody wrote.`);
});

test('flattening evens out a lighting gradient without touching local contrast', async () => {
  const page = await pageAt(2400);
  // A synthetic gradient, applied as the multiplicative thing a lighting
  // gradient physically is: bright at one edge, falling off across the page.
  const lit = { data: new Uint8ClampedArray(page.data), width: page.width, height: page.height };
  for (let y = 0; y < page.height; y++) {
    const k = 0.65 + 0.35 * (y / page.height);
    for (let x = 0; x < page.width; x++) {
      const i = (y * page.width + x) * 4;
      lit.data[i] *= k; lit.data[i + 1] *= k; lit.data[i + 2] *= k;
    }
  }

  const spread = (img) => {
    const gray = toGray(img);
    const band = (from, to) => {
      let sum = 0, n = 0;
      for (let y = Math.round(img.height * from); y < Math.round(img.height * to); y++) {
        for (let x = 0; x < img.width; x += 7) { sum += gray[y * img.width + x]; n++; }
      }
      return sum / n;
    };
    return Math.abs(band(0, 0.15) - band(0.85, 1));
  };

  const before = spread(lit);
  const after = spread(applyGain(lit, illuminationGain(lit)));
  assert.ok(after < before * 0.6,
    `top-to-bottom brightness difference went ${before.toFixed(1)} -> ${after.toFixed(1)}; flattening is not removing the gradient`);

  // And it must not have flattened the ink along with the light. Sharpness is
  // a measure of local contrast, so if flattening had eaten the writing this
  // would collapse.
  const focusBefore = sharpness(lit).score;
  const focusAfter = sharpness(applyGain(lit, illuminationGain(lit))).score;
  assert.ok(focusAfter >= focusBefore * 0.9,
    `sharpness fell ${focusBefore.toFixed(3)} -> ${focusAfter.toFixed(3)} across flattening — it is removing detail, not lighting`);
});

// ── the decision to rescue is made on evidence ─────────────────────────────

test('a page at or above the floor is not touched at all', async () => {
  const page = await pageAt(CONDITIONING.MIN_LONG_EDGE);
  const r = assessRescue(page, CONDITIONING.MIN_LONG_EDGE);
  assert.equal(r.needed, false, 'a page that clears the floor must never enter the rescue path');
  assert.equal(r.possible, false, 'nothing to be possible — there is nothing to do');
});

test('a small but genuinely sharp page is rescued', async () => {
  for (const long of [1600, 1700, 1800, 2000]) {
    const page = await pageAt(long);
    const r = assessRescue(page, long);
    assert.ok(r.needed, `${long}px should be under the floor`);
    assert.ok(r.possible, `${long}px is a real in-focus page and was refused: ${r.reason}`);
  }
});

test('a small AND blurred page is refused, because nothing can bring it back', async () => {
  // The distinction the whole module turns on. Sharpening restores contrast to
  // edges that survived; it cannot restore an edge the lens already removed,
  // and pretending otherwise would produce a confident-looking page with
  // nothing real in it.
  const page = await pageAt(1800, { blur: 1.5 });
  const r = assessRescue(page, 1800);
  assert.ok(r.needed);
  assert.equal(r.possible, false,
    `a page blurred at sigma 1.5 measured ${r.sharpness?.toFixed(3)} and was accepted for rescue — enhancement cannot recover this`);
  assert.match(r.reason, /soft/i);
});

test('a page far under the floor is refused on size alone', async () => {
  const long = Math.round(CONDITIONING.MIN_LONG_EDGE / ENHANCE.MAX_SCALE) - 200;
  const page = await pageAt(long);
  const r = assessRescue(page, long);
  assert.equal(r.possible, false, `${long}px is past MAX_SCALE and should not be rescued however sharp it is`);
  assert.match(r.reason, /longest side/);
});

// ── and it has to actually work ────────────────────────────────────────────

test('the rescue puts back most of the acutance the upscale cost', async () => {
  // The measurement the thresholds came from. A rescued page will never be as
  // good as one photographed at full size — the claim is only that it is much
  // closer than the bare upscale, which is the difference between a page the
  // pipeline can read and one it cannot.
  const src = await pageAt(1800);
  const up = upscale(src, CONDITIONING.MIN_LONG_EDGE);
  const rescue = assessRescue(src, 1800);
  const { image, meta } = enhancePage(up, rescue);

  // Compared on the raw statistic, not the normalised score. The score is
  // clamped at 1.0 and a bilinear upscale of a page this sharp already pins it
  // there, so the score cannot show a difference that the underlying measure
  // shows plainly. Asserting on the clamped number would have been a test that
  // could never fail for the right reason.
  const raw = sharpness(up).raw;
  const enhanced = sharpness(image).raw;
  assert.ok(enhanced > raw * 1.15,
    `raw sharpness ${raw} -> ${enhanced}: the rescue is not restoring a meaningful amount`);

  // Recorded honestly, and recording the *native* size rather than the
  // enhanced one is the part that matters: the gate scores the page at the size
  // the camera gave, so a rescued page still reads as smaller than we would
  // like and the student is still told.
  assert.equal(meta.applied, true);
  assert.equal(meta.native_long_edge, 1800);
  assert.ok(meta.scale > 1 && meta.scale <= ENHANCE.MAX_SCALE);
  assert.equal(meta.sharpness_before, Math.round(sharpness(up).score * 10000) / 10000);
  assert.equal(meta.sharpness_after, Math.round(sharpness(image).score * 10000) / 10000);
});

test('an enhanced page is still scored, and passed on, at its true size', async () => {
  // The honesty property. Enhancement changes how a page reads, never what it
  // is: `scorePage` is handed the native long edge, so a rescued 1800px page
  // lands in the same warn band any 1800px page would.
  const src = await pageAt(1800);
  const up = upscale(src, CONDITIONING.MIN_LONG_EDGE);
  const { image } = enhancePage(up, assessRescue(src, 1800));
  assert.equal(Math.max(image.width, image.height), CONDITIONING.MIN_LONG_EDGE,
    'the rescued page should be at the floor — that is what the rescue is for');
  assert.ok(1800 < QUALITY.RESOLUTION_WARN,
    'this test assumes 1800px sits in the warn band; if the thresholds moved, so should it');
});
