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

import { CONDITIONING, ENHANCE } from './contract.js';
import { warpPerspective, quadSize } from './geometry.js';
import { gpuWarpAvailable, warpOnGPU } from './gpu.js';
import { separateLayers } from './layers.js';
import { assessRescue, enhancePage, flattenPage } from './enhance.js';
import { reconcileWithInk, scorePage } from './quality.js';

/**
 * Pixels on the long edge a page of this size represents.
 *
 * Capped and never grown, unless a caller explicitly asks — and the only caller
 * that does is the rescue path, which has already established on evidence that
 * this particular page can be enlarged honestly (enhance.js). Left to itself
 * this must never upscale: inventing pixels does not add detail, it just moves
 * the failure downstream to a model that then reads invented detail as though
 * it were a teacher's pen.
 */
export function targetSize(width, height, longEdge = CONDITIONING.PAGE_LONG_EDGE, allowUpscale = false) {
  const ratio = longEdge / Math.max(width, height);
  const scale = allowUpscale ? ratio : Math.min(1, ratio);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * The long edge this source will actually produce, before the cap is applied.
 *
 * With a quad it is the warped page's own long edge, which is what the page
 * will be — not the frame's. A 4032px still of a page held at arm's length
 * produces a page a good deal smaller than 4032, and the difference is exactly
 * the case the floor exists to catch.
 */
export function projectedLongEdge(sourceWidth, sourceHeight, quad = null) {
  if (quad) {
    const natural = quadSize(quad);
    return Math.round(Math.max(natural.width, natural.height));
  }
  return Math.max(sourceWidth, sourceHeight);
}

/**
 * Why this page cannot be used at all, decided from its size alone, or null.
 *
 * The cheap half of the floor. It runs before anything is decoded or warped, so
 * it can only answer the question size alone can answer: is this so far under
 * the floor that no amount of honest processing reaches it?
 *
 * The line is `MIN_LONG_EDGE / ENHANCE.MAX_SCALE` — 1600px against a 2400px
 * floor — and everything between there and the floor goes to `enhance.js`,
 * which decides on evidence rather than on dimensions. That is the difference
 * between this and the version it replaces: a page under the floor used to be
 * refused outright, and a student whose photo had been through a chat app had
 * nowhere to go. Now most of them are rescued, some are still refused, and the
 * ones that are refused are refused because the detail genuinely is not there,
 * not because a number was too small.
 *
 * Worded as a fact and an action, never as a question. The consequence is
 * stated; the student is not asked to confirm anything.
 */
export function refusalFor(sourceWidth, sourceHeight, quad = null) {
  const projected = projectedLongEdge(sourceWidth, sourceHeight, quad);
  const hardFloor = Math.round(CONDITIONING.MIN_LONG_EDGE / ENHANCE.MAX_SCALE);
  if (projected >= hardFloor) return null;
  return quad
    ? `This page came out ${projected}px across and we need at least ${hardFloor}px to read the marking. Move the phone closer so the page fills the frame, and take it again.`
    : `This image is ${projected}px on its longest side and we need at least ${hardFloor}px to read the marking. A photo straight from the camera roll usually clears that; one that has been through a chat app usually does not.`;
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

/**
 * A 512px copy of the page.
 *
 * Written for triage, which asks "is this a marked exam paper" — a question a
 * thumbnail settles and which was being answered by sending full pages, at
 * 27-43 seconds a paper (AXON_FIX_BRIEF.md §7.5). Encoded as JPEG rather than
 * through `encodeBest`: it is small enough that WebP's size advantage is
 * irrelevant, and JPEG is the one format every path can decode.
 */
async function encodeThumb(img) {
  const target = targetSize(img.width, img.height, CONDITIONING.THUMB_LONG_EDGE);
  const from = toSurface(img);
  const c = surface(target.width, target.height);
  c.getContext('2d').drawImage(from, 0, 0, target.width, target.height);
  return encode(c, 'image/jpeg', 0.8);
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
 * @param {{quad?:Array, pageNumber?:number, capturePath?:string, liveGate?:Object, sourceKind?:string}} options
 */
export async function conditionPage(source, { quad = null, pageNumber = 1, capturePath = null, liveGate = null, sourceKind = null } = {}) {
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;

  // ── the one geometric operation ──────────────────────────────────────────
  // Perspective correction and the scale to target are composed into a single
  // homography and applied once. Warping and then resizing is two interpolations
  // and each one is a low-pass filter; thin strokes are high-frequency detail,
  // and they do not survive being filtered twice.

  let img;
  let warped = false;
  // 'gpu', 'cpu', or 'cpu-fallback' when the GPU was available and declined
  // this particular page. Recorded rather than assumed — see meta below.
  let warpPath = null;
  let warpMs = null;

  // What this page will be before any cap or rescue is applied — the warped
  // page's own size, which for a quad is not the frame's size.
  const natural = quad ? quadSize(quad) : { width: sw, height: sh };
  const naturalLong = Math.max(natural.width, natural.height);

  // ── the resolution floor, decided on evidence ────────────────────────────
  //
  // Assessed on the source, before anything has been resampled. A page measured
  // after an upscale reads soft *because* of the upscale, so assessing there
  // would refuse every page for the consequence of the operation being
  // assessed. See enhance.js.
  //
  // Only decoded when the answer might be yes. A page over the floor is not a
  // rescue candidate and never becomes one, so pulling a full-resolution
  // ImageData out of an eight-megapixel upload to ask a question whose answer
  // is already known would be tens of megabytes spent on nothing — on the one
  // path (upload, no quad) that had until now never needed the source at full
  // size at all.
  //
  // The GPU warp extends that to the quad path too, which is the common one:
  // it uploads `source` to a texture directly, so the eight-megapixel decode
  // and the thirty-megabyte ImageData behind it are never needed at all. On a
  // phone that is not only time, it is the largest single allocation the scan
  // makes. `pixels()` is what everything below calls when it turns out to
  // need them anyway — a rescue assessment, or a warp that fell back.
  const useGPU = !!quad && gpuWarpAvailable();
  let sourcePixels = (quad && !useGPU) ? imageDataFrom(source, sw, sh) : null;
  const pixels = () => (sourcePixels ??= imageDataFrom(source, sw, sh));
  const rescue = naturalLong >= CONDITIONING.MIN_LONG_EDGE
    ? { needed: false, possible: false, longEdge: naturalLong, scale: 1 }
    : assessRescue(pixels(), naturalLong);
  if (rescue.needed && !rescue.possible) {
    // Not an error in the ordinary sense: the page cannot be used and the
    // message already says what to do instead. Flagged so the worker boundary
    // and the UI can tell the two apart.
    const refusal = new Error(rescue.reason);
    refusal.refused = true;
    throw refusal;
  }

  // A rescued page is resampled *up* to the floor, and that enlargement is
  // folded into the same single interpolation everything else gets rather than
  // added as a second pass. Warping and then enlarging is two low-pass filters
  // over a page that is already short of detail.
  const targetLongEdge = rescue.possible ? CONDITIONING.MIN_LONG_EDGE : CONDITIONING.PAGE_LONG_EDGE;

  if (quad) {
    const target = targetSize(natural.width, natural.height, targetLongEdge, rescue.possible);
    // The GPU first, the CPU whenever it says no — and it says no for every
    // reason at once: no WebGL2, a texture larger than the device allows, a
    // degenerate quad, or a self-test it did not pass. There is one right
    // answer to all of those and it is the warp that was already here.
    const startedWarp = Date.now();
    let out = useGPU ? warpOnGPU(source, quad, target.width, target.height) : null;
    warpPath = out ? 'gpu' : (useGPU ? 'cpu-fallback' : 'cpu');
    if (!out) out = warpPerspective(pixels(), quad, target.width, target.height);
    warpMs = Date.now() - startedWarp;
    if (out) { img = out; warped = true; } else { img = pixels(); }
  } else {
    // No quad — an upload, or a native document scanner that already returned a
    // corrected page. §5.1 is explicit that a corrected page must not be
    // corrected again: it has had one good resample and a second is pure loss.
    const target = targetSize(sw, sh, targetLongEdge, rescue.possible);
    img = (target.width === sw && target.height === sh)
      ? pixels()
      : imageDataFrom(await resample(source, target), target.width, target.height);
  }

  // ── the lighting, on every page ──────────────────────────────────────────
  //
  // Conditioning's standing rule is "correct the camera, not the page", and a
  // hand or a phone casting a shadow across the paper is the camera's doing,
  // not the page's — the sheet is evenly white, the photograph is not. So
  // flattening belongs here, on the ordinary path, and it used to run only on
  // the rescue path: a page large enough to need no rescue got no lighting
  // correction at all, which is exactly the common case where a desk-lamp
  // shadow shows up.
  //
  // It should help the red separation rather than cost it. colour.js measures
  // redness relative to the page's own paper and estimates that baseline once
  // for the whole sheet; on a page with a gradient there is no single paper
  // level, so one end is compared against the other end's paper. Flattening
  // gives the baseline something true to be. Measured on the corpus rather than
  // argued — see bench/flatten-report.mjs.
  const startedFlatten = Date.now();
  const flattening = flattenPage(img);
  img = flattening.image;
  const flattenMs = Date.now() - startedFlatten;

  // ── and the acutance, only on a rescued page ─────────────────────────────
  //
  // Still the exception the rule always implied: a rescued page has been
  // enlarged, which costs acutance, and putting that back is correcting for an
  // operation this pipeline performed. Everything enhance.js does is a
  // per-pixel scalar gain, which is what keeps the red separation seeing
  // exactly what it would have seen.
  let enhancement = null;
  if (rescue.possible) {
    const enhanced = enhancePage(img, rescue);
    img = enhanced.image;
    enhancement = enhanced.meta;
  }

  // Scored against the page's *true* size, never the rescued one. A rescued
  // page is upscaled for the model's benefit and reported at the size the
  // camera actually gave — so it still reads as "smaller than we would like"
  // and the student is still told. Enhancement changes how a page reads, never
  // what it is, and a page claiming 2400px when the photograph was 1800px
  // would be the pipeline lying to its own telemetry.
  const rawQuality = scorePage(img, { longEdge: Math.min(naturalLong, CONDITIONING.PAGE_LONG_EDGE) });
  const layers = separateLayers(img);
  // See quality.js's `reconcileWithInk` for why: a glare-only fail is checked
  // against whether the red-ink layer actually survived on this same image,
  // rather than trusted on page-coverage share alone.
  const quality = reconcileWithInk(rawQuality, layers.teacher.components.length);

  const { blob, type } = await encodeBest(toSurface(img));
  const maskBlob = await encodeMask(layers.mask);
  const thumbBlob = await encodeThumb(img);

  return {
    blob,
    maskBlob,
    thumbBlob,
    width: img.width,
    height: img.height,
    quality,
    layers,
    meta: {
      preprocess_version: CONDITIONING.PREPROCESS_VERSION,
      page_number: pageNumber,
      warped,
      // The conditioned page's own pixel dimensions.
      //
      // Load-bearing, and absent from every page ever written before today.
      // Structure and content convert the model's boxes off a 0-1000 normalised
      // grid into page pixels, and with nothing to convert against they fell
      // back to a hardcoded 2400x3200 — so every box on every page was scaled
      // against a page shape that was, in general, not the page's. Those boxes
      // are the crop stage's entire input, which is why this is written down
      // before anything is cropped with them.
      width: img.width,
      height: img.height,
      source_size: { width: sw, height: sh },
      // The corners the homography was built from, in the source image's own
      // pixels. Kept so the warp can be reproduced — or undone — server-side
      // from the original, which is the only thing that makes "never discard
      // the original" worth anything.
      quad: quad ? quad.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) : null,
      // 'camera' | 'upload' | 'pdf' | 'link'. Mirrors the `source_kind` column
      // rather than duplicating a judgement: both are written from the same
      // value at the same moment.
      source_kind: sourceKind,
      // Null on every page that cleared the floor, which is almost all of them.
      // Non-null means this page was under the floor, was judged recoverable on
      // evidence, and was enlarged and sharpened to reach it — with what was
      // done and what it achieved recorded, so "we enhanced it" is a claim
      // production data can check rather than one anyone has to take on trust.
      enhance: enhancement,
      // Which warp actually ran. The GPU path is guarded by a per-session
      // self-test against the CPU (gpu.js), so production data showing
      // 'cpu-fallback' in the field is the signal that some real device
      // disagreed — which is a thing worth knowing rather than guessing at.
      warp_path: warpPath,
      // What the warp actually cost on this device. The whole argument for
      // moving it to the GPU is a number measured on a real phone, and this
      // is where that number comes from rather than from a bench machine.
      warp_ms: warpMs,
      // Illumination flattening runs on every page now rather than only on a
      // rescued one, so what it costs on a real phone is a number worth having
      // — it is the one stage that went from occasional to always.
      flatten_ms: flattenMs,
      // Whether the lighting actually needed correcting, and how uneven it was.
      // A page left alone is the common case and it is worth being able to see
      // that in production data rather than assuming it.
      flattened: flattening.applied,
      illumination_spread: Math.round(flattening.spread * 1000) / 1000,
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
        // detectMs/measureMs/focusMs for the search that produced this exact
        // frame's gate read — AXON_SCAN_LAG_BRIEF.md §0. Null on a page with no
        // live gate behind it (an upload) or before the first search landed.
        timing: liveGate.timing ?? null,
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
