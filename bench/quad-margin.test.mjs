// The outward margin a detected page quad gets before it is warped
// (CONDITIONING.QUAD_MARGIN, src/scan/geometry.js expandQuad). The detector's
// corners sit slightly inside the paper, so warping to them exactly cut the page
// edge and sometimes marking written near it.
//
// Synthetic geometry only. The margin itself is a conservative default; tuning
// it needs the owner's real phone footage, which no test here stands in for.
//
//   node --test bench/quad-margin.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandQuad, warpPerspective, quadSize } from '../src/scan/geometry.js';
import { quadMarginFor } from '../src/scan/conditioning.js';
import { CONDITIONING } from '../src/scan/contract.js';
import { makeImageData } from '../src/scan/imagedata.js';

const rect = (x0, y0, x1, y1) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];
const diagonal = (q) => Math.max(Math.hypot(q[0].x - q[2].x, q[0].y - q[2].y), Math.hypot(q[1].x - q[3].x, q[1].y - q[3].y));

test('the margin is a small named constant', () => {
  assert.equal(CONDITIONING.QUAD_MARGIN, 0.015);
});

test('a detected quad is widened; corners placed by hand are used exactly', () => {
  assert.equal(quadMarginFor('canvas-grab'), CONDITIONING.QUAD_MARGIN);
  assert.equal(quadMarginFor('image-capture'), CONDITIONING.QUAD_MARGIN);
  assert.equal(quadMarginFor(null), CONDITIONING.QUAD_MARGIN);
  assert.equal(quadMarginFor('edges-adjusted'), 0);
});

test('every side of a rectangle moves out by the margin times the diagonal', () => {
  const quad = rect(200, 300, 800, 1100);
  const offset = 0.015 * diagonal(quad); // 600x800 → diagonal 1000 → 15px
  const out = expandQuad(quad, 2000, 2000, 0.015);
  assert.deepEqual(out.map((p) => ({ x: +p.x.toFixed(6), y: +p.y.toFixed(6) })),
    rect(200 - offset, 300 - offset, 800 + offset, 1100 + offset));
});

test('a keystoned quad gains the same band on every side, and stays convex and ordered', () => {
  // Wider at the bottom, as a page photographed from above its top edge looks.
  const quad = [{ x: 300, y: 200 }, { x: 700, y: 200 }, { x: 850, y: 900 }, { x: 150, y: 900 }];
  const margin = 0.015;
  const offset = margin * diagonal(quad);
  const out = expandQuad(quad, 2000, 2000, margin);
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // Signed distance of the new corner pair from the old side's line.
    const distance = (p) => Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
    assert.ok(Math.abs(distance(out[i]) - offset) < 1e-6, `side ${i} start moved ${distance(out[i])}`);
    assert.ok(Math.abs(distance(out[(i + 1) % 4]) - offset) < 1e-6, `side ${i} end moved`);
  }
  assert.ok(out[0].x < quad[0].x && out[0].y < quad[0].y);
  assert.ok(out[2].x > quad[2].x && out[2].y > quad[2].y);
});

test('corners are clamped to the image, and a zero margin only clamps', () => {
  const quad = rect(2, 3, 997, 798);
  const out = expandQuad(quad, 1000, 800, 0.015);
  for (const p of out) {
    assert.ok(p.x >= 0 && p.x <= 999 && p.y >= 0 && p.y <= 799, JSON.stringify(p));
  }
  assert.deepEqual(expandQuad(rect(10, 10, 90, 90), 100, 100, 0), rect(10, 10, 90, 90));
  // A hand-placed corner dragged past the frame is still kept inside it.
  assert.deepEqual(expandQuad(rect(-5, 10, 90, 120), 100, 100, 0), rect(0, 10, 90, 99));
});

test('the input quad is not mutated', () => {
  const quad = rect(100, 100, 400, 500);
  const copy = JSON.parse(JSON.stringify(quad));
  expandQuad(quad, 1000, 1000, 0.015);
  assert.deepEqual(quad, copy);
});

test('warping to the widened quad keeps a mark at the page edge that the detected quad cut off', () => {
  // A white page from (100,100) to (700,900) on a grey desk, with a black mark
  // in its first 6px down the left edge. The detector reported corners 8px
  // inside the paper, as it tends to.
  const W = 800, H = 1000;
  const src = makeImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const onPage = x >= 100 && x < 700 && y >= 100 && y < 900;
      const mark = onPage && x < 106 && y >= 400 && y < 600;
      const v = mark ? 0 : onPage ? 250 : 120;
      src.data[o] = src.data[o + 1] = src.data[o + 2] = v;
      src.data[o + 3] = 255;
    }
  }
  const detected = rect(108, 108, 692, 892);
  const darkestInLeftColumns = (img, columns) => {
    let min = 255;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < columns; x++) min = Math.min(min, img.data[(y * img.width + x) * 4]);
    }
    return min;
  };

  const tight = quadSize(detected);
  const cut = warpPerspective(src, detected, tight.width, tight.height);
  assert.ok(darkestInLeftColumns(cut, 20) > 200, 'precondition: the tight quad loses the edge mark');

  const widened = expandQuad(detected, W, H, CONDITIONING.QUAD_MARGIN);
  const size = quadSize(widened);
  const kept = warpPerspective(src, widened, size.width, size.height);
  assert.ok(darkestInLeftColumns(kept, 40) < 30, 'the widened quad keeps the edge mark');
});
