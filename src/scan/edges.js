// Live page-edge detection for the viewfinder.
//
// SCANNING_SYSTEM.md §3's container question is resolved as pure web — see the
// resolution note there. This is the honest web answer — no OpenCV, no
// six-week project, and no pretence that it is VisionKit — and it stays: the
// gap that actually mattered was the shutter grabbing a video frame instead of
// a real photographic still, which `capture.js` now fixes at the capture step
// rather than by replacing this detector.
//
// The first version of this thresholded on brightness and took the largest
// bright region. Tested against real frames from a real desk it failed on every
// one of them, and the reason is obvious in hindsight: a desk is full of bright
// things. A white page beside a pale blue folder on a cream floor is one
// connected bright blob, and its extreme corners are the corners of the folder.
//
// Three things separate a page from the rest of a desk, and this uses all of
// them, because any one alone is what produced that failure:
//
//   1. Paper is bright *and neutral*. The desk is brown, the folder is blue,
//      the floor is cream — all of them carry colour. Paper carries almost none.
//   2. A page is convex and rectangular. A region that sprawls across a page,
//      a folder and half a desk is neither, and comparing the region's own area
//      to the area of the quad drawn round it says so in one number.
//   3. A page has edges *inside the frame*. A region touching every border is
//      not a page we can see the shape of — it is a floor, and the honest answer
//      is that there is no page here.
//
// Detection runs on a small proxy of the frame, several times a second rather
// than every frame. The overlay is drawn every frame from the last known quad,
// so the brackets stay smooth on a mid-tier phone while the search costs little.

import { orderQuad, quadFill } from './geometry.js';
import { AXIS_TOLERANCE, MAX_LINES_PER_FAMILY, findLines, intersect, offAxis, paperScore } from './quad.js';

// Paper is the least colourful thing on a desk. Saturation above this is
// something else — a folder, a desk, a hand.
const PAPER_SATURATION_MAX = 0.30;
// A region has to fill this much of the quad drawn round it to be page-shaped.
// A page is convex and rectangular; a blob spanning a page and a folder is not.
const RECTANGULARITY_MIN = 0.78;
// Above this the "page" is the whole frame, which means its edges are not in
// shot. Nothing to deskew, and nothing to auto-capture.
const MAX_FILL = 0.92;

/** Otsu's threshold: the split that best separates the histogram into two lumps. */
export function otsu(gray) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++;

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumBackground = 0, weightBackground = 0, best = 0, bestVariance = -1;
  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (!weightBackground) continue;
    const weightForeground = total - weightBackground;
    if (!weightForeground) break;
    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground *
      (meanBackground - meanForeground) ** 2;
    if (variance > bestVariance) { bestVariance = variance; best = t; }
  }
  return best;
}

/**
 * Find the page in a frame.
 *
 * Returns a quad in the coordinates of the ImageData given, ordered tl, tr, br,
 * bl, or null when there is nothing convincing. Null is a normal outcome and the
 * caller must treat it as one: a viewfinder that insists it has found a page it
 * has not is worse than one that says nothing.
 */
