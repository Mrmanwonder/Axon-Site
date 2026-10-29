// Imported files become pages here: a photo is one page, a PDF is one page per
// sheet, and a HEIC photo is decoded where the browser cannot (Chrome, Firefox).
//
// Both decoders are loaded only when a file needs them, so neither reaches the
// initial bundle. Each page leaves here as a bitmap for the device pipeline and
// a lossless PNG `original`: the server keeps originals, and a JPEG's 4:2:0
// chroma subsampling is exactly what erases thin coloured ink (IMAGE_PIPELINE.md
// §1.1), so a rasterised page is never stored as JPEG.

import { CAPTURE, CONDITIONING } from './contract.js';

const IMAGE_NAME = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const HEIC_NAME = /\.(heic|heif)$/i;
const PDF_NAME = /\.pdf$/i;

/**
 * What kind of import a file is, from its type and, when a picker, paste or
 * drag hands over an empty type, its name. null means Axon cannot use it.
 * @param {{ type?: string, name?: string } | null | undefined} file
 * @returns {'image' | 'heic' | 'pdf' | null}
 */
export function classifyImport(file) {
  const type = (file?.type ?? '').toLowerCase();
  const name = file?.name ?? '';
  if (type === 'application/pdf' || (!type && PDF_NAME.test(name))) return 'pdf';
  if (type === 'image/heic' || type === 'image/heif' || ((!type || type === 'application/octet-stream') && HEIC_NAME.test(name))) return 'heic';
  if (type.startsWith('image/') || (!type && IMAGE_NAME.test(name))) return 'image';
  return null;
}

/** The `accept` attribute for every file picker that imports pages. */
export const IMPORT_ACCEPT = 'image/*,application/pdf,.pdf,.heic,.heif';

/**
 * The scale that renders a PDF page with its long edge at the conditioning
 * target. A PDF is resolution-free, so it is rendered at exactly what stage 1
 * wants: smaller loses handwriting, larger only costs memory.
 * @param {number} width  page width at scale 1, in PDF points
 * @param {number} height page height at scale 1
 * @param {number} [longEdge]
 */
export function pdfRenderScale(width, height, longEdge = CONDITIONING.PAGE_LONG_EDGE) {
  const edge = Math.max(width, height);
  if (!(edge > 0)) throw new Error('This PDF page has no size.');
  return longEdge / edge;
}

/**
 * How many pages of a PDF fit, given the pages a paper already holds.
 * @param {number} pdfPages
 * @param {number} alreadyHeld
 * @returns {{ take: number, refused: number }}
 */
export function pdfPageBudget(pdfPages, alreadyHeld, max = CAPTURE.MAX_PAGES) {
  const room = Math.max(0, max - Math.max(0, alreadyHeld));
  const take = Math.min(Math.max(0, pdfPages), room);
  return { take, refused: Math.max(0, pdfPages) - take };
}

let pdfjsPromise = null;
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  }).catch((error) => { pdfjsPromise = null; throw error; });
  return pdfjsPromise;
}

let heicPromise = null;
function loadHeic() {
  // The CSP build: libheif compiled without eval, so script-src needs nothing new.
  heicPromise ??= import('heic-to/csp').catch((error) => { heicPromise = null; throw error; });
  return heicPromise;
}

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToPng(canvas) {
  if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => (blob ? resolve(blob) : reject(new Error('This page could not be encoded.'))),
    'image/png',
  ));
}

/**
 * Decode a HEIC photo. Safari decodes HEIC natively, so the browser is tried
 * first and the decoder only loads where that fails.
 * @param {Blob} file
 */
async function decodeHeic(file) {
  try {
    const bitmap = await createImageBitmap(file);
    return { bitmap, original: file };
  } catch { /* fall through to the decoder */ }
  const { heicTo } = await loadHeic();
  const png = await heicTo({ blob: file, type: 'image/png' });
  return { bitmap: await createImageBitmap(png), original: png };
}

/**
 * Turn one imported file into pages. Yields one entry per page, in order.
 * The caller owns each bitmap and must close it.
 *
 * @param {File} file
 * @param {{ alreadyHeld?: number, max?: number }} [options]
 * @returns {AsyncGenerator<{ bitmap: ImageBitmap, original: Blob, sourceKind: 'upload' | 'pdf', label: string }
 *   | { refused: number, reason: string }>}
 */
export async function* importPages(file, { alreadyHeld = 0, max = CAPTURE.MAX_PAGES } = {}) {
  const kind = classifyImport(file);
  if (kind === 'image') {
    yield { bitmap: await createImageBitmap(file), original: file, sourceKind: 'upload', label: file.name };
    return;
  }
  if (kind === 'heic') {
    const { bitmap, original } = await decodeHeic(file);
    yield { bitmap, original, sourceKind: 'upload', label: file.name };
    return;
  }
  if (kind !== 'pdf') throw new Error('Only photos and PDFs can be added.');

  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  // isEvalSupported: false keeps pdf.js inside the CSP (no 'unsafe-eval').
  const task = pdfjs.getDocument({ data, isEvalSupported: false });
  try {
    const doc = await task.promise;
    const { take, refused } = pdfPageBudget(doc.numPages, alreadyHeld, max);
    for (let n = 1; n <= take; n++) {
      const page = await doc.getPage(n);
      try {
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: pdfRenderScale(base.width, base.height) });
        const width = Math.round(viewport.width);
        const height = Math.round(viewport.height);
        const canvas = makeCanvas(width, height);
        const context = canvas.getContext('2d');
        // A PDF page has no paper behind it; give it white, as printed.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const original = await canvasToPng(canvas);
        const bitmap = await createImageBitmap(canvas);
        yield { bitmap, original, sourceKind: 'pdf', label: `${file.name} · page ${n}` };
      } finally {
        page.cleanup();
      }
    }
    if (refused > 0) {
      yield {
        refused,
        reason: `A paper can hold ${max} pages. ${refused} ${refused === 1 ? 'page' : 'pages'} of ${file.name} did not fit; start a second paper for the rest.`,
      };
    }
  } finally {
    // pdf.js 6 destroys through the loading task; that also ends its worker.
    await task.destroy();
  }
}
