// Stage 0 · document tracking.
//
// The difference this file exists to make, in one line: detection asks "where
// is the page?", tracking asks "I knew where the page was 16ms ago — where did
// it move?". The scanner used to ask the first question, from scratch, several
// times a second, and ask it about the entire frame. Between answers it had
// nothing to say, which is why the overlay let go of the paper whenever the
// phone moved and why finding it again looked like starting over.
//
// So the page stops being a quad that gets recomputed and becomes four corners
// that persist. Each one carries its own position, velocity, confidence and
// state, and each one can be lost and recovered without the other three
// noticing. A hand over the bottom-left corner is one corner reacquiring, not
// a document lost.
//
// Everything here is pure — no DOM, no canvas, no camera. It takes positions
// and observations in and gives positions and states out, which is what makes
// the whole tracker testable in Node without a browser. The pixels are
// somebody else's problem: capture.js cuts the search windows, corner-search.js
// looks inside them, and this decides what the answers mean.
//
// Coordinates: everything in here is in ONE space, whatever the caller chose,
// and it must be the same space for the whole life of a track. capture.js
// tracks in video pixels — see the note on coordinate spaces there.

import { orderQuad, quadFill } from './geometry.js';

/** @typedef {'topLeft'|'topRight'|'bottomRight'|'bottomLeft'} CornerId */

export const CORNER_IDS = /** @type {const} */ ([
  'topLeft', 'topRight', 'bottomRight', 'bottomLeft',
]);

// The quad order everything else in the pipeline uses — orderQuad returns
// tl, tr, br, bl, and scaleQuad/quadFill/warpPerspective all assume it. The
// corner ids are that same order by name, so the two can be converted without
// anybody having to remember which index is which.
const QUAD_ORDER = CORNER_IDS;

// ── confidence dynamics ────────────────────────────────────────────────────
//
// Deliberately asymmetric (§21). Losing a corner should be gradual, because a
// single blurred frame is not evidence the page has gone; regaining one should
// be quick, because a corner that is plainly visible again should not have to
// serve a sentence of twenty good frames before the overlay trusts it. Slow
// down, fast up.
const DECAY_PER_MISS = 0.62;
const RECOVER = 0.55;
// Below this a corner is no longer steering the quad on its own.
const TRACKING_MIN = 0.55;
const UNCERTAIN_MIN = 0.3;
const LOST_MIN = 0.12;
// How many consecutive misses before a corner is declared lost regardless of
// where its confidence happens to have decayed to.
const MAX_LOST_FRAMES = 12;

// ── search radius (§22) ────────────────────────────────────────────────────
const RADIUS_MIN = 28;
const RADIUS_MAX = 160;
// How far ahead of the predicted position the search has to reach to cover the
// distance the corner is currently travelling per frame.
const RADIUS_MOTION_FACTOR = 2.4;

// A velocity older than this is stale — the phone has been still, or the track
// has been idle, and carrying the old vector forward would fling the predicted
// position off the page.
const VELOCITY_STALE_MS = 250;
// Nothing is allowed to predict further ahead than this, however fast the last
// two frames suggested the corner was moving.
const MAX_PREDICT_MS = 120;

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A document track that has not found anything yet.
 *
 * `searching` is a real state and not an error: it is what the scanner is
 * doing before the first page appears, and what it returns to only when a page
 * is genuinely gone (§88) rather than merely blurred or briefly covered.
 */
export function createTrack() {
  return {
    corners: /** @type {Record<CornerId, any>} */ ({}),
    edges: {},
    state: 'searching',
    confidence: 0,
    // Null, not zero, and everything below tests for null rather than for
    // truthiness. A timestamp is a clock reading, and zero is a perfectly
    // ordinary one — a track started at time zero that treated its own
    // acquisition as "never happened" would compute the first frame interval
    // against a made-up number and hand the corners a velocity nobody
    // measured. That is only invisible in the browser because
    // `performance.now()` has already advanced by the time a camera starts.
    lastGlobalDetection: null,
    lastFrame: null,
    motion: { dx: 0, dy: 0, scale: 1, rotation: 0 },
    /** Frames since the track last had a usable pose, for the grace period. */
    graceFrames: 0,
  };
}