export function detectQuad(img, { minFill = 0.16 } = {}) {
  const { width, height } = img;
  const lines = findLines(img);
  if (lines.length < 4) return null;

  // Split the candidates by which axis they run along. A page gives two lines
  // near each axis; a desk edge and a folder give more, which is why the pairing
  // below is a search rather than a pick.
  const vertical = [], horizontal = [];
  for (const line of lines) {
    if (offAxis(line.theta, 0) <= AXIS_TOLERANCE) {
      if (vertical.length < MAX_LINES_PER_FAMILY) vertical.push(line);
    } else if (offAxis(line.theta, THETA_QUARTER) <= AXIS_TOLERANCE) {
      if (horizontal.length < MAX_LINES_PER_FAMILY) horizontal.push(line);
    }
    if (vertical.length >= MAX_LINES_PER_FAMILY && horizontal.length >= MAX_LINES_PER_FAMILY) break;
  }
  if (vertical.length < 2 || horizontal.length < 2) return null;

  let best = null;
  const minSeparation = Math.min(width, height) * 0.3;

  for (let i = 0; i < vertical.length - 1; i++) {
    for (let j = i + 1; j < vertical.length; j++) {
      if (Math.abs(vertical[i].rho - vertical[j].rho) < minSeparation) continue;
      for (let k = 0; k < horizontal.length - 1; k++) {
        for (let l = k + 1; l < horizontal.length; l++) {
          if (Math.abs(horizontal[k].rho - horizontal[l].rho) < minSeparation) continue;

          const corners = [
            intersect(vertical[i], horizontal[k]), intersect(vertical[j], horizontal[k]),
            intersect(vertical[j], horizontal[l]), intersect(vertical[i], horizontal[l]),
          ];
          if (corners.some((c) => !c)) continue;
          // A corner far outside the frame means the page is not really in shot,
          // and the quad drawn from it would be a guess about what is off-screen.
          if (corners.some((c) => c.x < -width * 0.15 || c.x > width * 1.15 ||
                                  c.y < -height * 0.15 || c.y > height * 1.15)) continue;

          const quad = orderQuad(corners);
          const fill = quadFill(quad, width, height);
          if (fill < minFill) continue;
          if (!isPageShaped(quad, width, height)) continue;

          const paper = paperScore(img, quad);
          // How much of the inside is actually paper. This is the one signal
          // that separates a page from most of the rest of a desk: every real
          // page in bench/golden.test.mjs's fixtures scores 0.96 or better.
          //
          // It is not a clean separation, though — bench/golden.test.mjs also
          // pins a known false accept: a photo of an empty floor (no page in
          // shot at all) currently scores 0.92, comfortably over this line.
          // That was measured, not assumed, once golden.test.mjs made it
          // possible to run this against real fixtures as an actual check
          // rather than eyeballing bench/detect.html by hand — see that test
          // file for the up-to-date numbers and why closing this gap is
          // deferred rather than guessed at with a higher threshold here.
          //
          // A tone step across the edge looked like it should work too and does
          // not — it stays in the ranking score, where being wrong costs
          // nothing, and out of the gate, where it cost real pages.
          if (paper.paper < 0.85) continue;

          const votes = vertical[i].votes + vertical[j].votes +
                        horizontal[k].votes + horizontal[l].votes;
          // Edge strength decides between quads that all look like paper, and
          // the larger of two plausible pages wins ties — a page's own ruled
          // lines can otherwise carve a strong-edged box out of its middle.
          const score = paper.score * 2 + Math.min(1, votes / (Math.min(width, height) * 6)) + fill;
          if (!best || score > best.score) best = { quad, score };
        }
      }
    }
  }

  return best ? best.quad : null;
}

const THETA_QUARTER = 90;

/**
 * Is this quad plausibly a sheet of paper?
 *
 * Convex, filling enough of the frame, and with corners that are corners. The
 * check exists because the largest bright region in a frame is very often a
 * wall, a window, or a desk lamp, and all three produce a quad that is
 * geometrically fine and completely wrong.
 */
export function isPageShaped(quad, width, height) {
  const fill = quadFill(quad, width, height);
  if (fill < 0.18) return false;
  // A page filling the whole frame has no visible edges, so there is nothing
  // here that could be deskewed and nothing worth firing the shutter at.
  if (fill > MAX_FILL) return false;

  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4], c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false; // not convex

    const angle = cornerAngle(a, b, c);
    if (angle < 50 || angle > 135) return false;
  }

  // Opposite edges of a sheet are roughly the same length, however it is tilted.
  const len = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const top = len(quad[0], quad[1]), bottom = len(quad[3], quad[2]);
  const left = len(quad[0], quad[3]), right = len(quad[1], quad[2]);
  if (ratio(top, bottom) > 2.2 || ratio(left, right) > 2.2) return false;

  return true;
}

function cornerAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!mag) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

const ratio = (a, b) => (a > b ? a / b : b / a);

/** Scale a quad from proxy coordinates back to the frame it was found in. */
export function scaleQuad(quad, from, to) {
  const sx = to.width / from.width, sy = to.height / from.height;
  return quad.map((p) => ({ x: p.x * sx, y: p.y * sy }));
}

/**
 * Smooth the quad between detections.
 *
 * Corner positions jitter by a pixel or two frame to frame even on a still page,
 * and brackets that twitch read as the app being unsure. Easing toward each new
 * detection costs nothing and makes the overlay feel like it is tracking the
 * page rather than guessing at it.
 */
export function easeQuad(current, target, factor = 0.35) {
  if (!current) return target;
  if (!target) return current;
  return current.map((p, i) => ({
    x: p.x + (target[i].x - p.x) * factor,
    y: p.y + (target[i].y - p.y) * factor,
  }));
}
