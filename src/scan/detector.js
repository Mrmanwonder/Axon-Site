// Page detection — a public library, used as shipped.
//
// This module is deliberately thin. It does not tune, re-threshold, or second-
// guess the library. The detector is scanic (MIT), whose optional ML mode
// (`detector: 'ml'`, a small DocCornerNet model on ONNX Runtime Web) is the
// default engine here. Its classical Canny pipeline is the fallback, used only
// when the ML engine could not run at all (assets missing, WebAssembly blocked),
// never when ML ran and said "no page": a wall or an empty desk must stay empty,
// and a second opinion from a weaker engine would only invent a page there.
//
// Tuning against real phone footage is a separate, later step (AXO-153) and
// changes nothing in this file except the options passed to `scanDocument`.
//
// Pure ES module so the same code runs in the Web Worker, on the main thread and
// under Node. The engine is injectable for tests; production loads scanic
// lazily so none of it lands in the initial bundle.

/** What is shipped, recorded so a bug report can say which detector it was. */
export const DETECTOR = Object.freeze({
  ENGINE: 'scanic@1.6.0',
  MODEL: 'DocCornerNet LEAN (scanic-ml@0.2.0)',
  // Served from our own origin. Versioned path so a new model ships at a new URL
  // and the old one stays cacheable forever (public/_headers).
  ASSET_PATH: 'scan-ml/0.2.0/',
});

/** @typedef {{x:number,y:number}} Point */
/** @typedef {[Point,Point,Point,Point]} Quad  top-left, top-right, bottom-right, bottom-left */
/**
 * @typedef {Object} Detection
 * @property {'found'|'none'|'unavailable'} status
 * @property {'ml'|'classical'|null} source   which engine produced this answer
 * @property {Quad|null} quad                  in the pixels of the image given
 * @property {number|null} score               P(page present) from ML; null from classical
 * @property {boolean} degraded                ML could not run; this is the classical answer
 * @property {string|null} error               why an engine failed, never swallowed
 * @property {number} ms
 */

let enginePromise = null;
async function loadEngine() {
  enginePromise ??= import('scanic').catch((error) => {
    enginePromise = null;
    throw error;
  });
  return enginePromise;
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Convex, non-degenerate, same turn direction at every corner. */
export function isConvexQuad(q) {
  if (!Array.isArray(q) || q.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const c = cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]);
    if (c === 0) return false;
    const s = c > 0 ? 1 : -1;
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

/** scanic's `{topLeft,…}` corners → a clamped, validated quad, or null. */
export function quadFromCorners(corners, width, height) {
  if (!corners) return null;
  const raw = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  if (!raw.every((p) => p && finite(p.x) && finite(p.y))) return null;
  const quad = raw.map((p) => ({
    x: Math.min(width, Math.max(0, p.x)),
    y: Math.min(height, Math.max(0, p.y)),
  }));
  return isConvexQuad(quad) ? quad : null;
}

function describe(error) {
  return String(error?.message ?? error ?? 'unknown error').slice(0, 240);
}

/**
 * Find the page in one frame.
 *
 * @param {ImageData} image
 * @param {{ assetBaseUrl?: string, engine?: { scanDocument: Function }, classicalFallback?: boolean }} [options]
 * @returns {Promise<Detection>}
 */
export async function detectPage(image, { assetBaseUrl, engine, classicalFallback = true } = {}) {
  const started = performance.now();
  const done = (partial) => ({
    status: 'unavailable', source: null, quad: null, score: null,
    degraded: false, error: null, ...partial, ms: performance.now() - started,
  });

  let lib;
  try {
    lib = engine ?? await loadEngine();
  } catch (error) {
    return done({ error: `detector failed to load: ${describe(error)}` });
  }

  let mlError = null;
  try {
    const result = await lib.scanDocument(image, {
      mode: 'detect',
      detector: 'ml',
      ...(assetBaseUrl ? { ml: { assetBaseUrl } } : {}),
    });
    const score = finite(result?.score) ? result.score : null;
    if (result?.success) {
      const quad = quadFromCorners(result.corners, image.width, image.height);
      if (quad) return done({ status: 'found', source: 'ml', quad, score });
    }
    // ML ran. "No confident document" is an answer, not an error.
    return done({ status: 'none', source: 'ml', score });
  } catch (error) {
    mlError = describe(error);
  }

  if (!classicalFallback) return done({ error: mlError });

  try {
    const result = await lib.scanDocument(image, { mode: 'detect' });
    const quad = result?.success ? quadFromCorners(result.corners, image.width, image.height) : null;
    return done({
      status: quad ? 'found' : 'none',
      source: 'classical',
      quad,
      degraded: true,
      error: mlError,
    });
  } catch (error) {
    return done({ error: `${mlError}; classical: ${describe(error)}`, degraded: true });
  }
}

/**
 * Load the model and runtime before the first live frame, so the first real
 * detection is not the one that pays for a 3 MB download. Resolves to whether
 * the ML engine is usable; a false answer is shown to the student as a reason,
 * not hidden.
 *
 * @returns {Promise<{ ml: boolean, error: string|null }>}
 */
export async function warmUp({ assetBaseUrl, engine } = {}) {
  const blank = new ImageData(224, 224);
  const hit = await detectPage(blank, { assetBaseUrl, engine, classicalFallback: false });
  return { ml: hit.status !== 'unavailable', error: hit.error };
}
