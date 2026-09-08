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
  liveGateVerdict, settledGuidance, shouldAutoCapture, steadyWindow,
} from '../src/scan/capture.js';
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