function makeCorner(id, point, now) {
  return {
    id,
    position: { x: point.x, y: point.y },
    previousPosition: { x: point.x, y: point.y },
    predictedPosition: { x: point.x, y: point.y },
    velocity: { x: 0, y: 0 },
    confidence: 0.5,
    state: 'tracking',
    lostFrames: 0,
    lastSeen: now,
    searchRadius: RADIUS_MIN,
    edgeDirectionA: null,
    edgeDirectionB: null,
    /** True when this position came from the other three rather than from
        pixels — §18: a prediction is never confirmed evidence. */
    predictedOnly: false,
  };
}

/**
 * Adopt a quad from the global detector.
 *
 * Called on first acquisition and on recovery. On recovery the existing track
 * is kept if the new quad is plainly the same piece of paper (§32) — a
 * document that was briefly lost and found again is the same document, and
 * throwing away its history would discard the velocity that makes the next
 * frame's prediction good.
 */
export function acquire(track, quad, now, { width, height } = {}) {
  const ordered = orderQuad(quad.map((p) => ({ x: p.x, y: p.y })));
  const sameDocument = track.state !== 'searching' && isSameDocument(track, ordered, width, height);

  for (let i = 0; i < 4; i++) {
    const id = QUAD_ORDER[i];
    const point = ordered[i];
    const existing = track.corners[id];
    if (sameDocument && existing) {
      // Keep the corner and its history; move it onto the fresh observation.
      existing.previousPosition = { ...existing.position };
      existing.position = { x: point.x, y: point.y };
      existing.predictedPosition = { x: point.x, y: point.y };
      existing.confidence = Math.max(existing.confidence, 0.75);
      existing.state = 'tracking';
      existing.lostFrames = 0;
      existing.lastSeen = now;
      existing.predictedOnly = false;
    } else {
      track.corners[id] = makeCorner(id, point, now);
    }
  }

  track.edges = edgesFrom(track.corners);
  // `locking` rather than `tracking` (§85): a quad from one global pass is a
  // candidate, and the next frame or two of local evidence is what turns it
  // into a lock. Fast, but not instant.
  track.state = sameDocument ? 'tracking' : 'locking';
  track.lastGlobalDetection = now;
  track.lastFrame = now;
  track.graceFrames = 0;
  track.confidence = documentConfidence(track);
  return track;
}

/**
 * Is this new quad the page we were already tracking?
 *
 * Compared on pose rather than on corner identity, because a page that moved
 * while it was lost is still that page. Deliberately generous: the cost of
 * being wrong is a track that keeps a little stale velocity, and the cost of
 * being too strict is throwing away the history on every recovery.
 */
export function isSameDocument(track, ordered, width, height) {
  const before = poseOf(track);
  if (!before) return false;
  const after = poseOfQuad(ordered);
  const scale = Math.max(1, Math.min(width || 0, height || 0) || 1);

  const moved = dist(before.centroid, after.centroid) / scale;
  const areaRatio = before.area > 0 && after.area > 0
    ? Math.max(before.area, after.area) / Math.min(before.area, after.area)
    : Infinity;
  const turned = Math.abs(angleDelta(before.rotation, after.rotation));

  return moved < 0.35 && areaRatio < 2.2 && turned < 35;
}

/**
 * Where each corner should be now, from where it was and how it was moving.
 *
 * Constant velocity, on purpose (§8): it is fast, deterministic and easy to
 * reason about when it is wrong, and nothing measured so far justifies a
 * Kalman filter. Velocity is per millisecond and the step is the real elapsed
 * time, because camera frames do not arrive on a fixed interval (§92) and
 * treating them as though they do makes the prediction wrong in exactly the
 * moments — a dropped frame, a slow frame — when it matters most.
 */
