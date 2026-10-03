// The lock — one idea: the same whole page, seen several times in a row.
//
// The previous tracker followed each corner separately and demanded every
// corner agree; a single weak corner dropped the lock, and on real camera frames
// it almost never held (AXO-144 diagnosis). This replaces all of that with a
// comparison of whole quads. A detection is "the same page" when its overlap
// with the page already being followed is high. Three in a row lock; a short gap
// is forgiven; a different page elsewhere in the frame replaces the old one only
// after it has been seen repeatedly.
//
// The lock only decides what the OVERLAY shows and when AUTO may fire. It has no
// say over the shutter: capture never depends on detection (Axon.md, scanner).
//
// All numbers here are first guesses on public-library output and are meant to
// be tuned once the R-13 phone corpus exists. They are exported so tests and the
// debug overlay read the same values the lock uses.
//
// Coordinates are normalised to the frame (0–1) so the lock is independent of
// the resolution each detection ran at.

export const LOCK = Object.freeze({
  /** Smallest page, as a share of the frame, worth following at all. */
  MIN_FILL: 0.05,
  /** Consecutive agreeing detections before the page counts as locked. */
  HITS_TO_LOCK: 3,
  /** Overlap (IoU) at which two detections are the same page. */
  SAME_PAGE_IOU: 0.8,
  /** How long the page may go undetected before the lock is let go. */
  MISS_GRACE_MS: 600,
  /** A locked page is only replaced after this many disagreeing detections. */
  DISAGREE_TO_REPLACE: 3,
  /** Overlap between successive smoothed quads above which the page counts as still. */
  SETTLED_IOU: 0.96,
  /** Share of each new detection blended into the followed quad. */
  SMOOTHING: 0.5,
});

/** @typedef {{x:number,y:number}} Point */
/** @typedef {[Point,Point,Point,Point]} Quad */

function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

// Sutherland–Hodgman: clip one convex polygon by another.
function clip(subject, clipper) {
  const ccw = signedArea(clipper) > 0;
  let output = subject;
  for (let i = 0; i < clipper.length && output.length; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length];
    const inside = (p) => {
      const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      return ccw ? c >= 0 : c <= 0;
    };
    const cut = (p, q) => {
      const dx1 = q.x - p.x, dy1 = q.y - p.y;
      const dx2 = b.x - a.x, dy2 = b.y - a.y;
      const d = dx1 * dy2 - dy1 * dx2;
      if (d === 0) return q;
      const t = ((a.x - p.x) * dy2 - (a.y - p.y) * dx2) / d;
      return { x: p.x + t * dx1, y: p.y + t * dy1 };
    };
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) output.push(cut(prev, cur));
        output.push(cur);
      } else if (inside(prev)) {
        output.push(cut(prev, cur));
      }
    }
  }
  return output;
}

/** Intersection-over-union of two convex quads. 1 = identical, 0 = disjoint. */
export function quadIoU(a, b) {
  const aa = area(a), bb = area(b);
  if (!(aa > 0 && bb > 0)) return 0;
  const overlap = clip(a, b);
  const inter = overlap.length >= 3 ? area(overlap) : 0;
  return inter / (aa + bb - inter);
}

const blend = (a, b, t) => a.map((p, i) => ({
  x: p.x + (b[i].x - p.x) * t,
  y: p.y + (b[i].y - p.y) * t,
}));

/**
 * @param {Partial<typeof LOCK>} [overrides]
 */
export function createLock(overrides = {}) {
  const cfg = { ...LOCK, ...overrides };
  /** @type {Quad|null} */ let anchor = null;
  let hits = 0;
  let disagree = 0;
  let lastSeen = 0;
  let stableSince = 0;
  let phase = 'searching';

  function reset() {
    anchor = null; hits = 0; disagree = 0; lastSeen = 0; stableSince = 0; phase = 'searching';
  }

  function snapshot(now) {
    return {
      phase,
      quad: anchor,
      hits,
      stableMs: phase === 'locked' ? Math.max(0, now - stableSince) : 0,
      unseenMs: anchor ? Math.max(0, now - lastSeen) : 0,
    };
  }

  /**
   * @param {number} now  ms, any monotonic clock
   * @param {Quad|null} quad  normalised detection, or null when nothing was found
   */
  function observe(now, quad) {
    const usable = Array.isArray(quad) && quad.length === 4 && area(quad) >= cfg.MIN_FILL;

    if (!usable) {
      if (anchor && now - lastSeen > cfg.MISS_GRACE_MS) reset();
      return snapshot(now);
    }

    if (!anchor) {
      anchor = quad; hits = 1; disagree = 0; lastSeen = now; stableSince = now;
      phase = 'candidate';
      return snapshot(now);
    }

    if (quadIoU(anchor, quad) >= cfg.SAME_PAGE_IOU) {
      const next = blend(anchor, quad, cfg.SMOOTHING);
      if (quadIoU(anchor, next) < cfg.SETTLED_IOU) stableSince = now;
      anchor = next; hits++; disagree = 0; lastSeen = now;
    } else if (phase === 'locked' && ++disagree < cfg.DISAGREE_TO_REPLACE) {
      // One odd detection does not throw away a page that has been steady.
    } else {
      anchor = quad; hits = 1; disagree = 0; lastSeen = now; stableSince = now;
    }
    phase = hits >= cfg.HITS_TO_LOCK ? 'locked' : 'candidate';
    return snapshot(now);
  }

  return { observe, reset, snapshot, config: cfg };
}
