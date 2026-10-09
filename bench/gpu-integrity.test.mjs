import assert from "node:assert/strict";
import test from "node:test";
import { gpuWarpEligibleSource } from "../src/scan/gpu.js";

test("only the typed ImageData path proven by the GPU parity harness is eligible", () => {
  assert.equal(gpuWarpEligibleSource({ width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4) }), true);
  assert.equal(gpuWarpEligibleSource({ width: 3000, height: 4000 }), false, "ImageBitmap-shaped native still must use CPU");
  assert.equal(gpuWarpEligibleSource({ width: 3000, height: 4000, data: undefined }), false);
  assert.equal(gpuWarpEligibleSource({ width: 64, height: 64, data: new Uint8Array(64 * 64 * 4) }), false);
  assert.equal(gpuWarpEligibleSource(null), false);
});
