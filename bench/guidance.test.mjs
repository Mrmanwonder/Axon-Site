// The guidance strip: one reason at a time, each only under its own measured
// condition, and never a reason the scanner did not measure.
//
//   node --test bench/guidance.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE, chooseGuidance, lumaFromHistogram, quadTouchesEdge } from '../src/scan/guidance.js';
import { QUALITY } from '../src/scan/contract.js';

const bright = { median: 150, p95: 230 };
const base = (over = {}) => ({
  phase: 'searching',
  engine: { status: 'ready' },
  luma: bright, motion: 0, fill: 0, edgeContrast: 40, touchesEdge: false,
  sharpness: null, glare: null, searchingMs: 0,
  torch: { supported: false }, auto: true,
  ...over,
});
const page = (over = {}) => base({ phase: 'candidate', fill: 0.6, ...over });

test('searching in good light is neutral, with no reason', () => {
  const g = chooseGuidance(base());
  assert.equal(g.reason, null);
  assert.equal(g.tone, 'neutral');
});

test('"too dark" needs BOTH a low median and a low highlight; a lamp-lit page is not dark', () => {
  assert.equal(chooseGuidance(base({ luma: { median: 30, p95: 80 } })).reason, 'dark');
  assert.equal(chooseGuidance(base({ luma: { median: 30, p95: 220 } })).reason, null, 'a bright lamp spot');
  assert.equal(chooseGuidance(base({ luma: { median: 120, p95: 200 } })).reason, null);
});

test('"too dark" offers the torch only when the camera exposes one', () => {
  const dark = { median: 20, p95: 70 };
  assert.equal(chooseGuidance(base({ luma: dark, torch: { supported: true } })).action, 'torch');
  assert.equal(chooseGuidance(base({ luma: dark, torch: { supported: false } })).action, null);
});

test('an unmeasured light level never produces "too dark"', () => {
  assert.equal(chooseGuidance(base({ luma: null })).reason, null);
});

test('nothing found: neutral until the timer, then it says so and points at the photo', () => {
  assert.equal(chooseGuidance(base({ searchingMs: GUIDE.NOTHING_MS - 1 })).reason, null);
  const g = chooseGuidance(base({ searchingMs: GUIDE.NOTHING_MS }));
  assert.equal(g.reason, 'nothing');
  assert.match(g.text, /Take the photo/);
});

test('priority when searching: dark outranks nothing-found', () => {
  const g = chooseGuidance(base({ luma: { median: 10, p95: 40 }, searchingMs: 9000 }));
  assert.equal(g.reason, 'dark');
});

test('each page reason fires only under its own condition', () => {
  assert.equal(chooseGuidance(page({ touchesEdge: true })).reason, 'cutoff');
  assert.equal(chooseGuidance(page({ fill: GUIDE.SMALL_FILL - 0.01 })).reason, 'small');
  assert.equal(chooseGuidance(page({ motion: GUIDE.SHAKY_MOTION + 1 })).reason, 'shaky');
  assert.equal(chooseGuidance(page({ sharpness: QUALITY.BLUR_FAIL - 0.01 })).reason, 'blurry');
  assert.equal(chooseGuidance(page({ glare: GUIDE.GLARE + 0.01 })).reason, 'glare');
  assert.equal(chooseGuidance(page()).reason, null);
});

test('"small" needs a measured edge under the quad: an interior quad is not a small page', () => {
  const small = { fill: GUIDE.SMALL_FILL - 0.05 };
  assert.equal(chooseGuidance(page({ ...small, edgeContrast: GUIDE.EDGE_CONTRAST })).reason, 'small');
  assert.equal(chooseGuidance(page({ ...small, edgeContrast: GUIDE.EDGE_CONTRAST - 1 })).reason, null);
  assert.equal(chooseGuidance(page({ ...small, edgeContrast: null })).reason, null);
});

test('unmeasured motion, sharpness and glare never produce their reasons', () => {
  const g = chooseGuidance(page({ motion: null, sharpness: null, glare: null }));
  assert.equal(g.reason, null);
});

test('page-reason priority: cut off > small > shaky > blurry > glare', () => {
  const all = page({
    touchesEdge: true, fill: 0.1, edgeContrast: 40, motion: 99, sharpness: 0, glare: 1,
  });
  assert.equal(chooseGuidance(all).reason, 'cutoff');
  assert.equal(chooseGuidance({ ...all, touchesEdge: false }).reason, 'small');
  assert.equal(chooseGuidance({ ...all, touchesEdge: false, fill: 0.6 }).reason, 'shaky');
  assert.equal(chooseGuidance({ ...all, touchesEdge: false, fill: 0.6, motion: 0 }).reason, 'blurry');
  assert.equal(chooseGuidance({ ...all, touchesEdge: false, fill: 0.6, motion: 0, sharpness: 1 }).reason, 'glare');
});

test('locked and clean: blue tone, and the wording follows Auto', () => {
  const on = chooseGuidance(page({ phase: 'locked', auto: true }));
  const off = chooseGuidance(page({ phase: 'locked', auto: false }));
  assert.equal(on.tone, 'locked');
  assert.match(on.text, /Hold still to capture/);
  assert.equal(off.text, 'Page found');
});

test('a locked page is not called dark: the page was found, the dark claim would be stale', () => {
  const g = chooseGuidance(page({ phase: 'locked', luma: { median: 10, p95: 40 } }));
  assert.notEqual(g.reason, 'dark');
});

test('engine states: loading is neutral, unavailable is an honest attention message', () => {
  assert.equal(chooseGuidance(base({ engine: { status: 'loading' } })).reason, 'engine-loading');
  const g = chooseGuidance(base({ engine: { status: 'unavailable' } }));
  assert.equal(g.reason, 'engine');
  assert.equal(g.tone, 'attention');
});

test('copy rules: no exclamation marks anywhere', () => {
  const samples = [
    base(), base({ luma: { median: 5, p95: 5 } }), base({ searchingMs: 9e3 }),
    page({ touchesEdge: true }), page({ fill: 0.05 }), page({ motion: 50 }),
    page({ sharpness: 0 }), page({ glare: 1 }), page({ phase: 'locked' }),
    base({ engine: { status: 'unavailable' } }), base({ engine: { status: 'loading' } }),
  ];
  for (const s of samples) assert.ok(!chooseGuidance(s).text.includes('!'));
});

test('quadTouchesEdge', () => {
  const inside = [{ x: .2, y: .2 }, { x: .8, y: .2 }, { x: .8, y: .8 }, { x: .2, y: .8 }];
  assert.equal(quadTouchesEdge(inside), false);
  assert.equal(quadTouchesEdge([{ x: 0, y: .2 }, ...inside.slice(1)]), true);
  assert.equal(quadTouchesEdge([...inside.slice(0, 3), { x: .2, y: 1 }]), true);
});

test('lumaFromHistogram', () => {
  const h = new Uint32Array(256); h[100] = 90; h[250] = 10;
  assert.deepEqual(lumaFromHistogram(h), { median: 100, p95: 250 });
  assert.equal(lumaFromHistogram(new Uint32Array(256)), null);
});
