import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertImagePlane, imageDataForContext, isImagePlane, wrapImageData,
} from '../src/scan/imagedata.js';
import { ScanError } from '../src/scan/errors.js';
import { applyGain } from '../src/scan/enhance.js';

const context = () => ({
  createImageData(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4), native: true };
  },
});

test('a structural plane is normalized for the receiving canvas context', () => {
  const plane = { width: 2, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]) };
  const native = imageDataForContext(context(), plane);
  assert.equal(native.native, true);
  assert.deepEqual(native.data, plane.data);
});

test('a malformed plane fails with a typed scanner error', () => {
  assert.throws(
    () => assertImagePlane({ width: 2, height: 2, data: new Uint8ClampedArray(3) }),
    (error) => error instanceof ScanError && error.code === 'SCAN_IMAGE_PLANE_INVALID',
  );
});

test('gain output preserves the canonical image-plane invariant', () => {
  const input = wrapImageData(new Uint8ClampedArray([20, 30, 40, 255]), 1, 1);
  const output = applyGain(input, new Float64Array([1.2]));
  assert.equal(isImagePlane(output), true);
  assert.deepEqual([...output.data], [24, 36, 48, 255]);
});
