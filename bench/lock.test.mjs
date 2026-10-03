// The whole-page lock (src/scan/lock.js): same page seen repeatedly, forgiving
// of short gaps, slow to change its mind, and never an input to the shutter.
//
//   node --test bench/lock.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCK, createLock, quadIoU } from '../src/scan/lock.js';

const rect = (x, y, w, h) => [
  { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
];
const PAGE = rect(0.15, 0.1, 0.7, 0.8);
const jitter = (q, d) => q.map((p, i) => ({ x: p.x + (i % 2 ? d : -d), y: p.y + (i < 2 ? d : -d) }));

test('quadIoU: identical = 1, disjoint = 0, half overlap = 1/3', () => {
  assert.equal(quadIoU(PAGE, PAGE), 1);
  assert.equal(quadIoU(rect(0, 0, 0.2, 0.2), rect(0.5, 0.5, 0.2, 0.2)), 0);
  const half = quadIoU(rect(0, 0, 1, 1), rect(0.5, 0, 1, 1));
  assert.ok(Math.abs(half - 1 / 3) < 1e-9, String(half));
});

test('quadIoU is order-direction independent (clockwise or anticlockwise)', () => {
  const rev = [...PAGE].reverse();
  assert.ok(Math.abs(quadIoU(PAGE, rev) - 1) < 1e-9);
});

test('three agreeing detections lock; two do not', () => {
  const lock = createLock();
  assert.equal(lock.observe(0, PAGE).phase, 'candidate');
  assert.equal(lock.observe(70, jitter(PAGE, 0.004)).phase, 'candidate');
  assert.equal(lock.observe(140, jitter(PAGE, 0.004)).phase, 'locked');
});

test('a tiny page is never followed', () => {
  const lock = createLock();
  for (let t = 0; t < 600; t += 70) {
    assert.equal(lock.observe(t, rect(0.4, 0.4, 0.1, 0.1)).phase, 'searching');
  }
});

test('a short gap is forgiven; a long one releases the lock', () => {
  const lock = createLock();
  for (let t = 0; t <= 140; t += 70) lock.observe(t, PAGE);
  assert.equal(lock.observe(400, null).phase, 'locked');
  assert.ok(lock.observe(400, null).quad, 'the followed quad is still reported during the gap');
  assert.equal(lock.observe(140 + LOCK.MISS_GRACE_MS + 50, null).phase, 'searching');
});

test('one odd detection does not shake a locked page; repeated ones replace it', () => {
  const lock = createLock();
  for (let t = 0; t <= 140; t += 70) lock.observe(t, PAGE);
  const other = rect(0.05, 0.05, 0.25, 0.25);
  assert.equal(lock.observe(210, other).phase, 'locked');
  assert.equal(lock.observe(280, other).phase, 'locked');
  const third = lock.observe(350, other);
  assert.equal(third.phase, 'candidate', 'third disagreement swaps to the new page as a fresh candidate');
  assert.ok(quadIoU(third.quad, other) > 0.99);
});

test('a candidate is replaced at once by a different page', () => {
  const lock = createLock();
  lock.observe(0, PAGE);
  const other = rect(0.05, 0.05, 0.3, 0.3);
  const snap = lock.observe(70, other);
  assert.equal(snap.phase, 'candidate');
  assert.equal(snap.hits, 1);
});

test('stableMs grows while the page is still and resets when it moves', () => {
  const lock = createLock();
  let snap;
  for (let t = 0; t <= 700; t += 70) snap = lock.observe(t, PAGE);
  assert.ok(snap.stableMs >= 500, `stable for ${snap.stableMs}`);
  const moved = rect(0.18, 0.13, 0.7, 0.8); // same page, nudged 3% of the frame
  snap = lock.observe(770, moved);
  assert.ok(snap.stableMs < 100, `moved page restarts stability: ${snap.stableMs}`);
});

test('smoothing moves the followed quad toward the detection, not onto it', () => {
  const lock = createLock();
  for (let t = 0; t <= 140; t += 70) lock.observe(t, PAGE);
  const nudged = jitter(PAGE, 0.02);
  const snap = lock.observe(210, nudged);
  const moved = Math.abs(snap.quad[0].x - PAGE[0].x);
  assert.ok(moved > 0 && moved < 0.02, `moved ${moved}`);
});

test('reset forgets everything', () => {
  const lock = createLock();
  for (let t = 0; t <= 140; t += 70) lock.observe(t, PAGE);
  lock.reset();
  const snap = lock.snapshot(500);
  assert.equal(snap.phase, 'searching');
  assert.equal(snap.quad, null);
});
