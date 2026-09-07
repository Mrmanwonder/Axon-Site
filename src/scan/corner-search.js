// Finding one corner, in one small window, when you already know roughly
// where it is and which way its two edges run.
//
// This is the other half of the detect/track split. `detectQuad` answers
// "where is the page?" over the whole frame and costs what that question
// costs. This answers "the top-left corner was here and its edges ran like
// this — where is it now?", over a window of a few thousand pixels, and it is
// the function that runs on every frame.
//
// Why not optical flow: paper is textureless (§12). Lucas-Kanade and friends
// need something to latch onto, and the middle of a sheet of A4 offers
// nothing. What a page corner does have is two long straight edges meeting at
// a point, and the *directions* of those edges are already known from the
// previous frame — so the search is not "find a corner", it is "find these
// two specific lines and intersect them", which is a far smaller question.
//
// Pure, like the rest of the geometry: ImageData in, a point and a confidence
// out. No canvas, no camera, no DOM — so it is testable in Node against
// synthetic corners with known answers, which is exactly what
// bench/tracking.test.mjs does.

import { gradients } from './quad.js';

// How far a line's normal may sit from the direction we expected before it
// stops counting as that edge. Wide enough for a page rotating under the
// camera between frames, narrow enough that the perpendicular edge and the
// page's own ruled lines do not answer instead.
const ANGLE_TOLERANCE = 18;
// Rho resolution, in pixels, for the local accumulator. One is affordable at
// this size and avoids quantising the corner away.
const RHO_STEP = 1;
// A line has to be voted for by this share of the length it could possibly run
// to inside the window, in pixels, to count as an edge rather than as noise
// agreeing with itself. A corner sitting in the middle of its window puts about
// half of each edge in frame, so this sits well under a half.
const MIN_SUPPORT = 0.22;
// `gradients()` computes blur over [1, n-2] and Sobel over the same range, so
// the outermost two rows and columns of `mag` are either unwritten or read a
// blur value that was never filled — a step against nothing, which reads as the
// strongest straight edge in the window and sits exactly parallel to the page
// edge we are hunting. Two pixels in from every side is the first honest data.
// (Skipping it is not optional here: `gradients` reuses its buffers between
// calls without clearing them, so on the second corner of a frame that ring
// holds the *previous* corner's pixels.)
const BORDER = 2;
// An edge pixel is one whose gradient is at least this share of the strongest
// in the window. Relative, because a page on a dark desk in daylight and the
// same page under a lamp differ by an order of magnitude in step size, and an
// absolute threshold would find the first and miss the second.
const EDGE_RATIO = 0.35;
// ...but never below this, so a window of blank paper cannot promote its own
// sensor noise to an edge by having nothing better in it. A Sobel L1 magnitude
// of a step of ~7 grey levels, which is a few times the noise left after the
// 3x3 blur and far under any real paper/desk boundary.
const MIN_MAGNITUDE = 40;

// Reused across calls and across corners. Four corners a frame at sixty frames
// a second is 240 allocations a second otherwise, and a garbage collection
// pause in the middle of tracking is exactly the stutter this whole change
// exists to remove (§60/§61).
const scratch = { size: 0, bins: null, weight: null };

function accumulators(size) {
  if (scratch.size !== size) {
    scratch.size = size;
    scratch.bins = new Float32Array(size);
    scratch.weight = new Float32Array(size);
  } else {
    scratch.bins.fill(0);
    scratch.weight.fill(0);
  }
  return scratch;
}

/**
 * The strongest line in `roi` whose normal points roughly `normal` degrees.
 *
 * A one-dimensional Hough: every edge pixel whose gradient points the right
 * way drops its magnitude into the rho bin it belongs to, and the fullest bin
 * is the line. Restricting the angle first is what makes this cheap — there is
 * no theta dimension to search because the caller already knows it.
 *
 * Returns rho in the same parameterisation quad.js uses (rho = x·cos + y·sin,
 * angles in degrees), so the intersection maths below matches the global
 * detector's rather than being a second convention.
 */
/**
 * What counts as an edge pixel in this window.
 *
 * The window sets its own bar, from the strongest gradient in it. This is not
 * `gradients()`'s own threshold, which is a mean and deviation over the whole
 * buffer and is tuned for a frame with a page somewhere in it rather than for
 * a few thousand pixels that are mostly one edge.
 */
function edgeThreshold(mag, width, y0, y1, x0, x1) {
  let peak = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const m = mag[y * width + x];
      if (m > peak) peak = m;
    }
  }
  return peak < MIN_MAGNITUDE ? null : Math.max(MIN_MAGNITUDE, peak * EDGE_RATIO);
}

