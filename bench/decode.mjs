// Decode a bench fixture into the plain {data, width, height} shape every
// pure pipeline function already expects — the same shape a browser's
// `ctx.getImageData()` returns. `sharp` is a devDependency used only here and
// in golden.test.mjs; nothing under src/ imports it, and it never ships to
// the browser bundle.
//
// This is what makes bench/golden.test.mjs possible at all: detectQuad,
// paperScore, scorePage and friends never touch the DOM, so decoding a real
// JPEG fixture into their input shape is the only thing standing between
// "pure functions with no test" and a real accuracy check running in CI.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const here = new URL('./fixtures/', import.meta.url);

/**
 * @param {string} name File under bench/fixtures/.
 * @param {{crop?: {left:number,top:number,width:number,height:number}, resizeWidth?: number, blur?: number, exposure?: number}} [options]
 *   `crop` pulls one region out first — the live-feed area of a full-screen
 *   capture, say. `resizeWidth` then scales to a given width, preserving the
 *   aspect ratio of whatever came out of the crop — mirrors the proxy the
 *   live gate actually searches, at whatever width the caller asks for.
 *
 *   `blur` (Gaussian sigma) and `exposure` (a linear multiplier) apply a
 *   *labelled degradation* to a real fixture. They exist because the corpus has
 *   no genuinely blurred and no genuinely over-exposed photograph in it, and a
 *   threshold that has never been shown to fire on the failure it is for is not
 *   a calibrated threshold. Applied last, after any resize, so the degradation
 *   is at the resolution the gate will actually judge — blurring at native and
 *   then downscaling would partly undo it.
 *
 *   `rotate` (degrees) is the same idea for geometry rather than quality, and
 *   it exists for the same reason: every page in the corpus was photographed
 *   roughly square-on, so a detector blind spot at an angle could not show up
 *   here. It rotates before any resize, expanding onto a desk-toned
 *   background rather than white — a white margin would read as more paper
 *   and quietly make the test easier than the situation it stands for.
 */
export async function decodeFixture(name, { crop = null, resizeWidth = null, blur = null, exposure = null, rotate = null } = {}) {
  const path = fileURLToPath(new URL(name, here));
  let pipeline = sharp(path).rotate(); // apply EXIF orientation — a raw buffer carries none of its own
  const meta = await pipeline.metadata();
  let sourceWidth = crop ? crop.width : (meta.width ?? 0);
  let sourceHeight = crop ? crop.height : (meta.height ?? 0);

  if (crop) pipeline = pipeline.extract(crop);
  if (rotate) {
    // A desk tone, not white. See the note on `rotate` above.
    pipeline = pipeline.rotate(rotate, { background: { r: 96, g: 88, b: 78 } });
    // The rotation expands the canvas, so anything downstream that scales by
    // the original aspect ratio would squash it. Re-read the real size.
    const rotated = await pipeline.toBuffer({ resolveWithObject: true });
    pipeline = sharp(rotated.data);
    sourceWidth = rotated.info.width;
    sourceHeight = rotated.info.height;
  }
  if (resizeWidth) {
    const height = Math.max(1, Math.round(resizeWidth * sourceHeight / sourceWidth));
    pipeline = pipeline.resize(resizeWidth, height, { fit: 'fill' });
  }

  if (exposure) pipeline = pipeline.linear(exposure, 0);
  if (blur) pipeline = pipeline.blur(blur);

  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
    width: info.width,
    height: info.height,
  };
}
