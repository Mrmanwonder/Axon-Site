// The tracker, against corners whose answers are known exactly.
//
// Both modules under test are pure — `corner-search.js` takes an ImageData and
// gives back a point, `track.js` takes points and gives back state — so the
// whole of the tracking architecture can be checked here without a camera, a
// canvas or a browser. That is the reason they are pure.
//
// The synthetic corners are the important half. A tracker that cannot find a
// corner it was told the location and edge directions of is not going to find
// one on a desk, and a test that only exercised the state machine would let
// that through while looking thorough.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findCorner, strongestLine, intersectLines } from '../src/scan/corner-search.js';
import {
  CORNER_IDS, acquire, advanceState, coherentMotion, createTrack, documentConfidence,
  edgesFrom, geometryValid, needsGlobal, observe, poseOf, predict, quadOf, searchRadius,
} from '../src/scan/track.js';

// ── synthetic pixels ───────────────────────────────────────────────────────

/**
 * A page corner in a window: bright where the paper is, dark where the desk
 * is, meeting at (cx, cy). `quadrant` says which way the paper lies.
 */
function cornerImage(size, cx, cy, quadrant = 'br', { noise = 0 } = {}) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const right = x >= cx, below = y >= cy;
      const onPaper =
        quadrant === 'br' ? (right && below) :
        quadrant === 'bl' ? (!right && below) :
        quadrant === 'tr' ? (right && !below) : (!right && !below);
      let v = onPaper ? 232 : 64;
      if (noise) v += (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * noise;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

test('a horizontal page edge is found at the right offset', () => {
  const roi = cornerImage(64, -10, 30, 'br'); // paper fills below y=30
  // Edge line runs horizontally (0°), so its normal is 90°.
  const line = strongestLine(roi, 90);
  assert.ok(line, 'no horizontal edge found in an image that is half paper');
  assert.ok(Math.abs(line.rho - 30) <= 1.5, `edge found at ${line.rho}, expected ~30`);
});

test('a vertical page edge is found at the right offset', () => {
  const roi = cornerImage(64, 40, -10, 'br'); // paper fills right of x=40
  const line = strongestLine(roi, 0);
  assert.ok(line, 'no vertical edge found');
  assert.ok(Math.abs(line.rho - 40) <= 1.5, `edge found at ${line.rho}, expected ~40`);
});

test('two perpendicular lines intersect where they should', () => {
  const horizontal = { rho: 30, cos: Math.cos(Math.PI / 2), sin: Math.sin(Math.PI / 2) };
  const vertical = { rho: 40, cos: 1, sin: 0 };
  const point = intersectLines(horizontal, vertical);
  assert.ok(point);
  assert.ok(Math.abs(point.x - 40) < 0.001 && Math.abs(point.y - 30) < 0.001,
    `intersected at ${point.x},${point.y}`);
});

test('near-parallel lines do not produce a corner', () => {
  const a = { rho: 10, cos: 1, sin: 0 };
  const b = { rho: 40, cos: Math.cos(0.05), sin: Math.sin(0.05) };
  assert.equal(intersectLines(a, b), null);
});

for (const [dx, dy] of [[32, 32], [24, 40], [40, 24], [30, 34]]) {
  test(`a top-left page corner at (${dx},${dy}) is located to within a pixel or two`, () => {
    const roi = cornerImage(64, dx, dy, 'br');
    // Top edge runs 0°, left edge runs 90°.
    const found = findCorner(roi, { edgeA: 0, edgeB: 90 });
    assert.ok(found, 'no corner found in a clean synthetic corner');
    assert.ok(Math.hypot(found.x - dx, found.y - dy) <= 2.5,
      `found (${found.x.toFixed(1)},${found.y.toFixed(1)}), expected (${dx},${dy})`);
    assert.ok(found.confidence > 0.4, `confidence ${found.confidence} on a clean corner`);
  });
}

test('a corner survives moderate sensor noise', () => {
  const roi = cornerImage(64, 32, 32, 'br', { noise: 26 });
  const found = findCorner(roi, { edgeA: 0, edgeB: 90 });
  assert.ok(found, 'noise lost a corner that is plainly there');
  assert.ok(Math.hypot(found.x - 32, found.y - 32) <= 3.5,
    `found (${found.x.toFixed(1)},${found.y.toFixed(1)}) under noise`);
});

test('a window with no corner in it reports nothing rather than a guess', () => {
  const flat = { data: new Uint8ClampedArray(64 * 64 * 4).fill(200), width: 64, height: 64 };
  for (let i = 3; i < flat.data.length; i += 4) flat.data[i] = 255;
  assert.equal(findCorner(flat, { edgeA: 0, edgeB: 90 }), null,
    'blank paper produced a corner');
});

test('a single edge with no second edge is not a corner', () => {
  const roi = cornerImage(64, -10, 32, 'br'); // one horizontal edge, nothing vertical
  const found = findCorner(roi, { edgeA: 0, edgeB: 90 });
  assert.equal(found, null, 'one edge was reported as a corner');
});

test('the edge of the window is not mistaken for the edge of the page', () => {
  // The window boundary is the strongest straight step in any crop — the Sobel
  // pass has nothing to read past it — and it lies exactly parallel to the page
  // edge being hunted. Before this was excluded, every corner in every window
  // was found at (width-2, height-2) and the tracker followed the crop instead
  // of the paper.
  const paper = { data: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64 };
  for (let i = 0; i < paper.data.length; i += 4) {
    paper.data[i] = paper.data[i + 1] = paper.data[i + 2] = 232;
    paper.data[i + 3] = 255;
  }
  const line = strongestLine(paper, 90);
  assert.ok(!line || line.support < 0.22,
    `blank paper reported an edge at rho ${line?.rho} with support ${line?.support}`);
  assert.equal(findCorner(paper, { edgeA: 0, edgeB: 90 }), null);
});

test('noisy blank paper is still blank', () => {
  // The weaker version of the same failure: with no real edge in the window,
  // whatever noise happens to be strongest must not be promoted to one.
  const roi = cornerImage(64, -10, -10, 'br', { noise: 30 }); // all paper, no edge
  assert.equal(findCorner(roi, { edgeA: 0, edgeB: 90 }), null,
    'sensor noise was read as a page corner');
});

test('one window does not answer for the next', () => {
  // `gradients()` and the rho accumulator both reuse their buffers between
  // calls without clearing them, and four corners are searched back to back on
  // every frame. A corner that read its neighbour's pixels would track a page
  // that is not there.
  const first = cornerImage(64, 20, 20, 'br');
  const second = cornerImage(64, 44, 44, 'br');
  const a = findCorner(first, { edgeA: 0, edgeB: 90 });
  const b = findCorner(second, { edgeA: 0, edgeB: 90 });
  const bAlone = findCorner(cornerImage(64, 44, 44, 'br'), { edgeA: 0, edgeB: 90 });
  assert.ok(a && b && bAlone);
  assert.ok(Math.hypot(b.x - bAlone.x, b.y - bAlone.y) < 0.001,
    `searching after another window moved the answer to (${b.x},${b.y})`);
  assert.ok(Math.hypot(b.x - 44, b.y - 44) <= 2.5);
});

// ── the track ──────────────────────────────────────────────────────────────

const squareQuad = (x, y, w, h) => ([
  { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
]);

const observeAll = (track, quad, now, confidence = 0.9) => observe(track, {
  topLeft: { ...quad[0], confidence },
  topRight: { ...quad[1], confidence },
  bottomRight: { ...quad[2], confidence },
  bottomLeft: { ...quad[3], confidence },
}, now, { width: 640, height: 480 });

test('acquiring a quad creates four independent corners', () => {
  const track = acquire(createTrack(), squareQuad(100, 100, 200, 260), 1000, { width: 640, height: 480 });
  assert.deepEqual(Object.keys(track.corners).sort(), [...CORNER_IDS].sort());
  assert.equal(track.state, 'locking', 'a single global quad is a candidate, not a lock');
  assert.ok(quadOf(track), 'the quad reads back out');
});

test('a lock is reached quickly once the corners agree', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 260), 1000, { width: 640, height: 480 });
  track = observeAll(track, squareQuad(100, 100, 200, 260), 1016);
  assert.equal(track.state, 'tracking', 'locking should not need a long stabilisation period');
});

