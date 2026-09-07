// Finding the page by its outline, rather than by four lines that might be one.
//
// scan-ground-up-revamp-2026-09-07.md Phase 2 asks for a proven contour
// detector in place of the hand-rolled Hough search. This is that change in
// substance — contour-shaped detection — without the 12.7MB (3.6MB gzipped)
// OpenCV.js payload the brief names, which is fourteen times the entire
// application bundle and would land on exactly the budget Android devices
// CLAUDE.md's performance floor is written for. What OpenCV would have
// supplied is `Canny` + `findContours` + `approxPolyDP`; what that actually
// buys over `edges.js` is the subject of this file, and it is about two
// hundred lines.
//
// It runs *alongside* the line search rather than replacing it, sharing the
// one expensive thing (the Sobel pass) and feeding candidates into the same
// gate. That is deliberate. The two detectors fail on different frames:
//
//   · The line search pairs four independently-fitted lines. It is excellent
//     on a clean, high-contrast, roughly-square-on page, and it has two
//     structural blind spots — it splits candidate lines into "vertical" and
//     "horizontal" families around a hard ±40° axis test, so a page held at
//     roughly 45° has all four of its edges sitting on the boundary of that
//     split and can fail to produce two of each; and four lines that each
//     genuinely exist can be paired into a quadrilateral that does not, if a
//     desk edge and a window frame happen to line up.
//
//   · This one thresholds with hysteresis (a weak edge pixel counts if it is
//     connected to a strong one, which is what keeps a page edge that fades
//     into shadow halfway along), closes 1–2px gaps, groups the surviving
//     edge pixels into connected components, and asks each large component
//     for its own extreme points. A page's outline is one connected ring, so
//     its extremes *are* its corners. There is no axis assumption anywhere in
//     that, so rotation is free.
//
// Union of candidates, one scoring gate, best score wins. A detector that can
// only add candidates cannot raise the false-reject rate, which is the number
// bench/golden-report.mjs holds this to.

import { orderQuad } from './geometry.js';

// A page's edge ring spans a good share of both axes. Anything smaller is a
// component of something inside the page — a ruled line, a printed box, a
// paragraph of handwriting — and not the page itself.
const MIN_SPAN = 0.28;
// Weak edges count when they are connected to a strong one. The ratio is the
// usual Canny 2:1-to-3:1 territory; 0.4 was the value that recovered the
// shadowed page edges in bench/fixtures without pulling in desk texture.
const LOW_RATIO = 0.4;
// The most of its own bounding box a component may fill and still be read as
// an outline rather than a solid mass. A page's edge ring runs a few percent;
// the threshold is far above that so a thick or doubled edge still counts.
const MAX_RING_DENSITY = 0.35;

/**
 * Quad candidates from the edge map, one per large connected edge component.
 *
 * Takes the gradient the line search already computed rather than running a
 * second Sobel pass over the same frame — on the live path this runs ~12
 * times a second and the gradient is the expensive part of both detectors.
 */
export function quadsFromEdges({ mag, threshold }, width, height, {
  lowRatio = LOW_RATIO, minSpan = MIN_SPAN,
} = {}) {
  const edges = closeGaps(hysteresis(mag, width, height, threshold, threshold * lowRatio), width, height);
  const quads = [];
  for (const group of components(edges, width, height, minSpan)) {
    const quad = quadFromExtremes(group);
    if (quad) quads.push(quad);
  }
  // The edge map travels with the candidates: `perimeterSupport` scores them
  // against it, and recomputing it in the caller would be a second hysteresis
  // pass over the same frame.
  return { quads, edges };
}

/**
 * Strong edges, plus every weak edge connected to one.
 *
 * The single-threshold version this replaces drops a page edge the moment it
 * passes through shadow, because the gradient there falls under a threshold
 * set by the strongest edges elsewhere in the frame. Hysteresis is the
 * standard answer and it is the reason a page on a dim desk is findable at
 * all: the bright half of the edge vouches for the dim half.
 */
export function hysteresis(mag, width, height, high, low) {
  const n = width * height;
  const out = new Uint8Array(n);
  // Each pixel is marked before it is pushed and never pushed twice, so the
  // stack cannot exceed one slot per pixel — which is what makes a fixed
  // typed array safe here, and what keeps this off the JS call stack. A page
  // edge is tens of thousands of pixels long and recursion would not survive
  // it on the phones this is built for.
  const stack = new Int32Array(n);
  let top = 0;

  for (let p = 0; p < n; p++) {
    if (mag[p] >= high) { out[p] = 1; stack[top++] = p; }
  }

  while (top > 0) {
    const p = stack[--top];
    const x = p % width, y = (p / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width || (!dx && !dy)) continue;
        const q = ny * width + nx;
        if (!out[q] && mag[q] >= low) { out[q] = 1; stack[top++] = q; }
      }
    }
  }
  return out;
}

/**
 * A 3x3 binary close — dilate, then erode.
 *
 * Bridges gaps of one or two pixels without thickening the edge overall. A
 * real page edge is broken constantly: by a shadow, by the page curling, by
 * a pen resting across it. Each break splits what should be one component
 * into two, and two half-rings have no corners between them.
 */
export function closeGaps(src, width, height) {
  const dilated = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (src[p]) { dilated[p] = 1; continue; }
      let hit = 0;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          if (src[ny * width + nx]) { hit = 1; break; }
        }
      }
      dilated[p] = hit;
    }
  }

  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!dilated[p]) continue;
      let all = 1;
      for (let dy = -1; dy <= 1 && all; dy++) {
        const ny = y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          // Outside the frame counts as set, so an edge running along the
          // frame's own border is not eroded away for having no neighbours
          // on one side. A page pushed right up to the edge of the shot is a
          // page, and it is the one the resolution gate most wants found.
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (!dilated[ny * width + nx]) { all = 0; break; }
        }
      }
      out[p] = all;
    }
  }
  return out;
}