export function strongestLine(roi, normal, { tolerance = ANGLE_TOLERANCE, grad = null, threshold: given = null } = {}) {
  const { width, height } = roi;
  const x0 = BORDER, x1 = width - BORDER;   // exclusive
  const y0 = BORDER, y1 = height - BORDER;
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;

  // `grad` and `threshold` are accepted rather than always computed because a
  // corner is two lines over the same pixels, and the Sobel pass is most of
  // what either costs. Taking it twice per corner, four corners a frame, sixty
  // frames a second, is half the tracking budget spent on the same answer.
  const { mag, dir } = grad ?? gradients(roi);
  const threshold = given ?? edgeThreshold(mag, width, y0, y1, x0, x1);
  if (threshold == null) return null;

  const diagonal = Math.ceil(Math.hypot(width, height));
  const bins = Math.ceil((2 * diagonal) / RHO_STEP) + 1;
  const offset = diagonal;
  const { bins: acc, weight: votes } = accumulators(bins);

  const target = ((normal % 180) + 180) % 180;
  const radians = (target * Math.PI) / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);

  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = y * width + x;
      const m = mag[p];
      if (m < threshold) continue;
      // `dir` is already the gradient direction quantised into 180 one-degree
      // bins, which is the same space `target` is in.
      let delta = Math.abs(dir[p] - target);
      if (delta > 90) delta = 180 - delta;
      if (delta > tolerance) continue;
      const rho = x * cos + y * sin;
      const bin = ((rho + offset) / RHO_STEP) | 0;
      if (bin < 0 || bin >= bins) continue;
      acc[bin] += m;
      votes[bin] += 1;
      total += m;
    }
  }
  if (!total) return null;

  // The peak, plus its immediate neighbours: an edge one pixel wide still
  // straddles two bins when it falls between them, and taking the sum of a
  // small neighbourhood keeps that from halving its apparent support.
  let best = 0, bestScore = 0;
  for (let i = 1; i < bins - 1; i++) {
    const score = acc[i - 1] + acc[i] + acc[i + 1];
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (!bestScore) return null;

  // Sub-bin peak, weighted by the two neighbours, so the line does not
  // quantise to whole pixels.
  const left = acc[best - 1], centre = acc[best], right = acc[best + 1];
  const denominator = left + centre + right;
  const shift = denominator ? (right - left) / denominator : 0;
  const rho = (best + shift) * RHO_STEP - offset;

  // Support counts pixels, not gradient magnitude, against how far this line
  // could run inside the window before leaving it. Counting magnitude would
  // let one very high-contrast inch of edge stand in for a whole side, and
  // "most of a side is present" is the thing actually worth knowing.
  const dx = Math.abs(sin), dy = Math.abs(cos); // the line's own direction
  const chord = Math.min(
    dx > 1e-6 ? (x1 - x0) / dx : Infinity,
    dy > 1e-6 ? (y1 - y0) / dy : Infinity,
  );
  const counted = votes[best - 1] + votes[best] + votes[best + 1];
  const support = chord ? counted / chord : 0;

  return { rho, normal: target, cos, sin, support, strength: bestScore / total };
}

/** Where two lines in (rho, normal) form cross, or null if near-parallel. */
export function intersectLines(a, b) {
  const determinant = a.cos * b.sin - b.cos * a.sin;
  // Near-parallel lines meet a very long way away, or nowhere, and either way
  // the intersection says nothing about where a corner is.
  if (Math.abs(determinant) < 0.25) return null;
  return {
    x: (a.rho * b.sin - b.rho * a.sin) / determinant,
    y: (a.cos * b.rho - b.cos * a.rho) / determinant,
  };
}

/**
 * Find one corner inside one window.
 *
 * `edgeA` and `edgeB` are the *line* directions of the two edges that meet at
 * this corner, in degrees, as `track.js` reports them — this converts to the
 * normals the accumulator works in, so callers never have to think about the
 * ninety-degree offset.
 *
 * Returns coordinates local to the ROI. The caller adds the window's origin;
 * keeping this function ignorant of where the window sits in the frame is what
 * lets it be tested against a synthetic corner at a known place.
 */
export function findCorner(roi, { edgeA, edgeB, tolerance = ANGLE_TOLERANCE } = {}) {
  if (!roi || !roi.width || !roi.height) return null;
  if (!Number.isFinite(edgeA) || !Number.isFinite(edgeB)) return null;

  const { width, height } = roi;
  if (width - 2 * BORDER < 4 || height - 2 * BORDER < 4) return null;

  // One Sobel pass, two lines. See strongestLine.
  const grad = gradients(roi);
  const threshold = edgeThreshold(grad.mag, width, BORDER, height - BORDER, BORDER, width - BORDER);
  if (threshold == null) return null;

  const lineA = strongestLine(roi, edgeA + 90, { tolerance, grad, threshold });
  const lineB = strongestLine(roi, edgeB + 90, { tolerance, grad, threshold });
  if (!lineA || !lineB) return null;
  if (lineA.support < MIN_SUPPORT || lineB.support < MIN_SUPPORT) return null;

  const point = intersectLines(lineA, lineB);
  if (!point) return null;

  // The intersection has to land in or near the window. Two edges found at
  // opposite ends of the ROI cross somewhere off in the distance, and that
  // point is not this corner.
  const margin = Math.max(roi.width, roi.height) * 0.35;
  if (point.x < -margin || point.y < -margin ||
      point.x > roi.width + margin || point.y > roi.height + margin) return null;

  // How close to the centre the corner landed. The window was cut around the
  // *predicted* position, so a corner near the middle is a corner the
  // prediction got right, which is itself evidence (§19).
  const cx = roi.width / 2, cy = roi.height / 2;
  const offCentre = Math.hypot(point.x - cx, point.y - cy) / Math.max(cx, cy);
  const centrality = Math.max(0, 1 - offCentre);

  const support = Math.min(1, (lineA.support + lineB.support) / 2);
  // Two edges that meet squarely are a corner; two that meet at a glancing
  // angle are more likely one edge found twice.
  const squareness = Math.abs(lineA.cos * lineB.sin - lineB.cos * lineA.sin);

  const confidence = Math.max(0, Math.min(1,
    support * 0.45 + centrality * 0.3 + squareness * 0.25));

  return {
    x: point.x,
    y: point.y,
    confidence,
    support,
    centrality,
    squareness,
    edgeDirectionA: edgeA,
    edgeDirectionB: edgeB,
  };
}