export function predict(track, now) {
  const out = /** @type {Record<CornerId, {x:number,y:number}>} */ ({});
  for (const id of CORNER_IDS) {
    const corner = track.corners[id];
    if (!corner) continue;
    const since = corner.lastSeen == null ? 0 : now - corner.lastSeen;
    const step = Math.max(0, Math.min(MAX_PREDICT_MS, since));
    // A corner nobody has seen for a while has a velocity that describes the
    // past, not the present. Coasting on it would throw the search window
    // somewhere the corner has never been.
    const stale = since > VELOCITY_STALE_MS;
    const vx = stale ? 0 : corner.velocity.x;
    const vy = stale ? 0 : corner.velocity.y;
    corner.predictedPosition = {
      x: corner.position.x + vx * step,
      y: corner.position.y + vy * step,
    };
    out[id] = corner.predictedPosition;
  }
  return out;
}

/**
 * How big a window this corner's search should cut, in the tracking space.
 *
 * Grows when confidence falls and when the corner is moving fast (§22, §23) —
 * a corner travelling twelve pixels a frame cannot be found in a window eight
 * pixels wide, and rapid movement is the case where losing the page feels
 * worst.
 */
export function searchRadius(corner, now) {
  const speed = Math.hypot(corner.velocity.x, corner.velocity.y); // px per ms
  const perFrame = speed * 16.7;
  const fromConfidence = RADIUS_MIN + (1 - clamp01(corner.confidence)) * (RADIUS_MAX - RADIUS_MIN) * 0.7;
  const fromMotion = perFrame * RADIUS_MOTION_FACTOR;
  const stale = corner.lastSeen != null && now - corner.lastSeen > VELOCITY_STALE_MS;
  const radius = Math.max(fromConfidence, stale ? RADIUS_MIN : fromMotion);
  return Math.round(Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, radius)));
}

/**
 * Fold this frame's observations into the track.
 *
 * `observations` is keyed by corner id; a null means the search looked and
 * found nothing there, which is different from not having looked. Both are
 * handled, and neither is allowed to end the track on its own.
 */
export function observe(track, observations, now, { width, height } = {}) {
  // Null on the first frame after acquisition, where there is no interval to
  // divide by. Guessing one — assuming sixty frames a second, say — turns a
  // measured displacement into a velocity that was never observed, and the
  // first frame of a track is exactly when the phone is still being raised.
  const elapsed = track.lastFrame == null ? null : Math.max(1, now - track.lastFrame);

  // Coherence first (§15/§16): a displacement every corner shares is the phone
  // moving, and a displacement only one corner claims is that corner being
  // wrong. Knowing which is which before trusting any of them is what stops a
  // single false edge dragging a corner off the page.
  const shared = coherentMotion(track, observations);

  for (const id of CORNER_IDS) {
    const corner = track.corners[id];
    if (!corner) continue;
    const seen = observations ? observations[id] : undefined;

    if (seen && Number.isFinite(seen.x) && Number.isFinite(seen.y)) {
      const moved = { x: seen.x - corner.position.x, y: seen.y - corner.position.y };
      // How far this corner's motion departs from what the others agreed on.
      const departure = shared
        ? Math.hypot(moved.x - shared.dx, moved.y - shared.dy)
        : 0;
      const scale = Math.max(24, Math.hypot(shared?.dx ?? 0, shared?.dy ?? 0) * 2 + 24);
      const coherence = clamp01(1 - departure / (scale * 2));
      const evidence = clamp01((seen.confidence ?? 0.6) * (0.55 + 0.45 * coherence));

      corner.previousPosition = { ...corner.position };
      corner.position = { x: seen.x, y: seen.y };
      corner.velocity = elapsed == null ? { x: 0, y: 0 } : {
        x: (corner.position.x - corner.previousPosition.x) / elapsed,
        y: (corner.position.y - corner.previousPosition.y) / elapsed,
      };
      corner.confidence = clamp01(corner.confidence + (evidence - corner.confidence) * RECOVER);
      corner.lostFrames = 0;
      corner.lastSeen = now;
      corner.predictedOnly = false;
      if (seen.edgeDirectionA != null) corner.edgeDirectionA = seen.edgeDirectionA;
      if (seen.edgeDirectionB != null) corner.edgeDirectionB = seen.edgeDirectionB;
    } else {
      // Nothing found. Coast on the prediction and let confidence fall — but
      // keep the corner, because the page has not gone anywhere just because
      // one window came back empty.
      corner.previousPosition = { ...corner.position };
      corner.position = { ...corner.predictedPosition };
      corner.confidence = clamp01(corner.confidence * DECAY_PER_MISS);
      corner.lostFrames++;
      corner.predictedOnly = true;
    }
    corner.state = cornerState(corner);
    corner.searchRadius = searchRadius(corner, now);
  }

  // A corner with nothing left to say gets its position from the other three
  // (§18) rather than drifting on a stale velocity. It stays flagged as
  // predicted, so nothing downstream mistakes it for something we saw.
  fillFromGeometry(track);
  track.edges = edgesFrom(track.corners);
  track.motion = shared
    ? { ...track.motion, dx: shared.dx, dy: shared.dy }
    : track.motion;
  track.lastFrame = now;
  track.confidence = documentConfidence(track);
  advanceState(track, { width, height });
  return track;
}