/**
 * Connected groups of edge pixels, reported only by their extreme points.
 *
 * No pixel list is retained — the same reasoning as layers.js's component
 * pass, and here it also happens to be all that is wanted. The extremes of
 * x, y, x+y and x−y are, on any rectangle at any rotation, a superset of its
 * four corners: the x/y pair catches an axis-aligned page and the sum/diff
 * pair catches one at 45°, and between them every angle is covered.
 */
export function components(bin, width, height, minSpan) {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const spanX = width * minSpan, spanY = height * minSpan;
  const groups = [];

  for (let seed = 0; seed < n; seed++) {
    if (!bin[seed] || seen[seed]) continue;
    let top = 0;
    stack[top++] = seed;
    seen[seed] = 1;

    let minX = width, maxX = -1, minY = height, maxY = -1, area = 0;
    let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
    let atMinX = null, atMaxX = null, atMinY = null, atMaxY = null;
    let atMinSum = null, atMaxSum = null, atMinDiff = null, atMaxDiff = null;

    while (top > 0) {
      const p = stack[--top];
      const x = p % width, y = (p / width) | 0;
      area++;

      if (x < minX) { minX = x; atMinX = { x, y }; }
      if (x > maxX) { maxX = x; atMaxX = { x, y }; }
      if (y < minY) { minY = y; atMinY = { x, y }; }
      if (y > maxY) { maxY = y; atMaxY = { x, y }; }
      const sum = x + y, diff = x - y;
      if (sum < minSum) { minSum = sum; atMinSum = { x, y }; }
      if (sum > maxSum) { maxSum = sum; atMaxSum = { x, y }; }
      if (diff < minDiff) { minDiff = diff; atMinDiff = { x, y }; }
      if (diff > maxDiff) { maxDiff = diff; atMaxDiff = { x, y }; }

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width || (!dx && !dy)) continue;
          const q = ny * width + nx;
          if (bin[q] && !seen[q]) { seen[q] = 1; stack[top++] = q; }
        }
      }
    }

    if (maxX - minX < spanX || maxY - minY < spanY) continue;
    // A page's outline is a *ring*: long, thin, and mostly empty inside its
    // own bounding box. A dense component that fills its box is not an
    // outline — it is the page edge fused with desk clutter by the closing
    // pass, and its extreme points are then the frame's corners rather than
    // the page's. Those candidates are refused downstream anyway (a
    // frame-sized quad fails MAX_FILL), but a component this shape has
    // nothing useful to say and its extremes are not worth trusting.
    const boxArea = (maxX - minX + 1) * (maxY - minY + 1);
    if (area > boxArea * MAX_RING_DENSITY) continue;
    groups.push({
      area,
      extremes: [atMinX, atMaxX, atMinY, atMaxY, atMinSum, atMaxSum, atMinDiff, atMaxDiff],
    });
  }
  return groups;
}

/**
 * The largest quadrilateral the group's extreme points can bound.
 *
 * At most eight points come in, so the hull is at most eight and the search
 * for the best four of them is at most seventy combinations of four — small
 * enough to do exhaustively and be certain, rather than approximately with a
 * polygon simplification whose epsilon would be one more thing to calibrate.
 */
export function quadFromExtremes({ extremes }) {
  const unique = [];
  for (const p of extremes) {
    if (p && !unique.some((q) => q.x === p.x && q.y === p.y)) unique.push(p);
  }
  if (unique.length < 4) return null;

  const hull = convexHull(unique);
  if (hull.length < 4) return null;
  if (hull.length === 4) return orderQuad(hull);

  // The hull is in cyclic order, so any four of it taken in index order are
  // themselves a convex quadrilateral in cyclic order.
  let best = null, bestArea = 0;
  for (let a = 0; a < hull.length - 3; a++) {
    for (let b = a + 1; b < hull.length - 2; b++) {
      for (let c = b + 1; c < hull.length - 1; c++) {
        for (let d = c + 1; d < hull.length; d++) {
          const quad = [hull[a], hull[b], hull[c], hull[d]];
          const area = polygonArea(quad);
          if (area > bestArea) { bestArea = area; best = quad; }
        }
      }
    }
  }
  return best ? orderQuad(best) : null;
}

/** Andrew's monotone chain, counter-clockwise, no collinear points kept. */
export function convexHull(points) {
  const pts = [...points].sort((a, b) => (a.x - b.x) || (a.y - b.y));
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/** Shoelace, unsigned. */
function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2);
}

/**
 * How much of a quad's perimeter actually has an edge under it.
 *
 * The line search ranks its candidates by Hough vote count, which a contour
 * candidate has no equivalent of. This is the comparable question asked
 * directly of the pixels — walk the four sides, count how many sample points
 * land on or beside an edge pixel — and it is the more honest one: votes say
 * "many pixels are collinear with this line somewhere in the frame", this
 * says "there is an edge here, along this specific quadrilateral".
 */
export function perimeterSupport(edges, width, height, quad, samplesPerSide = 24) {
  let hits = 0, total = 0;
  for (let e = 0; e < 4; e++) {
    const a = quad[e], b = quad[(e + 1) % 4];
    for (let s = 0; s <= samplesPerSide; s++) {
      const f = s / samplesPerSide;
      const x = Math.round(a.x + (b.x - a.x) * f);
      const y = Math.round(a.y + (b.y - a.y) * f);
      total++;
      let hit = 0;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          if (edges[ny * width + nx]) { hit = 1; break; }
        }
      }
      hits += hit;
    }
  }
  return total ? hits / total : 0;
}