test('velocity is per millisecond, so frame interval does not change the prediction', () => {
  let slow = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  slow = observeAll(slow, squareQuad(120, 100, 200, 200), 100); // 20px over 100ms

  let fast = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  fast = observeAll(fast, squareQuad(104, 100, 200, 200), 20);  // 4px over 20ms — same speed

  const a = predict(slow, 150).topLeft;
  const b = predict(fast, 70).topLeft;
  assert.ok(Math.abs((a.x - 120) - (b.x - 104)) < 1.5,
    'the same physical speed predicted differently at different frame rates');
});

test('time zero is a clock reading like any other', () => {
  // Timestamps were tested for truthiness, so a track acquired at t=0 believed
  // it had never acquired anything: it invented a frame interval, and — worse —
  // `needsGlobal` compared a NaN and answered no, which would have left a
  // scanner started at time zero never once looking for a page.
  const early = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  const later = acquire(createTrack(), squareQuad(100, 100, 200, 200), 9000, { width: 640, height: 480 });
  const a = observeAll(early, squareQuad(110, 100, 200, 200), 50).corners.topLeft;
  const b = observeAll(later, squareQuad(110, 100, 200, 200), 9050).corners.topLeft;
  assert.equal(a.velocity.x, b.velocity.x, 'the epoch changed the measured speed');

  assert.equal(needsGlobal(createTrack(), 0), true,
    'a scanner that has never detected anything declined to look');
});