/** The displacement the corners agree on, or null when they plainly do not. */
export function coherentMotion(track, observations) {
  const deltas = [];
  for (const id of CORNER_IDS) {
    const corner = track.corners[id];
    const seen = observations ? observations[id] : undefined;
    if (!corner || !seen || !Number.isFinite(seen.x)) continue;
    deltas.push({ dx: seen.x - corner.position.x, dy: seen.y - corner.position.y });
  }
  if (deltas.length < 2) return null;

  // The median rather than the mean, so one corner that has jumped to a false
  // edge cannot drag the shared estimate along with it.
  const dx = median(deltas.map((d) => d.dx));
  const dy = median(deltas.map((d) => d.dy));
  return { dx, dy, samples: deltas.length };
}

function cornerState(corner) {
  if (corner.lostFrames >= MAX_LOST_FRAMES || corner.confidence < LOST_MIN) return 'lost';
  if (corner.confidence < UNCERTAIN_MIN) return 'reacquiring';
  if (corner.confidence < TRACKING_MIN) return 'uncertain';
  return 'tracking';
}

/**
 * Rebuild a hopeless corner from the three that are still good.
 *
 * A parallelogram completion: BR ≈ TL + (TR − TL) + (BL − TL). It is a
 * temporary stand-in and is marked as one — the moment the pixels have
 * something to say about that corner again, the observation replaces it.
 */
export function fillFromGeometry(track) {
  const good = CORNER_IDS.filter((id) => {
    const c = track.corners[id];
    return c && !c.predictedOnly && c.state !== 'lost';
  });
  if (good.length !== 3) return track;

  const missing = CORNER_IDS.find((id) => !good.includes(id));
  const corner = track.corners[missing];
  if (!corner) return track;

  // The corner opposite the missing one, and the two adjacent to it.
  const opposite = CORNER_IDS[(CORNER_IDS.indexOf(missing) + 2) % 4];
  const adjacentA = CORNER_IDS[(CORNER_IDS.indexOf(missing) + 1) % 4];
  const adjacentB = CORNER_IDS[(CORNER_IDS.indexOf(missing) + 3) % 4];
  const o = track.corners[opposite]?.position;
  const a = track.corners[adjacentA]?.position;
  const b = track.corners[adjacentB]?.position;
  if (!o || !a || !b) return track;

  corner.position = { x: a.x + b.x - o.x, y: a.y + b.y - o.y };
  corner.predictedOnly = true;
  return track;
}

/** The four edges, as the pairs of corners they actually run between (§13). */
export function edgesFrom(corners) {
  const spec = [
    ['top', 'topLeft', 'topRight'],
    ['right', 'topRight', 'bottomRight'],
    ['bottom', 'bottomRight', 'bottomLeft'],
    ['left', 'bottomLeft', 'topLeft'],
  ];
  const out = {};
  for (const [id, startCorner, endCorner] of spec) {
    const a = corners[startCorner], b = corners[endCorner];
    if (!a || !b) continue;
    const angle = Math.atan2(b.position.y - a.position.y, b.position.x - a.position.x) * 180 / Math.PI;
    const confidence = Math.min(a.confidence, b.confidence);
    out[id] = {
      id, startCorner, endCorner,
      angle,
      confidence,
      support: dist(a.position, b.position),
      state: confidence >= TRACKING_MIN ? 'tracking' : confidence >= UNCERTAIN_MIN ? 'uncertain' : 'lost',
    };
  }
  return out;
}

