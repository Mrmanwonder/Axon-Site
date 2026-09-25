import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraLevelFrame, horizonLevelAngle, normalizeLevelAngle,
} from '../src/scan/level.js';

test('portrait upright is level', () => {
  assert.ok(Math.abs(horizonLevelAngle(90, 0, 0)) < 0.001);
});

test('screen rotation is compensated in landscape', () => {
  assert.ok(Math.abs(horizonLevelAngle(0, -90, 90)) < 0.001);
  assert.ok(Math.abs(horizonLevelAngle(0, 90, 270)) < 0.001);
});

test('face-up/down pose hides the horizon instead of amplifying noise', () => {
  assert.equal(horizonLevelAngle(0, 0, 0), null);
});

test('angle normalization always selects the nearest horizontal', () => {
  assert.equal(normalizeLevelAngle(179), -1);
  assert.equal(normalizeLevelAngle(-179), 1);
});

test('level only appears near horizontal and snaps when aligned', () => {
  assert.equal(cameraLevelFrame(20).visible, false);
  assert.equal(cameraLevelFrame(10).visible, true);

  const aligned = cameraLevelFrame(0.4);
  assert.equal(aligned.aligned, true);
  assert.equal(aligned.rotationDeg, 0);
  assert.ok(aligned.opacity < 1);
});

test('off-level line rotates opposite the phone roll', () => {
  const frame = cameraLevelFrame(7);
  assert.equal(frame.aligned, false);
  assert.equal(frame.rotationDeg, -7);
});
