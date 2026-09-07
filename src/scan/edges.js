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
// Four things separate a page from the rest of a desk, and this uses all of
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
//   4. A page's interior is flat. A cream floor or a wooden desk can be as
//      bright and as colourless as paper, but not as smooth — grain, veining
//      and shadow put real variance into a handful of interior samples that a
//      blank sheet does not. This is what closes the gap #1-#3 left open: see
//      the texture gate in detectQuad() below.
//
// Detection runs on a small proxy of the frame, several times a second rather
// than every frame. The overlay is drawn every frame from the last known quad,
// so the brackets stay smooth on a mid-tier phone while the search costs little.

import { orderQuad, quadFill } from './geometry.js';
import { AXIS_TOLERANCE, MAX_LINES_PER_FAMILY, findLines, gradients, intersect, offAxis, paperScore } from './quad.js';
import { perimeterSupport, quadsFromEdges } from './contour.js';

// Paper is the least colourful thing on a desk. Saturation above this is
// something else — a folder, a desk, a hand.
const PAPER_SATURATION_MAX = 0.30;
// A region has to fill this much of the quad drawn round it to be page-shaped.
// A page is convex and rectangular; a blob spanning a page and a folder is not.
const RECTANGULARITY_MIN = 0.78;
// Above this the "page" is the whole frame, which means its edges are not in
// shot. Nothing to deskew, and nothing to auto-capture.
const MAX_FILL = 0.92;
// Standard deviation of interior brightness a page-shaped quad is allowed
// before it reads as textured surface rather than blank paper. See the gate
// in detectQuad() for where this number comes from.
const TEXTURE_MAX = 32;

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

  // One Sobel pass, two detectors. The gradient is the expensive part of both
  // searches and it is the same gradient, so it is computed here and handed
  // down rather than taken twice.
  const grad = gradients(img);

  let best = null;
  const consider = (quad, support) => {
    const verdict = gateQuad(img, quad, width, height, minFill);
    if (!verdict) return;
    // Edge strength decides between quads that all look like paper, and the
    // larger of two plausible pages wins ties — a page's own ruled lines can
    // otherwise carve a strong-edged box out of its middle.
    const score = verdict.paper.score * 2 + Math.min(1, support) + verdict.fill;
    if (!best || score > best.score) best = { quad, score };
  };

  // ── the line search ──────────────────────────────────────────────────────
  for (const found of quadsFromLines(img, grad, width, height)) {
    consider(found.quad, found.votes / (Math.min(width, height) * 6));
  }

  // ── the contour search ───────────────────────────────────────────────────
  // scan-ground-up-revamp Phase 2. Added alongside rather than in place of the
  // line search: it finds pages the line pairing structurally cannot (a page
  // at ~45°, where the ±40° axis split has nothing to pair; a page whose edge
  // fades through shadow, where a single global threshold drops it), and it
  // costs one extra pass over an already-computed gradient. Both feed the same
  // gate below, so a candidate that is not page-shaped, not paper, or textured
  // like a floor is refused on exactly the terms it always was.
  const { quads, edges } = quadsFromEdges(grad, width, height);
  for (const quad of quads) {
    consider(quad, perimeterSupport(edges, width, height, quad));
  }

  return best ? best.quad : null;
}

/**
 * Quad candidates from four fitted lines — the original search, unchanged in
 * substance and lifted out so the contour candidates can be scored beside it
 * rather than inside it.
 */
