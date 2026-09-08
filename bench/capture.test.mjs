// Tests for the two decisions that made auto-capture never fire.
//
// Both were wrong in a way that no amount of reading caught and a phone found in
// seconds: the page was detected, the gate was clear, and the shutter simply
// never went. A camera is a bad place to discover that twice, so the decisions
// are pure functions now and this is what holds them.
//
//   node --test bench/capture.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUIDANCE_DWELL_MS, GUIDANCE_HYSTERESIS,
  liveGateVerdict, settledGuidance, shouldAutoCapture, stabApply, stabiliseStep, steadyWindow,
} from '../src/scan/capture.js';
import { easeQuad } from '../src/scan/edges.js';
import { CAPTURE, CONDITIONING, QUALITY } from '../src/scan/contract.js';

const W = 240, H = 320;
// A page quad, and the same page with every corner nudged by `px`.
const page = (px = 0) => [
  { x: 40 + px, y: 60 + px }, { x: 200 - px, y: 62 + px },
  { x: 198 - px, y: 280 - px }, { x: 42 + px, y: 278 - px },
];

test('a first sighting opens the window rather than closing it', () => {
  const w = steadyWindow({ anchor: null, found: page(), width: W, height: H, since: 0, now: 1000 });
  assert.equal(w.steady, false);
  assert.equal(w.since, 1000);
  assert.deepEqual(w.anchor, page());
});

test('jitter around one pose keeps the clock running', () => {
  // Three pixels of wobble — the amount that used to reset the clock every
  // single search, which is why the hint sat on "Hold still" indefinitely.
  let w = steadyWindow({ anchor: null, found: page(), width: W, height: H, since: 0, now: 0 });
  for (let t = 100; t <= CAPTURE.STABILITY_MS; t += 100) {
    w = steadyWindow({
      anchor: w.anchor, found: page(t % 200 === 0 ? 3 : -3),
      width: W, height: H, since: w.since, now: t,
    });
    assert.equal(w.since, 0, `the window restarted at t=${t}`);
  }
  assert.equal(w.steady, true);
});

test('real movement restarts the window', () => {
  const opened = steadyWindow({ anchor: null, found: page(), width: W, height: H, since: 0, now: 0 });
  // Well past the tolerance: the phone moved, not the estimate.
  const moved = steadyWindow({
    anchor: opened.anchor, found: page(30), width: W, height: H, since: opened.since, now: 400,
  });
  assert.equal(moved.since, 400);
  assert.equal(moved.steady, false);
});

test('the window closes only after the full stability period', () => {
  const opened = steadyWindow({ anchor: null, found: page(), width: W, height: H, since: 0, now: 0 });
  const early = steadyWindow({
    anchor: opened.anchor, found: page(1), width: W, height: H,
    since: opened.since, now: CAPTURE.STABILITY_MS - 1,
  });
  assert.equal(early.steady, false);
  const due = steadyWindow({
    anchor: opened.anchor, found: page(1), width: W, height: H,
    since: opened.since, now: CAPTURE.STABILITY_MS,
  });
  assert.equal(due.steady, true);
});

// ── the shutter decision ───────────────────────────────────────────────────

const ready = {
  autoCapture: true, armed: true, blocking: null,
  steady: true, heldFor: 5000, consecutiveFinds: 8,
};

test('a steady unblocked page fires', () => {
  assert.equal(shouldAutoCapture(ready), true);
});

test('anything blocking holds the shutter', () => {
  assert.equal(shouldAutoCapture({ ...ready, blocking: 'glare' }), false);
});

test('auto off, or already fired, holds the shutter', () => {
  assert.equal(shouldAutoCapture({ ...ready, autoCapture: false }), false);
  assert.equal(shouldAutoCapture({ ...ready, armed: false }), false);
});

test('one lucky detection is not enough', () => {
  assert.equal(shouldAutoCapture({ ...ready, consecutiveFinds: 1 }), false);
  // Pinned against the constant rather than a literal, so raising the run
  // length (§7.3 asks for about five) cannot leave this test silently
  // asserting something weaker than what the phone requires.
  assert.equal(shouldAutoCapture({ ...ready, consecutiveFinds: CAPTURE.CONSECUTIVE_FINDS - 1 }), false);
  assert.equal(shouldAutoCapture({ ...ready, consecutiveFinds: CAPTURE.CONSECUTIVE_FINDS }), true);
});