test('§C: one lost corner does not destroy the document track', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 260), 0, { width: 640, height: 480 });
  const quad = squareQuad(100, 100, 200, 260);
  track = observeAll(track, quad, 16);

  // The bottom-left corner goes under a finger for a while; the others hold.
  for (let i = 0; i < 6; i++) {
    track = observe(track, {
      topLeft: { ...quad[0], confidence: 0.9 },
      topRight: { ...quad[1], confidence: 0.9 },
      bottomRight: { ...quad[2], confidence: 0.9 },
      bottomLeft: null,
    }, 32 + i * 16, { width: 640, height: 480 });
  }

  assert.notEqual(track.state, 'searching', 'a covered corner threw away the whole page');
  assert.equal(track.corners.topLeft.state, 'tracking');
  assert.ok(['uncertain', 'reacquiring', 'lost'].includes(track.corners.bottomLeft.state));
  assert.ok(quadOf(track), 'the quad is still available for the overlay');
});

test('§18: a corner with no evidence is filled in from the other three, and flagged', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  const quad = squareQuad(100, 100, 200, 200);
  for (let i = 0; i < 8; i++) {
    track = observe(track, {
      topLeft: { ...quad[0], confidence: 0.95 },
      topRight: { ...quad[1], confidence: 0.95 },
      bottomRight: { ...quad[2], confidence: 0.95 },
      bottomLeft: null,
    }, 16 + i * 16, { width: 640, height: 480 });
  }
  const bl = track.corners.bottomLeft;
  assert.equal(bl.predictedOnly, true, 'a geometric guess must not read as observed evidence');
  // TL + (BR - TR) completes the parallelogram: (100,100) + (300-300, 300-100).
  assert.ok(Math.hypot(bl.position.x - 100, bl.position.y - 300) < 12,
    `filled corner at ${bl.position.x},${bl.position.y}, expected near 100,300`);
});

