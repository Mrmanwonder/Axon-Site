// The golden set, as an actual CI check.
//
// bench/detect.html has run these same fixtures through detectQuad/paperScore
// by hand, in a browser, since before this file existed — real numbers, never
// wired into anything that runs unattended. This is that measurement, made a
// pass/fail check that runs the same as any other test: on every pipeline
// change, with no browser and no one remembering to open detect.html.
//
// detectQuad, paperScore and scorePage are pure — no DOM, no canvas — so the
// only thing missing was a way to decode a real JPEG into the plain
// {data, width, height} shape they expect outside a browser. bench/decode.mjs
// is that, via `sharp` (a devDependency, never shipped to the browser bundle).
//
//   node --test bench/golden.test.mjs
//
// scansystemredesign.md (2026-08-25) §4.5 asks for two numbers tracked
// continuously: false-accept rate (a bad photo the gate lets through) and
// false-reject rate (a good photo the gate blocks or warns unnecessarily).
// This is a first, small instance of that — five real captured pages across
// the skew/tilt range this repo already had fixtures for, one deliberate
// negative, and the two real viewfinder frames the live gate actually sees.
// It is a start, not the golden set described there in full: that needs a
// checked-in corpus spanning the whole failure taxonomy (blurry, glared,
// low-resolution, blank, ungraded, non-schoolwork...), which this repo does
// not have real photographs for yet.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectQuad } from '../src/scan/edges.js';
import { paperScore } from '../src/scan/quad.js';
import { scorePage } from '../src/scan/quality.js';
import { decodeFixture } from './decode.mjs';

// Matches the live gate's own search width (capture.js's PROXY_WIDTH) and the
// gate's own paper-share line (edges.js's detectQuad) — the golden set is
// only meaningful if it is held to the thresholds production actually uses.
const PROXY_W = 240;
const PAPER_MIN = 0.85;

// The live-feed area of a 1440x3216 phone screenshot, cropped out before
// detection the same way capture.js only ever sees the video element and not
// the chrome around it. Mirrors bench/detect.html's own FEED constant.
const VIEWFINDER_FEED = { left: 0, top: 110, width: 1440, height: 1075 };

// Real marked exam pages, captured at a range of skew and tilt. Every one of
// these should be found and should read as paper — this is the detector's
// job description in one sentence.
const REAL_PAGES = ['page-tilted.jpg', 'page-straight.jpg', 'page-angled.jpg', 'page-skew.jpg'];

for (const name of REAL_PAGES) {
  test(`detectQuad finds the page in ${name}`, async () => {
    const proxy = await decodeFixture(name, { resizeWidth: PROXY_W });
    const quad = detectQuad(proxy);
    assert.ok(quad, `no quad found on a real, marked exam page (${name})`);
    const { paper } = paperScore(proxy, quad);
    assert.ok(paper >= PAPER_MIN, `paper score ${paper} on ${name} — below the gate's own ${PAPER_MIN} line`);
  });

  test(`scorePage does not fail ${name} on blur — this is a sharp scan`, async () => {
    const native = await decodeFixture(name);
    const gate = scorePage(native, { longEdge: Math.max(native.width, native.height) });
    assert.ok(gate.signals.sharpness >= 0.9,
      `sharpness ${gate.signals.sharpness} on ${name} — a real, in-focus page scored soft`);
  });
}

for (const name of ['viewfinder-a.jpg', 'viewfinder-b.jpg']) {
  test(`detectQuad finds the page in the real viewfinder frame ${name}`, async () => {
    const proxy = await decodeFixture(name, { crop: VIEWFINDER_FEED, resizeWidth: PROXY_W });
    const quad = detectQuad(proxy);
    assert.ok(quad, `no quad found in a real viewfinder frame with a page in it (${name})`);
  });
}

test('page-clean.jpg (a room with no page in shot) is a known false accept — pinned, not fixed here', async () => {
  // Quad-detector accuracy is explicitly deferred work (scansystemredesign.md
  // §4.3, phased last in §6) — it needs production data from the capture fix
  // landing first, not a threshold guessed against seven fixtures. This test
  // exists to pin today's behaviour so a *regression* — a new false accept
  // appearing, or this one getting worse — is caught the same way any other
  // change is, rather than to claim the gap is closed. If detection ever
  // legitimately stops finding a page here, tighten this assertion (and
  // update the comment) rather than leaving it stale.
  const proxy = await decodeFixture('page-clean.jpg', { resizeWidth: PROXY_W });
  const quad = detectQuad(proxy);
  assert.ok(quad, 'the baseline this pins found a quad here — if that changed, this comment needs updating too');
  const { paper } = paperScore(proxy, quad);
  assert.ok(paper >= PAPER_MIN, `paper score ${paper} — same known false accept as documented above, not a new one`);
});