test('a tracker that is not sure yet holds the shutter', () => {
  // The run-length guard used to carry this alone: five *searches* in a row
  // meant five independent whole-frame detections agreeing. Once the tracker
  // took over, five frames became five extrapolations of one detection over
  // eighty milliseconds, which is not the same evidence at all. 'tracking' is
  // the state reached only when all four corners have been found separately
  // and agree on a document-shaped quad, so it is what the guard rests on now.
  for (const state of ['searching', 'locking', 'reacquiring', 'recovering']) {
    assert.equal(shouldAutoCapture({ ...ready, trackState: state }), false,
      `the shutter fired while the tracker was still ${state}`);
  }
  assert.equal(shouldAutoCapture({ ...ready, trackState: 'tracking' }), true);
});

test('a page held long enough fires even if it never reads as steady', () => {
  const restless = { ...ready, steady: false };
  assert.equal(shouldAutoCapture({ ...restless, heldFor: 0 }), false);
  assert.equal(shouldAutoCapture({ ...restless, heldFor: CAPTURE.PATIENCE_MS - 1 }), false);
  assert.equal(shouldAutoCapture({ ...restless, heldFor: CAPTURE.PATIENCE_MS }), true);
});

test('patience does not override the gate', () => {
  assert.equal(
    shouldAutoCapture({ ...ready, steady: false, heldFor: 60000, blocking: 'focus' }),
    false,
  );
});

// ── the live gate's own verdict ─────────────────────────────────────────────
// Extracted out of capture.js's step() so it can be checked directly, and so
// bench/verdict-agreement.mjs is comparing the actual decision a phone makes
// against scorePage()'s final verdict — not a hand-copied reimplementation of
// it that could quietly drift.

// Every signal comfortably inside its "ok" band — nothing should block or
// even earn advice beyond steadiness.
const clean = {
  glare: 0, clipping: 0, fill: CAPTURE.MIN_FILL + 0.1, sharpness: QUALITY.BLUR_WARN + 0.1,
  skew: 0, pageLongEdge: CONDITIONING.MIN_LONG_EDGE + 100, steady: true,
};

test('every signal clean and steady reads Ready', () => {
  assert.deepEqual(liveGateVerdict(clean), { blocking: null, hint: 'Ready' });
});

test('not yet steady, otherwise clean, blocks nothing but says so', () => {
  const v = liveGateVerdict({ ...clean, steady: false });
  assert.equal(v.blocking, null);
  assert.equal(v.hint, 'Hold still');
});

// Resolution comes first now, and it is a block rather than advice — the two
// changes are one change (AXON_FIX_BRIEF.md §7.3). A page that will land under
// CONDITIONING.MIN_LONG_EDGE is a page `acceptPage` refuses outright, so saying
// so while moving the phone closer still fixes it is the entire argument for
// having a live gate. Blocking here still never touches the shutter — it
// withholds *auto*-capture, and the student can always take the shot.
test('a page that will land under the capture floor blocks, ahead of every other check', () => {
  const v = liveGateVerdict({
    ...clean, pageLongEdge: CONDITIONING.MIN_LONG_EDGE - 1,
    glare: 1, clipping: 1, fill: 0, sharpness: 0, skew: 999, steady: false,
  });
  assert.equal(v.blocking, 'resolution');
});

test('too far away blocks on distance, once resolution is clear', () => {
  const v = liveGateVerdict({ ...clean, fill: CAPTURE.MIN_FILL - 0.01 });
  assert.equal(v.blocking, 'distance');
});

test('glare over the live line blocks, ahead of exposure and focus', () => {
  const v = liveGateVerdict({
    ...clean, glare: QUALITY.GLARE_WARN + 0.001, clipping: 1, sharpness: 0, skew: 999, steady: false,
  });
  assert.equal(v.blocking, 'glare');
});

test('a uniformly over-exposed page blocks on exposure, which glare cannot see', () => {
  const v = liveGateVerdict({ ...clean, clipping: QUALITY.CLIP_WARN + 0.001 });
  assert.equal(v.blocking, 'exposure');
  assert.match(v.hint, /bright/i);
});

test('soft focus blocks, once resolution, distance and exposure are clear', () => {
  const v = liveGateVerdict({ ...clean, sharpness: QUALITY.BLUR_WARN - 0.01 });
  assert.equal(v.blocking, 'focus');
});

// Null is "we could not measure this", not "this is zero". The focus window
// lands on blank paper often enough that treating the two the same would refuse
// a lightly-written page for being lightly written.
test('an unmeasurable focus window does not block', () => {
  const v = liveGateVerdict({ ...clean, sharpness: null });
  assert.equal(v.blocking, null);
  assert.equal(v.hint, 'Ready');
});

