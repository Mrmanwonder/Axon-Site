// Stages 1 and 2, wherever they can actually run.
//
// Prefers a module worker, falls back to the main thread, and presents the same
// promise either way. The fallback is not theoretical: module workers need a
// reasonably current browser, and the phones this product is built for are
// exactly the ones that might not have it. A dropped frame is worth far less
// than a student who cannot scan at all.

import { conditionPage } from './conditioning.js';

let worker = null;
let nextId = 1;
const pending = new Map();

function ensureWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { id, ...rest } = event.data;
      const resolve = pending.get(id);
      if (!resolve) return;
      pending.delete(id);
      resolve(rest);
    };
    worker.onerror = () => { worker = false; }; // fall back from here on
  } catch {
    worker = false;
  }
  return worker;
}

/**
 * Condition one page and separate its layers.
 *
 * @param {ImageBitmap} source
 * @param {{quad?:Array, pageNumber?:number, capturePath?:string, liveGate?:Object, sourceKind?:string}} options
 */
export async function processPage(source, { quad = null, pageNumber = 1, capturePath = null, liveGate = null, sourceKind = null } = {}) {
  const w = ensureWorker();
  if (w) {
    const id = nextId++;
    const result = await new Promise((resolve) => {
      pending.set(id, resolve);
      // The bitmap is transferred rather than copied. A copy of an
      // eight-megapixel frame is tens of megabytes moved for nothing.
      w.postMessage({ id, source, quad, pageNumber, capturePath, liveGate, sourceKind }, [source]);
    });
    if (!result.ok) {
      const error = new Error(result.error);
      error.refused = !!result.refused;
      throw error;
    }
    return result;
  }
  return processOnThisThread(source, { quad, pageNumber, capturePath, liveGate, sourceKind });
}

async function processOnThisThread(source, { quad, pageNumber, capturePath, liveGate, sourceKind }) {
  const conditioned = await conditionPage(source, { quad, pageNumber, capturePath, liveGate, sourceKind });
  // No content layer — see the note in worker.js. A full pass over the page to
  // build something nothing downstream reads.
  // conditionPage has already run stage 2 and encoded the mask it produced.
  // Running it a second time here would recompute the whole thing and then throw
  // the answer away — and the mask that travels has to be the one the blob was
  // encoded from, or the boxes will not line up with the image.
  const layers = conditioned.layers;
  return {
    ok: true,
    blob: conditioned.blob,
    mask: conditioned.maskBlob,
    thumb: conditioned.thumbBlob,
    width: conditioned.width,
    height: conditioned.height,
    quality: conditioned.quality,
    meta: conditioned.meta,
    teacher_marks: layers.teacher.components.map((c) => ({
      box: c.box, shape: c.shape, metrics: c.metrics,
    })),
    margin_band: layers.teacher.margin_band,
    layer_fallback: layers.fallback,
    coverage: layers.coverage,
  };
}

/**
 * The structure proxy: a small copy of the page for stage 3.
 *
 * Two things at once. It is the downscaled page the structure pass wants — §15
 * lists that as a cost lever, and finding boundaries does not need 300 DPI — and
 * because it uploads in a second, it lets structure start while the full pages
 * are still going up. Time-to-structure is the number the student experiences.
 */
export async function makeProxy(blob, longEdge = 1000) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return canvas.convertToBlob
    ? canvas.convertToBlob({ type: 'image/jpeg', quality: 0.62 })
    : new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.62));
}
