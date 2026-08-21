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
import { shouldAutoCapture, steadyWindow } from '../src/scan/capture.js';
import { CAPTURE } from '../src/scan/contract.js';

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
  assert.equal(shouldAutoCapture({ ...ready, consecutiveFinds: 3 }), false);
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