test('skew past the warn line is advisory, never blocking', () => {
  const v = liveGateVerdict({ ...clean, skew: QUALITY.SKEW_WARN_DEG + 1 });
  assert.equal(v.blocking, null);
  assert.match(v.hint, /square/i);
});

test('a page just over the floor is not blocked on resolution', () => {
  const v = liveGateVerdict({ ...clean, pageLongEdge: CONDITIONING.MIN_LONG_EDGE });
  assert.equal(v.blocking, null);
});

// ── guidance that does not nag ──────────────────────────────────────────────
//
// The gate is consulted every frame now rather than a dozen times a second,
// which made two latent problems into visible ones. A measurement sitting on
// a threshold does not produce one answer, it produces both, alternating; and
// a line of advice that changes several times a second is not advice.

test('a measurement sitting on the line does not answer twice', () => {
  // Right on the distance threshold, where a hand-held phone crosses back and
  // forth on ordinary jitter.
  const onTheLine = { ...clean, fill: CAPTURE.MIN_FILL };
  // Nothing showing: the plain reading, which is that this is fine.
  assert.equal(liveGateVerdict(onTheLine).blocking, null);
  // Already warning about distance: it stays, because coming back to exactly
  // the line is not evidence that anything changed.
  assert.equal(liveGateVerdict(onTheLine, 'distance').blocking, 'distance');
  // And it goes as soon as the page is genuinely clear of the line.
  const clear = { ...clean, fill: CAPTURE.MIN_FILL * (1 + GUIDANCE_HYSTERESIS) + 0.001 };
  assert.equal(liveGateVerdict(clear, 'distance').blocking, null);
});

test('the margin only ever delays leaving a warning, never entering one', () => {
  // Holding a different reason must not soften this one.
  const soft = { ...clean, sharpness: QUALITY.BLUR_WARN - 0.001 };
  assert.equal(liveGateVerdict(soft, 'distance').blocking, 'focus');
  assert.equal(liveGateVerdict(soft, null).blocking, 'focus');
});

test('one warning replacing another waits long enough to be read', () => {
  const showing = { hint: 'Move closer so the page fills more of the frame', blocking: 'distance', since: 1000 };
  const glare = { hint: 'Light is bouncing off the page — tilt it slightly away from the light', blocking: 'glare' };
  assert.equal(settledGuidance(showing, glare, 1000 + GUIDANCE_DWELL_MS - 1).hint, showing.hint);
  assert.equal(settledGuidance(showing, glare, 1000 + GUIDANCE_DWELL_MS).hint, glare.hint);
});

test('starting to block, and stopping, are both immediate', () => {
  // Into a blocked state: `blocking` is what holds the automatic shutter, so a
  // page that has just gone soft has to stop it on that frame.
  const fine = { hint: 'Ready', blocking: null, since: 1000 };
  const soft = { hint: 'Hold still — the page is not sharp yet', blocking: 'focus' };
  assert.equal(settledGuidance(fine, soft, 1001).blocking, 'focus');

  // Out of one: the student has just fixed it and should be told at once.
  const showing = { hint: 'Move closer so the page fills more of the frame', blocking: 'distance', since: 1000 };
  assert.equal(settledGuidance(showing, { hint: 'Ready', blocking: null }, 1001).hint, 'Ready');
});

test('an unchanged hint does not restart its own clock', () => {
  // Otherwise a hint that is genuinely steady would never age past the dwell,
  // and the next one that needed to replace it never could.
  const showing = { hint: 'Hold still', blocking: null, since: 1000 };
  assert.equal(settledGuidance(showing, { hint: 'Hold still', blocking: null }, 5000).since, 1000);
});

// ── the brackets: deadzone and adaptive damping ────────────────────────────
//
// scan-tracking-zoom-stability-2026-09-08 §2/§3. A fixed-factor lerp did both
// of these jobs badly at once, and the two complaints it produced were
// "the bracket trembles when my hand does" and "it moves a certain distance
// and then seems to stall".

const FRAME = { width: 480, height: 640 };

