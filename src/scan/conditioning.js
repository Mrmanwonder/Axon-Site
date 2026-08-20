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
import { coarsePlane, samplePlane } from './raster.js';
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

  const out = new Uint8ClampedArray(data.length);
  const sample = new Float32Array(3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      samplePlane(plane, pw, ph, x, y, width, height, sample);
      const local = (sample[0] * 299 + sample[1] * 587 + sample[2] * 114) / 1000;
      // Clamped, because an unbounded gain turns a genuinely dark corner into
      // amplified noise and starts inventing strokes that were never there.
      const gain = Math.min(2.2, Math.max(0.6, local > 1 ? target / local : 1));
      const i = (y * width + x) * 4;
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
 * than the full page, because it runs once per candidate quality and the answer
 * does not change much with scale.
 */
export function redRetention(before, after) {
  const a = maskPage(before).red;
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
 * Condition one captured or uploaded page.
 *
 * @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement} source
 * @param {{quad?:import('./geometry.js').Quad, pageNumber?:number}} options
 */
export async function conditionPage(source, { quad = null, pageNumber = 1 } = {}) {
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;
  let img = imageDataFrom(source, sw, sh);

  // 1 · Perspective correction, applied on accept rather than left for later.
  // A box measured on a page that is still keystoned cannot be shown back to the
  // student as a crop, and provenance is only worth having if it is showable.
  let warped = false;
  if (quad) {
    const size = quadSize(quad);
    const out = warpPerspective(img, quad, size.width, size.height);
    if (out) { img = out; warped = true; }
  }

  // 2 · Illumination.
  img = flattenIllumination(img);

  // 3 · Resolution. Never upscaled — enlarging a page that was photographed too
  // far away manufactures detail, which is the one thing this pipeline exists to
  // not do. It stays small and the quality gate says so.
  const target = targetLongEdge();
  const longEdge = Math.max(img.width, img.height);
  if (longEdge > target) {
    const scale = target / longEdge;
    img = imageDataFrom(toSurface(img), Math.round(img.width * scale), Math.round(img.height * scale));
  }

  const quality = scorePage(proxyOf(img, 1400));

  // 4 · Compression, walked down until it fits the budget and stopped the moment
  // the red starts going. A page that uploads fast and has lost the marks is
  // worth nothing, so the byte target loses that argument.
  const canvas = toSurface(img);
  const referenceProxy = proxyOf(img, 700);
  let chosen = null;
  let retention = 1;

  for (let q = CONDITIONING.QUALITY_MAX; q >= CONDITIONING.QUALITY_MIN - 1e-9; q -= 0.08) {
    const blob = await encode(canvas, Math.round(q * 100) / 100);
    const candidate = { blob, quality: Math.round(q * 100) / 100, bytes: blob.size };

    const decoded = await createImageBitmap(blob);
    const keep = redRetention(referenceProxy, proxyOf(imageDataFrom(decoded, decoded.width, decoded.height), 700));
    decoded.close?.();

    if (keep < CONDITIONING.RED_RETENTION_MIN && chosen) break; // keep the last good one
    chosen = candidate;
    retention = keep;
    if (blob.size <= CONDITIONING.TARGET_BYTES) break;
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

export { QUALITY };