test('§21: confidence recovers faster than it decays', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  const quad = squareQuad(100, 100, 200, 200);
  track = observeAll(track, quad, 16, 0.95);
  const strong = track.corners.topLeft.confidence;

  // One miss.
  track = observe(track, { topLeft: null, topRight: { ...quad[1], confidence: 0.9 },
    bottomRight: { ...quad[2], confidence: 0.9 }, bottomLeft: { ...quad[3], confidence: 0.9 } },
    32, { width: 640, height: 480 });
  const afterMiss = track.corners.topLeft.confidence;
  const lost = strong - afterMiss;

  // One good frame back.
  track = observeAll(track, quad, 48, 0.95);
  const regained = track.corners.topLeft.confidence - afterMiss;

  assert.ok(lost > 0, 'a miss should cost confidence');
  assert.ok(regained > lost * 0.9,
    `recovery (${regained.toFixed(3)}) should not be slower than decay (${lost.toFixed(3)})`);
});

test('§20: confidence does not fall from full to nothing on one bad frame', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  track = observeAll(track, squareQuad(100, 100, 200, 200), 16, 1);
  track = observe(track, { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null },
    32, { width: 640, height: 480 });
  assert.ok(track.corners.topLeft.confidence > 0.3,
    'one blurred frame wiped out a corner that was certain a frame ago');
  assert.notEqual(track.state, 'searching');
});

test('§15: coherent movement of all four corners is read as the phone moving', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  track = observeAll(track, squareQuad(100, 100, 200, 200), 16);
  const shifted = squareQuad(120, 110, 200, 200);
  const shared = coherentMotion(track, {
    topLeft: shifted[0], topRight: shifted[1], bottomRight: shifted[2], bottomLeft: shifted[3],
  });
  assert.ok(shared);
  assert.ok(Math.abs(shared.dx - 20) < 0.01 && Math.abs(shared.dy - 10) < 0.01);

  track = observeAll(track, shifted, 32);
  assert.equal(track.state, 'tracking', 'coherent motion should not disturb the track');
  assert.ok(track.confidence > 0.6);
});

test('§16: one corner disagreeing with the other three is damped, not trusted', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  const quad = squareQuad(100, 100, 200, 200);
  track = observeAll(track, quad, 16, 0.95);
  const before = track.corners.topRight.confidence;

  // Three corners hold still; the top-right claims to have jumped 80px.
  track = observe(track, {
    topLeft: { ...quad[0], confidence: 0.95 },
    topRight: { x: quad[1].x - 80, y: quad[1].y + 30, confidence: 0.95 },
    bottomRight: { ...quad[2], confidence: 0.95 },
    bottomLeft: { ...quad[3], confidence: 0.95 },
  }, 32, { width: 640, height: 480 });

  assert.ok(track.corners.topRight.confidence < before,
    'an incoherent jump was accepted at full confidence');
  assert.ok(track.corners.topLeft.confidence >= before - 0.05,
    'the corners that behaved should not be punished for the one that did not');
});

test('§22: the search radius grows when confidence falls and when the page moves fast', () => {
  const still = { velocity: { x: 0, y: 0 }, confidence: 0.95, lastSeen: 1000 };
  const shaky = { velocity: { x: 0, y: 0 }, confidence: 0.2, lastSeen: 1000 };
  const quick = { velocity: { x: 1.6, y: 0.9 }, confidence: 0.95, lastSeen: 1000 };
  assert.ok(searchRadius(shaky, 1000) > searchRadius(still, 1000));
  assert.ok(searchRadius(quick, 1000) > searchRadius(still, 1000));
});