/** The current quad, in the tracker's own space, ordered tl, tr, br, bl. */
export function quadOf(track) {
  const quad = QUAD_ORDER.map((id) => track.corners[id]?.position);
  return quad.every(Boolean) ? quad.map((p) => ({ x: p.x, y: p.y })) : null;
}

// Which two edges meet at each corner. The local search needs both of their
// directions, because "find these two specific lines" is the whole reason it
// is cheap — see corner-search.js.
const CORNER_EDGES = {
  topLeft: ['top', 'left'],
  topRight: ['top', 'right'],
  bottomRight: ['right', 'bottom'],
  bottomLeft: ['bottom', 'left'],
};

/**
 * Where to look for each corner on this frame, and what to look for.
 *
 * Everything the per-frame search needs and nothing about how it is run:
 * a square window in the tracker's own space, clamped to the frame, and the
 * directions of the two edges that meet inside it. Keeping this here rather
 * than in capture.js is what lets the window geometry be tested against
 * synthetic tracks instead of only against a camera.
 *
 * `size` is one number for all four windows on purpose. The four are cut as
 * tiles of a single readback, and a uniform tile is what makes that one
 * readback rather than four; a corner that wants a bigger window is a corner
 * in trouble, which is exactly when spending a little more on the other three
 * is the right trade.
 */
export function searchWindows(track, now, { width, height, minSize = 32, maxSize = 128 } = {}) {
  const predicted = predict(track, now);
  const edges = edgesFrom(track.corners);

  let radius = 0;
  for (const id of CORNER_IDS) {
    const corner = track.corners[id];
    if (corner) radius = Math.max(radius, searchRadius(corner, now));
  }
  if (!radius) return [];

  // A multiple of eight keeps the tiles aligned and the sub-image copies on
  // whole rows.
  const size = Math.max(minSize, Math.min(maxSize, Math.ceil(radius * 2 / 8) * 8));

  const windows = [];
  for (const id of CORNER_IDS) {
    const corner = track.corners[id];
    const centre = predicted[id];
    if (!corner || !centre) continue;
    const [edgeA, edgeB] = CORNER_EDGES[id];
    // Fall back to the corner's own remembered directions when an edge is
    // missing — which happens when the corner at the far end of it is gone.
    const a = edges[edgeA]?.angle ?? corner.edgeDirectionA;
    const b = edges[edgeB]?.angle ?? corner.edgeDirectionB;
    if (a == null || b == null) continue;

    // Clamped, so a corner near the frame edge still gets a full window —
    // an off-centre corner is what `centrality` is for, and a truncated
    // window would instead quietly change what the search is measuring.
    const sx = Math.round(Math.max(0, Math.min((width ?? size) - size, centre.x - size / 2)));
    const sy = Math.round(Math.max(0, Math.min((height ?? size) - size, centre.y - size / 2)));
    windows.push({ id, sx, sy, size, edgeA: a, edgeB: b });
  }
  return windows;
}

/** Centroid, area, aspect and rotation — the pose everything else reads (§25). */
export function poseOf(track) {
  const quad = quadOf(track);
  return quad ? poseOfQuad(quad) : null;
}

export function poseOfQuad(quad) {
  const centroid = {
    x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
    y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
  };
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  const top = dist(quad[0], quad[1]), bottom = dist(quad[3], quad[2]);
  const left = dist(quad[0], quad[3]), right = dist(quad[1], quad[2]);
  const w = (top + bottom) / 2, h = (left + right) / 2;
  return {
    centroid,
    area: Math.abs(area / 2),
    aspect: h > 0 ? w / h : 0,
    // The top edge's angle stands for the document's, which is what makes a
    // rotating phone read as rotation rather than as four corners going wrong.
    rotation: Math.atan2(quad[1].y - quad[0].y, quad[1].x - quad[0].x) * 180 / Math.PI,
    width: w,
    height: h,
  };
}

