// Stage 1 · conditioning.
//
// Runs on the device, before upload, because Indian mobile data is the binding
// constraint on time-to-result far more often than server compute is. A 16-page
// booklet has to be up in under thirty seconds on mid-tier 4G; abandonment at
// capture is the most expensive drop-off in the product, because the paper is
// physically present at that moment and will not be again.
//
// Four things happen here, in this order: the page is warped back to a
// rectangle, the lighting gradient is flattened, the resolution is normalised to
// 300 DPI equivalent, and the result is compressed against a byte budget with
// the red channel — not black text legibility — as the thing being protected.

import { CONDITIONING, QUALITY } from './contract.js';
import { warpPerspective, quadSize } from './geometry.js';
import { coarsePlane } from './raster.js';
import { maskPage } from './layers.js';
import { scorePage } from './quality.js';
import { wrapImageData } from './imagedata.js';

/**
 * Flatten the lighting gradient from a phone held over a page under one
 * overhead light.
 *
 * The gradient is estimated by averaging the page down to a coarse plane, which
 * keeps the lighting and loses the writing, and every pixel is then scaled so
 * its own patch of paper reaches the brightness of the brightest paper on the
 * page. Scaling all three channels by the same factor is deliberate: it changes
 * exposure without touching hue, and hue is what stage 2 separates the layers
 * by. A per-channel normalisation would even out the very red-versus-blue
 * difference the next stage depends on.
 */
export function flattenIllumination(img) {
  const { data, width, height } = img;
  const pw = Math.max(8, Math.round(CONDITIONING.ILLUMINATION_PROXY_WIDTH));
  const ph = Math.max(8, Math.round(pw * height / width));
  const plane = coarsePlane(img, pw, ph, null);

  const lumas = new Float32Array(pw * ph);
  for (let i = 0; i < lumas.length; i++) {
    lumas[i] = (plane[i * 3] * 299 + plane[i * 3 + 1] * 587 + plane[i * 3 + 2] * 114) / 1000;
  }
  // The brightest paper on the page, not the brightest pixel — a specular
  // highlight would otherwise set the target and drag the whole page dark.
  const sorted = Float32Array.from(lumas).sort();
  const target = sorted[Math.floor(sorted.length * 0.9)] || 235;

  // The gain is resolved on the coarse grid, once per cell, and only the
  // resulting scalar is interpolated. Interpolating three channels and deriving
  // the gain per pixel gives the same answer for three times the arithmetic,
  // and this loop runs eight million times on a page.
  const gains = new Float32Array(pw * ph);
  for (let i = 0; i < gains.length; i++) {
    // Clamped, because an unbounded gain turns a genuinely dark corner into
    // amplified noise and starts inventing strokes that were never there.
    gains[i] = lumas[i] > 1 ? Math.min(2.2, Math.max(0.6, target / lumas[i])) : 1;
  }

  const out = new Uint8ClampedArray(data.length);
  const sx = pw / width, sy = ph / height;

  for (let y = 0; y < height; y++) {
    // The row's position in the gain grid is fixed across the row, so the
    // vertical half of the bilinear is hoisted out of the inner loop.
    const fy = Math.min(ph - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = fy | 0;
    const y1 = y0 + 1 < ph ? y0 + 1 : y0;
    const ty = fy - y0;
    const rowTop = y0 * pw, rowBottom = y1 * pw;
    let i = y * width * 4;

    for (let x = 0; x < width; x++, i += 4) {
      const fx = Math.min(pw - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = fx | 0;
      const x1 = x0 + 1 < pw ? x0 + 1 : x0;
      const tx = fx - x0;

      const top = gains[rowTop + x0] + (gains[rowTop + x1] - gains[rowTop + x0]) * tx;
      const bottom = gains[rowBottom + x0] + (gains[rowBottom + x1] - gains[rowBottom + x0]) * tx;
      const gain = top + (bottom - top) * ty;

      out[i] = data[i] * gain;
      out[i + 1] = data[i + 1] * gain;
      out[i + 2] = data[i + 2] * gain;
      out[i + 3] = 255;
    }
  }
  return wrapImageData(out, width, height);
}

/** Pixels needed on the long edge for 300 DPI across an A4 page. */
export function targetLongEdge() {
  return Math.round(CONDITIONING.TARGET_DPI * CONDITIONING.PAGE_LONG_EDGE_INCHES);
}

/** Effective DPI a page of this pixel size represents, assuming A4. */
export function effectiveDpi(width, height) {
  return Math.round(Math.max(width, height) / CONDITIONING.PAGE_LONG_EDGE_INCHES);
}

/**
 * How much of the red ink survived a round-trip through the encoder.
 *
 * Intersection over union of the red mask before and after. This is the measure
 * that makes "tuned to keep red-channel detail" mean something: the usual JPEG
 * quality ladder is chosen for legible black text, which is the wrong
 * optimisation target when the marks are the payload. Measured on a proxy rather
 * than the full page, because the answer does not change much with scale.
 *
 * Takes the reference mask already built rather than the image: it is the same
 * mask on every probe, and rebuilding it each time doubled the cost of the one
 * measurement in here that is not free.
 */
export function redRetention(beforeMask, after) {
  const a = beforeMask;
  const b = maskPage(after).red;
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i] || b[i]) union++;
  }
  return union === 0 ? 1 : inter / union;
}

