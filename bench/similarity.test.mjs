import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DUPLICATE_MAX_DISTANCE, closestDuplicatePage, hashDistance, perceptualPageHash,
} from '../src/scan/similarity.js';

function blank(width = 192, height = 256, level = 244) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = level;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function rect(img, x0, y0, x1, y1, level = 25) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = level;
    }
  }
}

function pageFixture(variant = 0, brightness = 0) {
  const img = blank(192, 256, Math.max(0, Math.min(255, 244 + brightness)));
  // Shared exam-paper header.
  rect(img, 20, 18, 172, 24, 55 + brightness);
  rect(img, 20, 34, 120, 39, 85 + brightness);
  if (variant === 0) {
    rect(img, 28, 78, 156, 84, 30 + brightness);
    rect(img, 34, 110, 145, 118, 45 + brightness);
    rect(img, 52, 154, 168, 161, 35 + brightness);
    rect(img, 24, 205, 94, 212, 50 + brightness);
  } else {
    rect(img, 90, 72, 164, 80, 30 + brightness);
    rect(img, 22, 126, 88, 134, 45 + brightness);
    rect(img, 96, 174, 166, 181, 35 + brightness);
    rect(img, 52, 218, 168, 225, 50 + brightness);
  }
  return img;
}

test('perceptual page hash is stable under a uniform exposure shift', () => {
  const a = perceptualPageHash(pageFixture(0, 0));
  const b = perceptualPageHash(pageFixture(0, -18));
  assert.ok(a);
  assert.equal(a, b);
  assert.equal(hashDistance(a, b), 0);
});

test('different page layouts stay outside the duplicate threshold', () => {
  const a = perceptualPageHash(pageFixture(0));
  const b = perceptualPageHash(pageFixture(1));
  const distance = hashDistance(a, b);
  assert.ok(distance > DUPLICATE_MAX_DISTANCE,
    `synthetic distinct pages were only ${distance} bits apart`);
});

test('closest duplicate returns the prior page and can exclude the capture itself', () => {
  const fingerprint = perceptualPageHash(pageFixture(0));
  const other = perceptualPageHash(pageFixture(1));
  const pages = [
    { page_number: 1, fingerprint: null, meta: {} },
    { page_number: 2, fingerprint: null, meta: {} },
  ];
  // The helper reads the local draft field through meta only when present in
  // older fixtures; production callers pass the normalized shape below.
  pages[0].meta.page_fingerprint = fingerprint;
  pages[1].meta.page_fingerprint = other;
  const match = closestDuplicatePage(pages, fingerprint);
  assert.equal(match?.pageNumber, 1);
  assert.equal(match?.distance, 0);
  assert.equal(closestDuplicatePage(pages, fingerprint, { excludePageNumber: 1 }), null);
});