/**
 * Is the quad still a quadrilateral a page could be?
 *
 * The geometric half of §14. Corners are observed independently, and
 * independence without a constraint is how four points drift into a bowtie
 * while each one insists it is doing fine.
 */
export function geometryValid(track, width, height) {
  const quad = quadOf(track);
  if (!quad) return false;

  // Convex, in order, and no crossed edges.
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4], c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }

  const pose = poseOfQuad(quad);
  if (!(pose.width > 8 && pose.height > 8)) return false;
  // Opposite edges of a sheet stay comparable however it is tilted.
  const ratio = (a, b) => (a > b ? a / b : b / a);
  if (ratio(dist(quad[0], quad[1]), dist(quad[3], quad[2])) > 2.6) return false;
  if (ratio(dist(quad[0], quad[3]), dist(quad[1], quad[2])) > 2.6) return false;

  if (width && height) {
    const fill = quadFill(quad, width, height);
    if (fill < 0.02 || fill > 1.6) return false;
  }
  return true;
}

/**
 * One number for the document, from the four corners and their edges (§107).
 *
 * The weakest corner counts for more than the average, because a quad is only
 * as good as its worst corner — three perfect corners and one on the desk edge
 * is not a three-quarters-correct page.
 */
export function documentConfidence(track) {
  const values = CORNER_IDS.map((id) => track.corners[id]?.confidence ?? 0);
  if (!values.length) return 0;
  const mean = values.reduce((t, n) => t + n, 0) / values.length;
  const worst = Math.min(...values);
  return clamp01(mean * 0.45 + worst * 0.55);
}

/**
 * Move the document's own state on, with the grace period §105/§106 require.
 *
 * The transition this function exists to make hard is TRACKING → SEARCHING.
 * Everything above conspires to keep a track alive through a bad frame, and
 * this is the last place that could throw it away anyway.
 */
export function advanceState(track, { width, height } = {}) {
  const states = CORNER_IDS.map((id) => track.corners[id]?.state ?? 'lost');
  const lost = states.filter((s) => s === 'lost').length;
  const weak = states.filter((s) => s === 'lost' || s === 'reacquiring').length;
  const valid = geometryValid(track, width, height);

  if (lost === 4 || (!valid && weak >= 2)) {
    track.graceFrames++;
    // Even total loss gets a couple of frames — a single motion-blurred frame
    // can take every corner at once and be over before the next one.
    track.state = track.graceFrames > 3 ? 'searching' : 'recovering';
    if (track.state === 'searching') track.corners = {};
    return track;
  }

  track.graceFrames = 0;
  if (lost >= 2 || !valid) track.state = 'recovering';
  else if (weak >= 1) track.state = 'reacquiring';
  else if (track.state === 'locking') {
    // A lock is earned by every corner agreeing at once, not by waiting.
    track.state = track.confidence >= 0.6 && valid ? 'tracking' : 'locking';
  } else track.state = 'tracking';
  return track;
}

/**
 * Should the global detector run this frame?
 *
 * The whole point of the file is that the answer is usually no (§28, §68). It
 * is yes while there is nothing to track, when the track has genuinely come
 * apart, and — rarely — as a slow background re-check that a healthy track has
 * not quietly drifted onto the wrong rectangle.
 */
export function needsGlobal(track, now, { idleMs = 900, refreshMs = 4000 } = {}) {
  // Never detected anything yet, so the answer is yes and there is no interval
  // to measure. Falling through would subtract null and compare a NaN, which
  // is false for every operator and would leave a fresh scanner never once
  // looking for a page.
  if (track.lastGlobalDetection == null) return true;
  if (track.state === 'searching') return now - track.lastGlobalDetection >= idleMs;
  if (track.state === 'recovering') return now - track.lastGlobalDetection >= idleMs;
  // A tracking page is re-checked occasionally and cheaply, so a track that has
  // slid onto a notebook edge cannot stay there indefinitely.
  return now - track.lastGlobalDetection >= refreshMs;
}

/** Smallest signed difference between two angles in degrees. */
export function angleDelta(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function median(ns) {
  const sorted = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
