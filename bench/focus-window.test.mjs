// The live blur reading must never measure an enlarged picture. On a phone the
// tracking stream is 1280x720, so the page is ~700 px long in the frame; scaling
// that window up to the 1400 px canonical scale before the Laplacian made every
// sharp page read as "blurry", and Auto never fired (owner's recording, 4 Oct
// 2026; reproduced in bench/viewfinder.html?scale=1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusWindowRect } from '../src/scan/quality.js';
import { QUALITY } from '../src/scan/contract.js';

const quad = (w, h) => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];

test('a page under the canonical scale is read 1:1, never enlarged', () => {
  const r = focusWindowRect(quad(400, 700), 720, 1280, 700, 384);
  assert.ok(r);
  assert.ok(r.size >= r.target, `window ${r.size}px drawn into ${r.target}px would upsample`);
});

test('a page over the canonical scale is still reduced to it', () => {
  const long = QUALITY.MEASURE_LONG_EDGE * 2;
  const r = focusWindowRect(quad(long * 0.7, long), 4032, 4032, long, 384);
  assert.equal(r.size, 768);
  assert.equal(r.target, 384);
});