test('§14: a bowtie is not a valid document however confident its corners are', () => {
  const track = createTrack();
  const crossed = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }];
  crossed.forEach((p, i) => {
    track.corners[CORNER_IDS[i]] = {
      id: CORNER_IDS[i], position: p, previousPosition: p, predictedPosition: p,
      velocity: { x: 0, y: 0 }, confidence: 0.99, state: 'tracking', lostFrames: 0,
      lastSeen: 0, searchRadius: 32, predictedOnly: false,
    };
  });
  assert.equal(geometryValid(track, 640, 480), false, 'a self-crossing quad passed as a page');
});

test('§68: a healthy track almost never asks for the global detector', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 260), 0, { width: 640, height: 480 });
  const quad = squareQuad(100, 100, 200, 260);
  let globals = 0;
  let now = 0;
  // Three seconds of ordinary tracking at 60fps.
  for (let i = 0; i < 180; i++) {
    now += 16.7;
    if (needsGlobal(track, now)) { globals++; track.lastGlobalDetection = now; }
    const drift = squareQuad(100 + i * 0.4, 100 + i * 0.2, 200, 260);
    track = observeAll(track, drift, now);
  }
  assert.equal(track.state, 'tracking');
  assert.ok(globals <= 1,
    `${globals} global searches during three seconds of clean tracking — the point is that this is rare`);
});

test('a page genuinely removed does end the track', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  track = observeAll(track, squareQuad(100, 100, 200, 200), 16);
  let now = 32;
  for (let i = 0; i < 40; i++) {
    track = observe(track, { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null },
      now += 16, { width: 640, height: 480 });
  }
  assert.equal(track.state, 'searching', 'the page was taken away and the tracker held on anyway');
  assert.ok(needsGlobal(track, now + 1000), 'and it should be looking for a new one');
});

test('§32: reacquiring the same page keeps the track rather than starting over', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  track = observeAll(track, squareQuad(100, 100, 200, 200), 16);
  // The global detector re-fires on a barely-moved page.
  track = acquire(track, squareQuad(106, 104, 200, 200), 200, { width: 640, height: 480 });
  assert.equal(track.state, 'tracking', 'a re-detection of the same page dropped back to locking');
});

test('a different page entirely is a new document', () => {
  let track = acquire(createTrack(), squareQuad(60, 60, 80, 80), 0, { width: 640, height: 480 });
  track = observeAll(track, squareQuad(60, 60, 80, 80), 16);
  track = acquire(track, squareQuad(320, 300, 260, 160), 200, { width: 640, height: 480 });
  assert.equal(track.state, 'locking', 'a plainly different quad was adopted as the same page');
});

test('the pose reports something a stability check can use', () => {
  let track = acquire(createTrack(), squareQuad(100, 100, 200, 260), 0, { width: 640, height: 480 });
  const pose = poseOf(track);
  assert.ok(Math.abs(pose.centroid.x - 200) < 0.01 && Math.abs(pose.centroid.y - 230) < 0.01);
  assert.ok(Math.abs(pose.area - 200 * 260) < 1);
  assert.ok(Math.abs(pose.rotation) < 0.01, 'an axis-aligned page should read as unrotated');
});

test('edges know which corners they run between', () => {
  const track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  const edges = edgesFrom(track.corners);
  assert.equal(edges.top.startCorner, 'topLeft');
  assert.equal(edges.top.endCorner, 'topRight');
  assert.ok(Math.abs(edges.top.angle) < 0.01, 'the top edge of a square page runs flat');
  assert.ok(Math.abs(edges.left.angle - -90) < 0.01 || Math.abs(edges.left.angle - 270) < 0.01);
});

test('document confidence is dragged down by its worst corner', () => {
  const track = acquire(createTrack(), squareQuad(100, 100, 200, 200), 0, { width: 640, height: 480 });
  for (const id of CORNER_IDS) track.corners[id].confidence = 0.95;
  const allGood = documentConfidence(track);
  track.corners.bottomLeft.confidence = 0.2;
  const oneBad = documentConfidence(track);
  assert.ok(oneBad < allGood - 0.25,
    'three good corners and one on the desk edge is not a three-quarters-good page');
});