test('a deliberate reframe is answered on the first frame, not the ninth', () => {
  // The whole page moves a fifth of the frame — the student turned to the next
  // one. The fixed 0.35 lerp this replaced gave that the same gentle catch-up
  // it gave a millimetre of wobble, which is what "it moves a certain distance
  // and then stalls" was describing. The first frame is the one that matters:
  // it is where the difference between sluggish and responsive is felt.
  const from = page();
  const to = from.map((p) => ({ x: p.x + 96, y: p.y }));
  const closed = (easeQuad(from, to, FRAME)[0].x - from[0].x) / 96;
  assert.ok(closed > 0.8,
    `closed only ${(closed * 100).toFixed(0)}% of a full reframe on the first frame`);
  // ...and it is still all the way there shortly after, rather than approaching
  // forever.
  let at = from;
  for (let i = 0; i < 8; i++) at = easeQuad(at, to, FRAME);
  assert.ok(Math.abs(to[0].x - at[0].x) < 96 * 0.03,
    'eight frames on and the reframe has still not landed');
});

test('a small correction stays damped', () => {
  // Nothing like a reframe: this must still be eased rather than snapped, or
  // every detection wobble would land on screen at full amplitude.
  const from = page();
  const to = from.map((p) => ({ x: p.x + 12, y: p.y }));
  const moved = easeQuad(from, to, FRAME)[0].x - from[0].x;
  assert.ok(moved > 0 && moved < 12 * 0.35,
    `moved ${moved.toFixed(1)}px of 12 in one frame — that is a snap, not damping`);
});

test('easing always converges, never parks short of the page', () => {
  // The first attempt at tremor rejection put a deadzone here, comparing the
  // target against where the brackets already were — which froze them wherever
  // the gap happened to fall under it, a permanent visible offset rather than a
  // still bracket. Rejecting tremor is capture.js's job, using the steady
  // window's anchor; this function's job is to arrive.
  const from = page();
  const to = from.map((p) => ({ x: p.x + 96, y: p.y }));
  let at = from;
  for (let i = 0; i < 40; i++) at = easeQuad(at, to, FRAME);
  assert.ok(Math.abs(to[0].x - at[0].x) < 0.01,
    `parked ${Math.abs(to[0].x - at[0].x).toFixed(2)}px short of the page`);
});

test('a target that does not move lets the brackets come to rest', () => {
  // What capture.js hands this while the page is held still: the steady
  // window's anchor, unchanged frame after frame. The brackets must settle on
  // it and stop, which is the whole of "the bracket does not tremble".
  const held = page();
  let at = page(6);
  for (let i = 0; i < 40; i++) at = easeQuad(at, held, FRAME);
  assert.ok(Math.hypot(at[0].x - held[0].x, at[0].y - held[0].y) < 0.01,
    'the brackets never came to rest on a page that never moved');
});

test('without a frame size the old fixed factor still applies', () => {
  // Callers with no frame to measure a share of keep exactly the behaviour they
  // had, rather than silently getting a different curve in a unit nobody told
  // this function about.
  const from = page();
  const to = from.map((p) => ({ x: p.x + 100, y: p.y }));
  assert.equal(easeQuad(from, to)[0].x, from[0].x + 35);
});

// ── the pinch-zoom guard ───────────────────────────────────────────────────

test('a pinched viewport holds the shutter', () => {
  // scan-tracking-zoom-stability-2026-09-08 §1. Every screen-space number the
  // decision rests on was measured through a mapping the pinch broke, so the
  // one thing that must not happen is a photograph of a frame nobody could see
  // straight. The gesture is blocked at source; this is the backstop.
  assert.equal(shouldAutoCapture({ ...ready, viewportScaled: true }), false);
  assert.equal(shouldAutoCapture({ ...ready, viewportScaled: false }), true);
});

// ── preview stabilisation ──────────────────────────────────────────────────
//
// scan-digital-stabilization-2026-09-08. Render the video a little larger than
// its viewport and pan it against the shake, so tremor moves the cropped-off
// margin instead of the page.

const MARGIN = { x: 16, y: 16 };
const start = { slow: null, velocity: { x: 0, y: 0 }, previous: null, pan: { x: 0, y: 0 } };

test('the first frame sets the baseline and pans nothing', () => {
  const s = stabiliseStep(start, { x: 100, y: 200 }, 16, MARGIN);
  assert.deepEqual(s.slow, { x: 100, y: 200 });
  assert.deepEqual(s.pan, { x: 0, y: 0 });
});

// Physiological hand tremor is a few hertz — 4 to 12 — not a flip every frame,
// and modelling it as the latter tests a signal no hand produces and no
// follower should chase.
const tremorAt = (frame, { hz = 8, amplitude = 6, fps = 60 } = {}) =>
  Math.sin((2 * Math.PI * hz * frame) / fps) * amplitude;

