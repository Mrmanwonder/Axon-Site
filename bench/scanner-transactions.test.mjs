import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_SOURCE_FLOOR,
  MIN_EDGE_COVERAGE,
  PAPER_EVIDENCE_CONFIRMATIONS,
  SEARCH_GUIDANCE,
  liveGateVerdict,
  settledGuidance,
  settledPaperEvidence,
  settledScannerGuidance,
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
  geometryReady: true,
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

test('unconfirmed geometry can never publish Ready', () => {
  const verdict = liveGateVerdict({ ...clean, geometryReady: false });
  assert.equal(verdict.blocking, 'tracking');
  assert.match(verdict.hint, /corners/i);
});

test('unconfirmed detector candidates remain in the searching presentation', () => {
  const evidence = settledPaperEvidence(null, {
    globalConfirmations: PAPER_EVIDENCE_CONFIRMATIONS - 1,
    geometryReady: true,
    observedGeometry: true,
  }, 0);
  const tracking = liveGateVerdict({ ...clean, geometryReady: false });
  const guidance = settledScannerGuidance(null, tracking, evidence, 0);
  assert.equal(guidance.hint, SEARCH_GUIDANCE.hint);
  assert.equal(guidance.blocking, null);
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

test('video-frame fallback is higher resolution but capped at the practical 12MP tier', () => {
  assert.ok(FALLBACK_CAPTURE_WIDTH > TRACKING_WIDTH);
  assert.ok(FALLBACK_CAPTURE_HEIGHT > TRACKING_HEIGHT);
  assert.equal(FALLBACK_CAPTURE_WIDTH, 4032);
  assert.equal(FALLBACK_CAPTURE_HEIGHT, 3024);
  assert.ok(FALLBACK_CAPTURE_WIDTH * FALLBACK_CAPTURE_HEIGHT < 13_000_000);
});
