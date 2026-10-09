import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_STRUCTURE_VERSION, proposeDeviceStructure } from '../src/scan/device-structure.js';

function page(width = 500, height = 1000) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  pixels.fill(255);
  const mask = { data: new Uint8Array(width * height), width, height };
  const image = { data: pixels, width, height };
  const pixel = (x, y, rgb = [0, 0, 0], teacher = 0) => {
    const p = y * width + x, i = p * 4;
    pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2];
    mask.data[p] = teacher;
  };
  const block = (left, top, right, bottom, rgb = [0, 0, 0]) => {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) pixel(x, y, rgb);
  };
  return { image, mask, pixel, block };
}

test('advisory proposals retain all observed question rows and teacher margin ink', () => {
  const p = page();
  p.block(30, 100, 210, 160);
  p.block(30, 440, 210, 500);
  p.block(30, 770, 210, 830);
  // A pale teacher annotation that luma alone cannot detect.
  p.pixel(497, 522, [255, 253, 253], 100);
  const result = proposeDeviceStructure(p.image, p.mask);
  assert.equal(result.version, DEVICE_STRUCTURE_VERSION);
  assert.equal(result.status, 'candidate');
  assert.equal(result.bands.length, 3);
  assert.equal(result.covered_ink_rows, result.observed_ink_rows);
  assert.ok(result.removable_height_share >= 0.17);
  for (const y of [100, 159, 440, 499, 522, 770, 829]) {
    assert.ok(result.bands.some(b => b.y <= y && y < b.y + b.h), String(y));
  }
  for (const b of result.bands) {
    assert.equal(b.x, 0);
    assert.equal(b.w, p.image.width);
    assert.ok(b.y >= 0 && b.y + b.h <= p.image.height);
  }
});

test('no ink and uniform noise are fail-closed, not cropped', () => {
  const empty = page();
  assert.deepEqual(proposeDeviceStructure(empty.image, empty.mask).bands, []);
  assert.equal(proposeDeviceStructure(empty.image, empty.mask).reason, 'no_detectable_ink');
  const noisy = page();
  for (let y = 0; y < noisy.image.height; y++) noisy.pixel(1, y, [110, 110, 110]);
  assert.equal(proposeDeviceStructure(noisy.image, noisy.mask).status, 'fallback');
});

test('too many isolated bands fall back rather than omitting part of the page', () => {
  const p = page(500, 1600);
  for (let band = 0; band < 12; band++) {
    p.block(20, 60 + band * 130, 200, 72 + band * 130);
  }
  const result = proposeDeviceStructure(p.image, p.mask);
  assert.equal(result.status, 'fallback');
  assert.equal(result.reason, 'fragmented_layout');
});

test('an unusable teacher-ink mask cannot enable crop proposal', () => {
  const p = page();
  p.block(30, 120, 180, 200);
  assert.equal(proposeDeviceStructure(p.image, null).reason, 'missing_teacher_mask');
  assert.equal(proposeDeviceStructure(p.image, { ...p.mask, width: 42 }).status, 'fallback');
});

test('all boxes use conditioned pixel coordinates and no question is inferred', () => {
  const p = page(350, 700);
  p.block(10, 80, 60, 125);
  p.block(10, 550, 60, 590);
  const r = proposeDeviceStructure(p.image, p.mask);
  assert.equal(r.status, 'candidate');
  assert.equal(r.coordinate_space, 'conditioned_page_pixels');
  assert.equal(r.width, 350);
  assert.equal(r.height, 700);
  assert.ok(!('question_labels' in r));
  assert.ok(r.bands.every(b => Number.isInteger(b.y) && Number.isInteger(b.h)));
});
