// Live page-edge detection for the viewfinder.
//
// SCANNING_SYSTEM.md §3 is blunt about the container: a PWA is the wrong place
// for a camera that is meant to be a differentiator, because both native
// platforms ship a document scanner that already does this well and on the web
// it is all yours to build. That decision is still open. Until it is made, this
// is the honest web answer — no OpenCV, no six-week project, and no pretence
// that it is VisionKit.
//
// The approach is the classic one and it holds up: a page is a bright region on
// a darker desk. Threshold it, take the largest region, and read the corners off
// that region's extremes. It fails cleanly on a white page on a white table,
// which is exactly when it should — no quad means no auto-capture, and the
// shutter is always there.
//
// Detection runs on a small proxy of the frame, several times a second rather
// than every frame. The overlay is drawn every frame from the last known quad,
// so the brackets stay smooth on a mid-tier phone while the search costs little.

import { connectedComponents } from './layers.js';
import { orderQuad, quadFill } from './geometry.js';

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
export function detectQuad(img, { minFill = 0.18 } = {}) {
  const { data, width, height } = img;
  const n = width * height;
  const gray = new Uint8ClampedArray(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    gray[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }

  const threshold = otsu(gray);
  // A page has to be meaningfully brighter than the surface under it. Where the
  // split is this weak there are not two things in frame, there is one.
  if (threshold < 30 || threshold > 225) return null;

  const bright = new Uint8Array(n);
  for (let p = 0; p < n; p++) bright[p] = gray[p] > threshold ? 1 : 0;

  const components = connectedComponents(bright, width, height, Math.round(n * 0.05));
  if (!components.length) return null;

  let page = components[0];
  for (const c of components) if (c.area > page.area) page = c;
  if (page.area / n < minFill) return null;

  // Corners as the extremes of x+y and x-y over the region's own pixels. On a
  // rotated page these are the true corners; on a page cut off by the frame edge
  // they collapse toward the frame, which the shape check below catches.
  let tl = null, tr = null, br = null, bl = null;
  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
  for (const p of page.pixels) {
    const x = p % width, y = (p / width) | 0;
    const sum = x + y, diff = x - y;
    if (sum < minSum) { minSum = sum; tl = { x, y }; }
    if (sum > maxSum) { maxSum = sum; br = { x, y }; }
    if (diff > maxDiff) { maxDiff = diff; tr = { x, y }; }
    if (diff < minDiff) { minDiff = diff; bl = { x, y }; }
  }
  if (!tl || !tr || !br || !bl) return null;

  const quad = orderQuad([tl, tr, br, bl]);
  return isPageShaped(quad, width, height) ? quad : null;
}

/**
 * Is this quad plausibly a sheet of paper?
 *
 * Convex, filling enough of the frame, and with corners that are corners. The
 * check exists because the largest bright region in a frame is very often a
 * wall, a window, or a desk lamp, and all three produce a quad that is
 * geometrically fine and completely wrong.
 */
export function isPageShaped(quad, width, height) {
  if (quadFill(quad, width, height) < 0.18) return false;

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