// ── browser plumbing ───────────────────────────────────────────────────────
// Everything above is pure and runs in the harness under Node. Everything below
// needs a canvas.

function surface(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  return c;
}

function imageDataFrom(source, width, height) {
  const c = surface(width, height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function toSurface(img) {
  const c = surface(img.width, img.height);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

async function encode(canvas, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/jpeg', quality });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** A small copy of a page, for measurements that do not need every pixel. */
function proxyOf(img, longEdge = 900) {
  const scale = Math.min(1, longEdge / Math.max(img.width, img.height));
  if (scale === 1) return img;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  return imageDataFrom(toSurface(img), w, h);
}

/**
 * A downscaled copy of the source, drawn straight from the bitmap.
 *
 * One `drawImage` rather than a full-resolution `getImageData` and a manual
 * resample. It matters more than it looks: a phone photograph is twelve million
 * pixels and the target is eight, so every pass done before the downscale is
 * half as much work again as it needs to be, and the intermediate buffer alone
 * is fifty megabytes on a device that may not have it to spare.
 */
function downscaleTo(source, sw, sh, targetLong) {
  const scale = Math.min(1, targetLong / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  return imageDataFrom(source, w, h);
}

/**
 * Condition one captured or uploaded page.
 *
 * @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement} source
 * @param {{quad?:import('./geometry.js').Quad, pageNumber?:number}} options
 */
export async function conditionPage(source, { quad = null, pageNumber = 1 } = {}) {
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;
  const target = targetLongEdge();

  let img = null;
  let warped = false;

  // 1 · Perspective correction, applied on accept rather than left for later.
  // A box measured on a page that is still keystoned cannot be shown back to the
  // student as a crop, and provenance is only worth having if it is showable.
  //
  // The warp goes straight to the final resolution. Warping at the quad's own
  // size and resizing afterwards produces the same picture through two full
  // passes over eight megapixels instead of one.
  if (quad) {
    const natural = quadSize(quad);
    const longEdge = Math.max(natural.width, natural.height);
    // Never upscaled. Enlarging a page photographed too far away manufactures
    // detail, which is the one thing this pipeline exists to not do. It stays
    // small and the quality gate says so.
    const scale = Math.min(1, target / Math.max(1, longEdge));
    const out = warpPerspective(
      imageDataFrom(source, sw, sh),
      quad,
      Math.max(1, Math.round(natural.width * scale)),
      Math.max(1, Math.round(natural.height * scale)),
    );
    if (out) { img = out; warped = true; }
  }
  if (!img) img = downscaleTo(source, sw, sh, target);

  // 2 · Illumination, now on the smallest image that will ever represent this
  // page rather than on the camera's raw output.
  img = flattenIllumination(img);

  // Sharpness and glare come off a proxy — they do not need every pixel — but
  // the resolution verdict is about the page, so it is told the page's own size.
  const quality = scorePage(proxyOf(img, 1400), { longEdge: Math.max(img.width, img.height) });

  // 3 · Compression, walked down until it fits the budget and then checked once
  // for what it cost the red. A page that uploads fast and has lost the marks is
  // worth nothing, so the byte target loses that argument — but checking the
  // red on every rung meant decoding and masking the page five times over, and
  // the answer only matters for the rung actually chosen.
  const canvas = toSurface(img);
  // Retention is asked at full resolution but on one window of the page, not on
  // all of it. The question is whether the encoder eats a stroke a few pixels
  // wide, so the pixels have to be at their real scale — measuring it on a
  // downscaled proxy would be measuring a different, thinner stroke. But it does
  // not need eight megapixels to answer: one window over the busiest red on the
  // page answers it for a twentieth of the encode and a twentieth of the decode.
  const window = busiestRedWindow(img);
  const reference = maskPage(window.image).red;

  // Predict the quality rather than search for it. Encoding eight megapixels is
  // the single most expensive thing in this stage, so the number of encodes is
  // the number that matters — a binary search costs three of them every time,
  // and a rung-by-rung walk costs five on the densely marked pages that never
  // fit the budget anyway.
  //
  // JPEG size on a scanned page is close enough to linear in quality over the
  // range we use, so one encode measures the page's own slope and a second lands
  // on it. Only over-budget is corrected: under budget is not a problem worth
  // another eight-megapixel encode to fix.
  const pixels = img.width * img.height;
  const affordableBpp = (CONDITIONING.TARGET_BYTES * 8) / pixels;

  const clampQuality = (q) =>
    Math.min(CONDITIONING.QUALITY_MAX, Math.max(CONDITIONING.QUALITY_MIN, Math.round(q * 100) / 100));

  let jpegQuality = clampQuality(qualityForBitsPerPixel(affordableBpp));
  let blob = await encode(canvas, jpegQuality);
  let encodes = 1;

  while (blob.size > CONDITIONING.TARGET_BYTES && jpegQuality > CONDITIONING.QUALITY_MIN && encodes < 3) {
    const measuredBpp = (blob.size * 8) / pixels;
    // The page's own slope, from the point just measured, with a floor under the
    // step so a flat-looking page cannot stall the correction.
    const next = clampQuality(
      Math.min(jpegQuality - 0.04, jpegQuality - (measuredBpp - affordableBpp) / BPP_PER_QUALITY));
    if (next >= jpegQuality) break;
    jpegQuality = next;
    blob = await encode(canvas, jpegQuality);
    encodes++;
  }

  let chosen = { blob, quality: jpegQuality, bytes: blob.size };

  // One retention check, on the quality actually chosen. Checking every
  // candidate meant decoding and masking the page once per candidate to answer a
  // question about one of them.
  let retention = await measureRetention(window.canvas, jpegQuality, reference);
  if (retention < CONDITIONING.RED_RETENTION_MIN && chosen.quality < CONDITIONING.QUALITY_MAX) {
    // Too much of the red went. Go back up and take the larger file — the marks
    // are the payload, and a small page without them is worth nothing.
    const up = clampQuality(chosen.quality + 0.10);
    const better = await encode(canvas, up);
    chosen = { blob: better, quality: up, bytes: better.size };
    retention = await measureRetention(window.canvas, up, reference);
  }

  return {
    blob: chosen.blob,
    width: img.width,
    height: img.height,
    quality,
    meta: {
      pipeline_stage: 'conditioning',
      page_number: pageNumber,
      warped,
      source_size: { width: sw, height: sh },
      dpi: effectiveDpi(img.width, img.height),
      jpeg_quality: chosen.quality,
      bytes: chosen.bytes,
      over_budget: chosen.bytes > CONDITIONING.TARGET_BYTES,
      red_retention: Math.round(retention * 1000) / 1000,
    },
    // Handed on rather than re-decoded: stage 2 wants exactly this image, and
    // decoding the JPEG we just wrote would measure the compression, not the page.
    image: img,
  };
}

// Bits per pixel gained per point of JPEG quality, measured on a conditioned
// exam page: 0.36 bpp at quality 0.70 and 0.60 bpp at 0.86. It is a starting
// point, not a law — the loop above measures the page in front of it and
// corrects — but starting from roughly the right place is what turns three
// encodes into one.
const BPP_PER_QUALITY = 1.5;
const BPP_AT_REFERENCE = 0.36;
const QUALITY_AT_REFERENCE = 0.70;

function qualityForBitsPerPixel(bpp) {
  return QUALITY_AT_REFERENCE + (bpp - BPP_AT_REFERENCE) / BPP_PER_QUALITY;
}

async function measureRetention(windowCanvas, quality, referenceMask) {
  const blob = await encode(windowCanvas, quality);
  const decoded = await createImageBitmap(blob);
  const after = imageDataFrom(decoded, decoded.width, decoded.height);
  decoded.close?.();
  return redRetention(referenceMask, after);
}

/**
 * The window of the page carrying the most red, at full resolution.
 *
 * Found on a coarse grid so the search itself is cheap, and biased to a real
 * patch of marking rather than a stray speck. A page with no red at all — the
 * teacher marked in green, or this is the back of a sheet — gives back its
 * middle, where the answer is, which is the right place to be asking what the
 * encoder is doing anyway.
 */
function busiestRedWindow(img, size = 700) {
  const w = Math.min(size, img.width);
  const h = Math.min(size, img.height);

  // The window is *chosen* on a small proxy and *measured* at full resolution.
  // Choosing does not need the real pixels — only knowing roughly where the red
  // is — and masking eight megapixels to answer that would cost more than the
  // whole saving this window exists to make.
  const scout = proxyOf(img, 320);
  const { red, width: sw, height: sh } = maskPage(scout);
  const scale = img.width / sw;
  const stepX = Math.max(1, Math.round(w / scale));
  const stepY = Math.max(1, Math.round(h / scale));

  let bestX = Math.max(0, Math.round((img.width - w) / 2));
  let bestY = Math.max(0, Math.round((img.height - h) / 2));
  let bestCount = 0;

  for (let y0 = 0; y0 + stepY <= sh; y0 += stepY) {
    for (let x0 = 0; x0 + stepX <= sw; x0 += stepX) {
      let count = 0;
      for (let y = y0; y < y0 + stepY; y++) {
        const row = y * sw;
        for (let x = x0; x < x0 + stepX; x++) if (red[row + x]) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestX = Math.min(img.width - w, Math.round(x0 * scale));
        bestY = Math.min(img.height - h, Math.round(y0 * scale));
      }
    }
  }

  const pixels = cropPixels(img, bestX, bestY, w, h);
  const image = wrapImageData(pixels, w, h);
  const canvas = surface(w, h);
  canvas.getContext('2d').putImageData(image, 0, 0);
  return { canvas, image };
}

function cropPixels(img, x0, y0, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * img.width + x0) * 4;
    out.set(img.data.subarray(from, from + w * 4), y * w * 4);
  }
  return out;
}

export { QUALITY };