function quadsFromLines(img, grad, width, height) {
  const lines = findLines(img, grad);
  if (lines.length < 4) return [];

  const out = [];
  const minSeparation = Math.min(width, height) * 0.3;

  for (const [first, second] of orientationFamilies(lines)) {
    for (let i = 0; i < first.length - 1; i++) {
      for (let j = i + 1; j < first.length; j++) {
        if (Math.abs(first[i].rho - first[j].rho) < minSeparation) continue;
        for (let k = 0; k < second.length - 1; k++) {
          for (let l = k + 1; l < second.length; l++) {
            if (Math.abs(second[k].rho - second[l].rho) < minSeparation) continue;

            const corners = [
              intersect(first[i], second[k]), intersect(first[j], second[k]),
              intersect(first[j], second[l]), intersect(first[i], second[l]),
            ];
            if (corners.some((c) => !c)) continue;
            // A corner far outside the frame means the page is not really in shot,
            // and the quad drawn from it would be a guess about what is off-screen.
            if (corners.some((c) => c.x < -width * 0.15 || c.x > width * 1.15 ||
                                    c.y < -height * 0.15 || c.y > height * 1.15)) continue;

            out.push({
              quad: orderQuad(corners),
              votes: first[i].votes + first[j].votes + second[k].votes + second[l].votes,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Split the candidate lines into two roughly perpendicular families — the
 * pairing needs two of each, and a page supplies exactly that.
 *
 * The families used to be defined absolutely: "within ±40° of vertical" and
 * "within ±40° of horizontal". That silently made an assumption nobody had
 * written down — that the phone is held square to the page — and it fails
 * hardest exactly halfway between, at 45°, where a page's four edges land
 * 45° from *both* axes and are thrown out of both families. The lines are
 * found perfectly well; there is simply nothing left to pair them with.
 * bench/rotation-report.mjs is what made this visible: every fixture in the
 * corpus was photographed square-on, so no test could see it.
 *
 * So the split is relative now. The strongest few lines each take a turn as
 * the anchor, one family runs with the anchor and the other across it, and
 * the tolerance is 45° so that every angle lands in exactly one of the two —
 * no angle can fall between the families the way 45° used to.
 *
 * Trying several anchors rather than just the strongest line costs a handful
 * of extra pairings over at most seven lines a side, and buys the case where
 * the strongest line in the frame belongs to a desk edge rather than to the
 * page. Every candidate still goes through the same gate afterwards, so a
 * wrong anchor produces a quad that is refused, not a quad that is trusted.
 */
function orientationFamilies(lines) {
  const anchors = [];
  for (const line of lines) {
    if (anchors.length >= MAX_ANCHORS) break;
    // Two anchors 10° apart would produce near-identical families and the same
    // candidates twice over.
    if (anchors.some((a) => offAxis(line.theta, a) < ANCHOR_SPREAD)) continue;
    anchors.push(line.theta);
  }

  const families = [];
  for (const anchor of anchors) {
    const across = (anchor + THETA_QUARTER) % THETA_HALF_TURN;
    const first = [], second = [];
    for (const line of lines) {
      const toAnchor = offAxis(line.theta, anchor);
      const toAcross = offAxis(line.theta, across);
      if (toAnchor <= toAcross) {
        if (first.length < MAX_LINES_PER_FAMILY) first.push(line);
      } else if (second.length < MAX_LINES_PER_FAMILY) {
        second.push(line);
      }
    }
    if (first.length >= 2 && second.length >= 2) families.push([first, second]);
  }
  return families;
}

// How many of the strongest lines take a turn as the family anchor, and how
// far apart two anchors have to be to be worth trying separately.
const MAX_ANCHORS = 3;
const ANCHOR_SPREAD = 12;

/**
 * The gate every candidate passes through, whichever detector proposed it.
 *
 * One implementation on purpose: two detectors feeding two copies of these
 * thresholds is how the calibration in bench/golden.test.mjs would silently
 * come to mean two different things.
 *
 * Returns the measurements when the quad survives, null when it does not.
 */
function gateQuad(img, quad, width, height, minFill) {
  const fill = quadFill(quad, width, height);
  if (fill < minFill) return null;
  if (!isPageShaped(quad, width, height)) return null;

  const paper = paperScore(img, quad);
  // How much of the inside is actually paper. This is the strongest single
  // signal separating a page from most of the rest of a desk: every real page
  // in bench/golden.test.mjs's fixtures scores 0.96 or better.
  //
  // It is not a clean separation on its own, though — bench/golden.test.mjs
  // used to pin a known false accept here: a photo of an empty floor (no page
  // in shot at all) scores 0.92 on this alone, comfortably over the line. A
  // tone step across the edge looked like it should catch that and does not —
  // it stays in the ranking score, where being wrong costs nothing, and out of
  // the gate, where it cost real pages.
  if (paper.paper < 0.85) return null;
  // What actually separates the floor from a page is texture, not colour or
  // brightness: a floor's grain and veining put real variance into a 5x5 grid
  // even where it is bright and neutral enough to pass the check above, and a
  // page's blank interior does not. Measured on the real fixtures
  // (bench/golden.test.mjs): every genuine page scores under 23, and the floor
  // fixture that used to false-accept scores 50 — TEXTURE_MAX sits with margin
  // on both sides of that gap, not against a single number.
  if (paper.texture > TEXTURE_MAX) return null;

  return { fill, paper };
}

const THETA_QUARTER = 90;
// A line's angle wraps at 180°, not 360° — a line at 179° and one at 1° run
// almost together. Mirrors THETA_BINS in quad.js, which is where the angle
// bins are actually made.
const THETA_HALF_TURN = 180;

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
