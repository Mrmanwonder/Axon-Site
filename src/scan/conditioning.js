// Stage 1 · conditioning.
//
// Rewritten per IMAGE_PIPELINE.md §5. The principle it turns on is one line:
// **correct the camera, not the page.** Preprocessing may change geometry and
// encoding. It may not change tone.
//
// What that removes is most of what used to be here. No illumination flattening,
// no contrast work, no sharpening, no denoise, and above all no grayscale or
// binarisation — every one of those is standard advice for a classical OCR
// engine reading printed black text, and every one of them destroys signal a
// vision model would have used. A scanner-ified page is out of distribution for
// a model trained on photographs in a way a plain photo is not.
//
// What is left is a single geometric operation and a single encode. The old
// build also walked JPEG quality downward while measuring how much red survived,
// which was fighting a problem the format was creating; that search is gone and
// the mask carries the fine detail instead. See bench/README.md for why.

import { CONDITIONING } from './contract.js';
import { warpPerspective, quadSize } from './geometry.js';
import { separateLayers } from './layers.js';
import { scorePage } from './quality.js';

/** Pixels on the long edge a page of this size represents, capped and never grown. */
export function targetSize(width, height, longEdge = CONDITIONING.PAGE_LONG_EDGE) {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// ── browser plumbing ───────────────────────────────────────────────────────

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

async function encode(canvas, type, quality) {
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type, quality })
    : await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  // A browser that cannot write the type asked for silently writes PNG instead,
  // which for a photograph is several megabytes of losslessly-encoded sensor
  // noise. Checking the type it actually produced is how that gets caught.
  return blob && blob.type === type ? blob : null;
}

/**
 * One encode, in the best format this browser actually has.
 *
 * WebP at q92 is roughly a third smaller than JPEG at the same visual quality,
 * which matters on Indian mobile data. Neither can be told to write 4:4:4 from a
 * canvas — measured, see bench/README.md — so this is a size decision, not a
 * fidelity one, and the fidelity that matters travels in the mask.
 */
async function encodeBest(canvas, quality = CONDITIONING.ENCODE_QUALITY) {
  for (const type of CONDITIONING.ENCODE_TYPES) {
    const blob = await encode(canvas, type, quality);
    if (blob) return { blob, type };
  }
  // Last resort: whatever the browser gives back rather than nothing at all.
  const blob = await new Promise((r) => toBlobAny(canvas, r));
  return { blob, type: blob?.type ?? 'unknown' };
}

function toBlobAny(canvas, cb) {
  if (canvas.convertToBlob) canvas.convertToBlob().then(cb, () => cb(null));
  else canvas.toBlob(cb);
}

/** The soft mask as a PNG. Lossless on purpose — it is the fine detail. */
async function encodeMask({ data, width, height }) {
  const c = surface(width, height);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(width, height);
  for (let p = 0, i = 0; p < data.length; p++, i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = data[p];
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return encode(c, 'image/png');
}

/**
 * Condition one captured or uploaded page.
 *
 * @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement} source
 * @param {{quad?:Array, pageNumber?:number, capturePath?:string, liveGate?:Object}} options
 */
export async function conditionPage(source, { quad = null, pageNumber = 1, capturePath = null, liveGate = null } = {}) {
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;

  // ── the one geometric operation ──────────────────────────────────────────
  // Perspective correction and the scale to target are composed into a single
  // homography and applied once. Warping and then resizing is two interpolations
  // and each one is a low-pass filter; thin strokes are high-frequency detail,
  // and they do not survive being filtered twice.

  let img;
  let warped = false;

  if (quad) {
    const natural = quadSize(quad);
    const target = targetSize(natural.width, natural.height);
    const source_ = imageDataFrom(source, sw, sh);
    const out = warpPerspective(source_, quad, target.width, target.height);
    if (out) { img = out; warped = true; } else { img = source_; }
  } else {
    // No quad — an upload, or a native document scanner that already returned a
    // corrected page. §5.1 is explicit that a corrected page must not be
    // corrected again: it has had one good resample and a second is pure loss.
    const target = targetSize(sw, sh);
    img = (target.width === sw && target.height === sh)
      ? imageDataFrom(source, sw, sh)
      : imageDataFrom(await resample(source, target), target.width, target.height);
  }

  // ── nothing touches tone ─────────────────────────────────────────────────

  const quality = scorePage(img);
  const layers = separateLayers(img);

  const { blob, type } = await encodeBest(toSurface(img));
  const maskBlob = await encodeMask(layers.mask);

  return {
    blob,
    maskBlob,
    width: img.width,
    height: img.height,
    quality,
    layers,
    meta: {
      preprocess_version: CONDITIONING.PREPROCESS_VERSION,
      page_number: pageNumber,
      warped,
      source_size: { width: sw, height: sh },
      encoded_type: type,
      encode_quality: CONDITIONING.ENCODE_QUALITY,
      bytes: blob?.size ?? 0,
      mask_bytes: maskBlob?.size ?? 0,
      mask_channel: layers.coverage.mask_channel,
      // EXIF is not carried through a canvas re-encode, so location data cannot
      // survive this step even by accident. Capture time and device belong in
      // the database, not in the file.
      exif_stripped: true,
      // 'image-capture' (a real sensor-resolution still) or 'canvas-grab' (a
      // frame off the live video element), or null for an upload that never
      // went through capture.js at all. Carried through so production data can
      // show, per path, whether the live gate's read agrees with this page's
      // final score — see quality.live_gate below.
      capture_path: capturePath,
      // The live gate's own read of this exact frame, at the moment the
      // shutter fired — for comparing against `quality` above, which is scored
      // on the conditioned image. The two are computed at different scales on
      // purpose; logging both side by side is how that gap gets measured
      // instead of assumed.
      live_gate: liveGate ? {
        sharpness: liveGate.sharpness,
        glare: liveGate.glare,
        fill: liveGate.fill,
        page_long_edge: liveGate.pageLongEdge,
        skew: liveGate.skew,
        steady: liveGate.steady,
        blocking: liveGate.blocking,
      } : null,
    },
    // Handed on rather than re-decoded: stage 2 has already read exactly this,
    // and decoding the file we just wrote would measure the encoder.
    image: img,
  };
}

/** One high-quality resample, done by the browser's own resampler. */
async function resample(source, target) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(source, {
        resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'high',
      });
    } catch { /* fall through to the canvas path */ }
  }
  return source;
}