test('tremor is cancelled, and against the page rather than with it', () => {
  let s = stabiliseStep(start, { x: 100, y: 100 }, 16, MARGIN);
  let worstResidual = 0;
  for (let i = 0; i < 120; i++) {
    const shake = tremorAt(i);
    s = stabiliseStep(s, { x: 100 + shake, y: 100 }, 16, MARGIN);
    // What the student is left looking at: the page's own displacement plus the
    // pan applied to cancel it. Only measured once the filter has settled.
    if (i > 40) worstResidual = Math.max(worstResidual, Math.abs(shake + s.pan.x));
  }
  assert.ok(worstResidual < 6 * 0.7,
    `6px of tremor still reads as ${worstResidual.toFixed(2)}px on screen`);
});

test('a deliberate sweep is not fought for long', () => {
  // A page carried steadily across the frame: a position-only filter lags a
  // ramp by velocity times its time constant *permanently*, which pinned the
  // pan at the margin for the whole sweep and left nothing to absorb the
  // tremor riding on top of it. Tracking velocity is what fixes that.
  let r = stabiliseStep(start, { x: 0, y: 0 }, 16, MARGIN);
  for (let i = 1; i <= 120; i++) r = stabiliseStep(r, { x: i * 2, y: 0 }, 16, MARGIN);
  assert.ok(Math.abs(r.pan.x) < MARGIN.x * 0.4,
    `two seconds into a steady sweep the pan is still leaning ${Math.abs(r.pan.x).toFixed(1)}px`);
});

test('the pan never exceeds the overscan margin', () => {
  // A shake bigger than the margin still shows — that is the honest limit of
  // something this cheap — but it must never pan past the margin and expose
  // the edge of the frame.
  let s = stabiliseStep(start, { x: 0, y: 0 }, 16, MARGIN);
  for (let i = 0; i < 60; i++) s = stabiliseStep(s, { x: i % 2 ? 400 : -400, y: 0 }, 16, MARGIN);
  assert.ok(Math.abs(s.pan.x) <= MARGIN.x + 1e-9,
    `panned ${s.pan.x.toFixed(1)}px past a ${MARGIN.x}px margin`);
});

test('losing the page relaxes the pan rather than freezing it', () => {
  let s = stabiliseStep(start, { x: 0, y: 0 }, 16, MARGIN);
  for (let i = 0; i < 20; i++) s = stabiliseStep(s, { x: i % 2 ? 40 : -40, y: 0 }, 16, MARGIN);
  const held = Math.abs(s.pan.x);
  for (let i = 0; i < 20; i++) s = stabiliseStep(s, null, 16, MARGIN);
  assert.ok(Math.abs(s.pan.x) < held * 0.05,
    'the pan stayed leaning after the page went away');
});

test('the filter reads the same at any frame rate', () => {
  // The coefficient comes from the real interval, because camera frames do not
  // arrive on a schedule and a fixed one would make the time constant whatever
  // the frame rate happened to be.
  let fast = stabiliseStep(start, { x: 0, y: 0 }, 8, MARGIN);
  for (let i = 0; i < 60; i++) fast = stabiliseStep(fast, { x: 100, y: 0 }, 8, MARGIN);
  let slow = stabiliseStep(start, { x: 0, y: 0 }, 32, MARGIN);
  for (let i = 0; i < 15; i++) slow = stabiliseStep(slow, { x: 100, y: 0 }, 32, MARGIN);
  assert.ok(Math.abs(fast.slow.x - slow.slow.x) < 2,
    `the same half-second of motion filtered to ${fast.slow.x.toFixed(1)} at 125fps and ${slow.slow.x.toFixed(1)} at 31fps`);
});

test('the brackets carry exactly the transform the video carries', () => {
  // The regression this test exists for: a bracket that was correct before
  // stabilisation and drifts off the page after it is worse than the tremor.
  // `translate(pan) scale(zoom)` about the element centre composes as "scale
  // about the centre, then shift", and the overlay must do the same.
  const box = { width: 400, height: 800, zoom: 1.08, pan: { x: 12, y: -7 } };
  // The centre only moves by the pan.
  assert.deepEqual(stabApply({ x: 200, y: 400 }, box), { x: 212, y: 393 });
  // A corner scales about that centre, then shifts.
  assert.deepEqual(stabApply({ x: 0, y: 0 }, box), { x: 200 - 200 * 1.08 + 12, y: 400 - 400 * 1.08 - 7 });
  // With no zoom and no pan it is the identity, so an un-stabilised build maps
  // exactly as it always did.
  assert.deepEqual(
    stabApply({ x: 37, y: 91 }, { ...box, zoom: 1, pan: { x: 0, y: 0 } }),
    { x: 37, y: 91 });
});
