// The pure decisions inside the capture controller (src/scan/capture.js): which
// part of the video the student can see, when Auto may fire, and what counts as
// a page found "with evidence" on the photograph.
//
//   node --test bench/capture.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FINE_SCORE, coverCropRect, fitLongEdge, isVerifiedQuad, judgeStillGeometry,
  shouldAutoCapture, shutterQuadConfidence,
} from '../src/scan/capture.js';
import { CAPTURE } from '../src/scan/contract.js';

test('portrait object-fit cover searches the same source crop the student sees', () => {
  const crop = coverCropRect(1280, 720, 390, 844);
  assert.ok(crop.x > 400, `expected landscape side margins to be cropped, got x=${crop.x}`);
  assert.equal(crop.y, 0);
  assert.equal(crop.height, 720);
  assert.ok(Math.abs(crop.width / crop.height - 390 / 844) < 0.001);
});

test('a wider-than-source view crops top and bottom instead', () => {
  const crop = coverCropRect(720, 1280, 800, 400);
  assert.equal(crop.x, 0);
  assert.ok(crop.y > 0);
  assert.equal(crop.width, 720);
});

test('degenerate sizes never produce a zero or NaN crop', () => {
  const crop = coverCropRect(0, 0, 0, 0);
  assert.ok(crop.width >= 1 && crop.height >= 1);
});

test('the detector frame is bounded by its long edge, whatever the orientation', () => {
  assert.deepEqual(fitLongEdge(450, 1000, 640), { width: 288, height: 640 });
  assert.deepEqual(fitLongEdge(1000, 450, 640), { width: 640, height: 288 });
  assert.deepEqual(fitLongEdge(0, 10, 640), { width: 1, height: 1 });
});

test('isVerifiedQuad needs four finite points', () => {
  const p = { x: 1, y: 2 };
  assert.equal(isVerifiedQuad([p, p, p, p]), true);
  assert.equal(isVerifiedQuad([p, p, p]), false);
  assert.equal(isVerifiedQuad([p, p, p, { x: NaN, y: 0 }]), false);
  assert.equal(isVerifiedQuad(null), false);
});

test('shutter geometry confidence distinguishes lock, candidate and nothing', () => {
  assert.equal(shutterQuadConfidence({ locked: true }), 'locked');
  assert.equal(shutterQuadConfidence({ hasCandidate: true }), 'provisional');
  assert.equal(shutterQuadConfidence({}), 'none');
});

const ready = {
  auto: true, armed: true, processing: false, scaled: false,
  phase: 'locked', stableMs: CAPTURE.STABILITY_MS, lockedForMs: 0, reason: null,
};

test('Auto fires on a locked page that has held still', () => {
  assert.equal(shouldAutoCapture(ready), true);
});

test('Auto waits for real stillness, then eventually fires anyway (patience)', () => {
  assert.equal(shouldAutoCapture({ ...ready, stableMs: CAPTURE.STABILITY_MS - 1 }), false);
  assert.equal(shouldAutoCapture({ ...ready, stableMs: 0, lockedForMs: CAPTURE.PATIENCE_MS }), true);
});

test('Auto never fires on a candidate or with no page', () => {
  assert.equal(shouldAutoCapture({ ...ready, phase: 'candidate' }), false);
  assert.equal(shouldAutoCapture({ ...ready, phase: 'searching' }), false);
});

test('Auto is held by anything the student can fix by moving, but not by glare', () => {
  for (const reason of ['cutoff', 'small', 'shaky', 'blurry', 'dark', 'capture']) {
    assert.equal(shouldAutoCapture({ ...ready, reason }), false, reason);
  }
  assert.equal(shouldAutoCapture({ ...ready, reason: 'glare' }), true);
});

test('Auto is off, disarmed, processing or pinch-zoomed: no shot', () => {
  assert.equal(shouldAutoCapture({ ...ready, auto: false }), false);
  assert.equal(shouldAutoCapture({ ...ready, armed: false }), false);
  assert.equal(shouldAutoCapture({ ...ready, processing: true }), false);
  assert.equal(shouldAutoCapture({ ...ready, scaled: true }), false);
});

test('a still is "fine" only on ML evidence at or above the threshold', () => {
  const quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  assert.deepEqual(
    judgeStillGeometry({ status: 'found', source: 'ml', score: FINE_SCORE, quad }),
    { confirmed: true, reason: null });
  assert.deepEqual(
    judgeStillGeometry({ status: 'found', source: 'ml', score: FINE_SCORE - 0.01, quad }),
    { confirmed: false, reason: 'uncertain' });
  assert.deepEqual(
    judgeStillGeometry({ status: 'found', source: 'classical', score: null, quad }),
    { confirmed: false, reason: 'uncertain' }, 'classical has no score, so it is never "fine" on its own');
});

test('no page and no engine are different flags', () => {
  assert.deepEqual(judgeStillGeometry({ status: 'none' }), { confirmed: false, reason: 'not-found' });
  assert.deepEqual(judgeStillGeometry({ status: 'unavailable' }), { confirmed: false, reason: 'engine' });
  assert.deepEqual(judgeStillGeometry(undefined), { confirmed: false, reason: 'engine' });
});
