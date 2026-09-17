import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_SOURCE_FLOOR,
  MIN_EDGE_COVERAGE,
  liveGateVerdict,
  settledGuidance,
  shouldAutoCapture,
} from '../src/scan/capture.js';
import {
  CAMERA_CONSTRAINTS,
  FALLBACK_CAPTURE_HEIGHT,
  FALLBACK_CAPTURE_WIDTH,
  TRACKING_HEIGHT,
  TRACKING_WIDTH,
} from '../src/scan/camera.js';
import { QUALITY } from '../src/scan/contract.js';

const clean = {
  glare: 0,
  clipping: 0,
  fill: 0.7,
  edgeCoverage: MIN_EDGE_COVERAGE + 0.1,
  sharpness: QUALITY.BLUR_WARN + 0.2,
  skew: 0,
  pageLongEdge: LIVE_SOURCE_FLOOR + 400,
  resolutionStatus: 'known',
  qualityReady: true,
};

const readyCapture = {
  autoCapture: true,
  armed: true,
  blocking: null,
  consecutiveFinds: 20,
  globalConfirmations: 2,
  trackState: 'tracking',
  viewportScaled: false,
};

test('stale live measurements can never publish Ready', () => {
  const verdict = liveGateVerdict({ ...clean, qualityReady: false });
  assert.equal(verdict.blocking, 'measuring');
  assert.match(verdict.hint, /steady/i);
});

test('unknown native-still resolution does not bypass stale quality', () => {
  const verdict = liveGateVerdict({
    ...clean,
    resolutionStatus: 'unknown',
    pageLongEdge: 1,
    qualityReady: false,
  });
  assert.equal(verdict.blocking, 'measuring');
});

test('processing the previous page suppresses automatic capture', () => {
  assert.equal(shouldAutoCapture({ ...readyCapture, processing: true }), false);
  assert.equal(shouldAutoCapture({ ...readyCapture, processing: false }), true);
});

test('a fresh quality block still beats an otherwise ready capture', () => {
  const verdict = liveGateVerdict({
    ...clean,
    sharpness: QUALITY.BLUR_WARN - 0.01,
  });
  assert.equal(verdict.blocking, 'focus');
  assert.equal(shouldAutoCapture({ ...readyCapture, blocking: verdict.blocking }), false);
});

test('entering a stale-measurement block is immediate', () => {
  const showing = { hint: 'Ready', blocking: null, since: 1000 };
  const stale = liveGateVerdict({ ...clean, qualityReady: false });
  const settled = settledGuidance(showing, stale, 1001);
  assert.equal(settled.blocking, 'measuring');
});

test('camera starts with a cheap 720p tracking stream', () => {
  assert.equal(TRACKING_WIDTH, 1280);
  assert.equal(TRACKING_HEIGHT, 720);
  assert.equal(CAMERA_CONSTRAINTS.video.width.ideal, TRACKING_WIDTH);
  assert.equal(CAMERA_CONSTRAINTS.video.height.ideal, TRACKING_HEIGHT);
});

test('video-frame fallback asks for more pixels than the tracking stream', () => {
  assert.ok(FALLBACK_CAPTURE_WIDTH > TRACKING_WIDTH);
  assert.ok(FALLBACK_CAPTURE_HEIGHT > TRACKING_HEIGHT);
});
