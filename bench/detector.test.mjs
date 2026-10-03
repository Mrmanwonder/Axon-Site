// The detector wrapper's POLICY (src/scan/detector.js), tested against a fake
// engine: which answer is reported, when classical is allowed to step in, and
// that no failure is swallowed. What the real engine finds on real pixels is
// measured separately (tests/e2e/detector.spec.ts runs scanic in Chromium).
//
//   node --test bench/detector.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPage, isConvexQuad, quadFromCorners } from '../src/scan/detector.js';

const image = { width: 400, height: 600, data: new Uint8ClampedArray(4) };
const corners = {
  topLeft: { x: 40, y: 50 }, topRight: { x: 360, y: 60 },
  bottomRight: { x: 350, y: 560 }, bottomLeft: { x: 30, y: 550 },
};
const found = { success: true, corners, score: 0.97, message: 'ok' };
const none = { success: false, corners: null, score: 0.04, message: 'No confident document (ml)' };

const engineOf = (ml, classical) => ({
  async scanDocument(_img, options) {
    const run = options.detector === 'ml' ? ml : classical;
    if (run instanceof Error) throw run;
    return run;
  },
});

test('ML finds the page: found, ml, with its score', async () => {
  const d = await detectPage(image, { engine: engineOf(found, none) });
  assert.equal(d.status, 'found');
  assert.equal(d.source, 'ml');
  assert.equal(d.score, 0.97);
  assert.equal(d.degraded, false);
  assert.equal(d.quad.length, 4);
});

test('ML ran and found nothing: none. Classical is NOT consulted', async () => {
  let classicalCalls = 0;
  const engine = {
    async scanDocument(_i, o) {
      if (o.detector !== 'ml') { classicalCalls++; return found; }
      return none;
    },
  };
  const d = await detectPage(image, { engine });
  assert.equal(d.status, 'none');
  assert.equal(d.source, 'ml');
  assert.equal(classicalCalls, 0, 'a wall must stay a wall');
});

test('ML could not run: classical answers, flagged degraded, with the reason kept', async () => {
  const d = await detectPage(image, { engine: engineOf(new Error('wasm blocked by CSP'), found) });
  assert.equal(d.status, 'found');
  assert.equal(d.source, 'classical');
  assert.equal(d.degraded, true);
  assert.match(d.error, /wasm blocked/);
});

test('both engines fail: unavailable, both reasons kept, nothing thrown', async () => {
  const d = await detectPage(image, { engine: engineOf(new Error('model 404'), new Error('wasm oom')) });
  assert.equal(d.status, 'unavailable');
  assert.match(d.error, /model 404/);
  assert.match(d.error, /wasm oom/);
});

test('fallback can be switched off (warm-up must report ML honestly)', async () => {
  const d = await detectPage(image, {
    engine: engineOf(new Error('model 404'), found), classicalFallback: false,
  });
  assert.equal(d.status, 'unavailable');
});

test('engine that cannot load is reported, not thrown', async () => {
  const d = await detectPage(image, { engine: undefined, assetBaseUrl: undefined }).catch((e) => e);
  // Without an injected engine this loads real scanic; the import succeeds in
  // Node, so this only asserts the call returns a Detection object.
  assert.ok(['found', 'none', 'unavailable'].includes(d.status));
});

test('a degenerate or non-finite quad from the engine is not "found"', async () => {
  const bad = { success: true, score: 0.9, corners: { ...corners, topRight: { x: NaN, y: 0 } } };
  const d = await detectPage(image, { engine: engineOf(bad, none) });
  assert.equal(d.status, 'none');
});

test('corners are clamped into the image and must be convex', () => {
  const q = quadFromCorners({ ...corners, topLeft: { x: -20, y: -5 } }, 400, 600);
  assert.equal(q[0].x, 0);
  assert.equal(q[0].y, 0);
  const bowtie = {
    topLeft: { x: 0, y: 0 }, topRight: { x: 100, y: 100 },
    bottomRight: { x: 100, y: 0 }, bottomLeft: { x: 0, y: 100 },
  };
  assert.equal(quadFromCorners(bowtie, 200, 200), null);
  assert.equal(isConvexQuad([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]), true);
});
