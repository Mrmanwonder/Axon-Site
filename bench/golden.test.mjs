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
import { reconcileWithInk, scorePage } from '../src/scan/quality.js';
import { QUALITY } from '../src/scan/contract.js';
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

// RESOLUTION_FAIL is wired into scorePage()'s verdict (audit 2026-08-26
// finding 7 flagged this as defined but never checked; re-verified false —
// see quality.js's resVerdict) but nothing before this pinned it against a
// real photograph, only against synthetic dimensions. `page-tilted.jpg` and
// `page-straight.jpg` are real, in-focus, low-glare pages at native
// resolution (per the test above) — downsampling them, genuinely, below
// RESOLUTION_FAIL is the one honest way to produce "a low-resolution-only
// capture" a golden set can check: real content, every other signal still
// in its ok/warn band, so a fail here can only be coming from resolution.
for (const name of ['page-tilted.jpg', 'page-straight.jpg']) {
  test(`a genuinely low-resolution capture of ${name} fails on resolution alone`, async () => {
    // Downsampled, not upsampled: both fixtures are already ~850-1000px
    // native, so anything at or above that width would be interpolated
    // *up*, which softens the image and would make this a blur test by
    // accident. 500px is a real capture a long way under the phone's own
    // sensor, the same way a student photographing from across a desk
    // would produce one.
    const small = await decodeFixture(name, { resizeWidth: 500 });
    const gate = scorePage(small, { longEdge: Math.max(small.width, small.height) });

    assert.equal(gate.verdict, 'fail', `expected a low-res capture of ${name} to fail, got ${gate.verdict}`);
    assert.ok(gate.signals.long_edge < QUALITY.RESOLUTION_FAIL,
      `long_edge ${gate.signals.long_edge} is not actually below RESOLUTION_FAIL — this test would be measuring nothing`);
    // Isolate resolution as the actual cause: blur and glare must still be
    // clean, or a 'fail' here would be ambiguous about why.
    assert.ok(gate.signals.sharpness >= QUALITY.BLUR_WARN,
      `sharpness ${gate.signals.sharpness} on the downsampled ${name} also failed — this is no longer isolating resolution`);
    assert.ok(gate.signals.glare <= QUALITY.GLARE_FAIL,
      `glare ${gate.signals.glare} on the downsampled ${name} also failed — this is no longer isolating resolution`);
  });
}

for (const name of ['viewfinder-a.jpg', 'viewfinder-b.jpg']) {
  test(`detectQuad finds the page in the real viewfinder frame ${name}`, async () => {
    const proxy = await decodeFixture(name, { crop: VIEWFINDER_FEED, resizeWidth: PROXY_W });
    const quad = detectQuad(proxy);
    assert.ok(quad, `no quad found in a real viewfinder frame with a page in it (${name})`);
  });
}

// Real submissions, traced live in production on 2026-08-26: two pages of a
// genuine marked CS exam, uploaded (no camera in this environment, so no
// quad/warp — the same code path an `<input type=file>` upload takes). Both
// scored glare 0.94+ (well past GLARE_FAIL 0.035) and both hard-failed with
// "Light is washing out part of these pages" — on a real, readable paper.
// glare-blown-background-2.png's page went on to have 144 real teacher marks
// recovered in production (extraction_run row fc030c2a-...); glare-blown-
// background-1.png recovered zero. That is the pair reconcileWithInk exists
// to tell apart: page 2 should downgrade to warn, page 1 should stay fail.
//
// The raw glare score itself is pinned here against the fixture directly —
// that reproduces almost exactly (glare 0.93-0.94 locally vs 0.94-0.945 in
// production for both pages), so it survives a plain Node/sharp decode fine.
// separateLayers' mark *count* does not: run locally under sharp at every
// scale tried (native, 900px proxy, and conditionPage's own target scale) it
// finds 0 marks on both fixtures, including page 2's real 144 — almost
// certainly a decode-level difference between sharp and a browser canvas's
// getImageData on this specific PNG (ICC/alpha handling is the leading
// suspect, not yet root-caused) rather than anything wrong with the ink
// itself. So this test pins reconcileWithInk's own contract directly against
// the raw glare-only fail this fixture produces, using the real production
// mark count as input rather than a local (and here, unreliable) re-derivation
// of it — separateLayers' fixture-level accuracy is tracked as a separate,
// still-open item, not silently declared fine by loosening this assertion.
for (const [name, productionMarkCount] of [
  ['glare-blown-background-1.png', 0],
  ['glare-blown-background-2.png', 144],
]) {
  test(`glare-only verdict on ${name} is reconciled against its real production mark count`, async () => {
    const native = await decodeFixture(name);
    const raw = scorePage(native, { longEdge: Math.max(native.width, native.height) });
    assert.ok(raw.signals.glare > 0.5,
      `fixture no longer exercises the case — glare ${raw.signals.glare} is not the blown-background scenario this pins`);
    assert.strictEqual(raw.verdict, 'fail', 'fixture no longer starts as a raw fail — nothing to reconcile');

    const reconciled = reconcileWithInk(raw, productionMarkCount);
    if (productionMarkCount >= 3) {
      assert.strictEqual(reconciled.verdict, 'warn',
        'production recovered real marks on this exact page — a glare-only fail should have been downgraded');
    } else {
      assert.strictEqual(reconciled.verdict, 'fail',
        'production recovered no marks on this exact page — reconcileWithInk must not silently pass it');
    }
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
