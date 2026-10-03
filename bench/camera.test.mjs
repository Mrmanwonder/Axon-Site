// What the camera is asked for (src/scan/camera.js).
//
//   node --test bench/camera.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_CONSTRAINTS, FALLBACK_CAPTURE_HEIGHT, FALLBACK_CAPTURE_WIDTH,
  TRACKING_HEIGHT, TRACKING_WIDTH,
} from '../src/scan/camera.js';

test('camera starts with a cheap 720p tracking stream', () => {
  assert.equal(TRACKING_WIDTH, 1280);
  assert.equal(TRACKING_HEIGHT, 720);
  assert.equal(CAMERA_CONSTRAINTS.video.width.ideal, TRACKING_WIDTH);
  assert.equal(CAMERA_CONSTRAINTS.video.height.ideal, TRACKING_HEIGHT);
  assert.deepEqual(CAMERA_CONSTRAINTS.video.facingMode, { ideal: 'environment' });
  assert.equal(CAMERA_CONSTRAINTS.audio, false);
});

test('video-frame fallback is higher resolution but capped at the practical 12MP tier', () => {
  assert.ok(FALLBACK_CAPTURE_WIDTH > TRACKING_WIDTH);
  assert.ok(FALLBACK_CAPTURE_HEIGHT > TRACKING_HEIGHT);
  assert.equal(FALLBACK_CAPTURE_WIDTH, 4032);
  assert.equal(FALLBACK_CAPTURE_HEIGHT, 3024);
  assert.ok(FALLBACK_CAPTURE_WIDTH * FALLBACK_CAPTURE_HEIGHT < 13_000_000);
});
