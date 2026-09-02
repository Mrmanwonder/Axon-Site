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
// This is a first, small instance of that. It is not the golden set described
// there in full: that needs a checked-in corpus spanning the whole failure
// taxonomy, which this repo still does not have real photographs for.
//
// ── on which fixtures can be held to which threshold ──────────────────────
//
// Rewritten 2026-09-01 alongside the quality-gate recalibration
// (AXON_FIX_BRIEF.md §7.4), and the split below is the substance of it:
//
// · `page-*.jpg` and `viewfinder-*.jpg` are **downscaled derivatives** — 700 to
//   1030px on the long edge. They are real photographs and they are the right
//   fixtures for geometry (detectQuad, paperScore, skew), which is scale-free.
//   They are the wrong fixtures for anything absolute about image quality,
//   because they are far below the resolution floor a real capture must clear
//   and the pipeline would refuse them outright now. Holding them to the
//   sharpness thresholds would be calibrating a production gate against
//   thumbnails.
//
// · `glare-blown-background-{1,2}.png` are **real submitted pages at production
//   scale** (2305x3301, 2250x3301). They are the corpus's only honest anchor
//   for the absolute measures, and they carry the most important regression pin
//   in this file — see below.
//
// · `glare-specular-synthetic.png` is **synthesised, and labelled as such.**
//   Explained where it is used.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectQuad } from '../src/scan/edges.js';
import { paperScore } from '../src/scan/quad.js';
import { clipping, glareScore, reconcileWithInk, scorePage, sharpness } from '../src/scan/quality.js';
import { CONDITIONING, QUALITY } from '../src/scan/contract.js';
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

// The two real submissions, at the resolution they were actually submitted at.
const PRODUCTION_PAGES = ['glare-blown-background-1.png', 'glare-blown-background-2.png'];

for (const name of REAL_PAGES) {
  test(`detectQuad finds the page in ${name}`, async () => {
    const proxy = await decodeFixture(name, { resizeWidth: PROXY_W });
    const quad = detectQuad(proxy);
    assert.ok(quad, `no quad found on a real, marked exam page (${name})`);
    const { paper } = paperScore(proxy, quad);
    assert.ok(paper >= PAPER_MIN, `paper score ${paper} on ${name} — below the gate's own ${PAPER_MIN} line`);
  });
}

// ── the regression that matters most ───────────────────────────────────────
//
// Both of these are real pages a real student submitted on 2026-08-26. Both
// were hard-failed by the old gate with "Light is washing out part of these
// pages", on a glare metric that scored 0.94+ — and one of them
// (glare-blown-background-2.png, extraction_run fc030c2a-...) had already had
// 144 genuine teacher marks recovered from those very same pixels by
// `separateLayers`. They are white *scans*, not glared photographs, and the
// old measure could not tell the two apart because it counted bright colourless
// pixels absolutely, which is a description of paper.
//
// A false reject on a good page is the worst failure this product has. This
// test is the pin that stops it coming back.
for (const name of PRODUCTION_PAGES) {
  test(`a clean production-scale scan passes the gate: ${name}`, async () => {
    const img = await decodeFixture(name);
    const q = scorePage(img, { longEdge: Math.max(img.width, img.height) });
    assert.equal(q.verdict, 'ok',
      `${name} is a readable page a student actually submitted, and the gate said "${q.verdict}": ${q.reasons.join(' | ')}`);
    assert.equal(q.signals.glare, 0,
      `${name} is a scan, not a glared photograph — any nonzero glare here means the metric has drifted back to measuring exposure`);
    assert.ok(q.signals.clipping < 0.001,
      `clipping ${q.signals.clipping} on a white scan — the metric is counting paper again, which is the defect it was rewritten to remove`);
  });
}

// ── sharpness is a property of the paper, not of the pixel count ───────────
//
// AXON_FIX_BRIEF.md §B7. The old measure read 1.0000 on a fixture at 240px and
// 0.1393 on the same fixture at 1400px, because downscaling concentrates
// high-frequency energy — so the live gate (240px proxy) and the final gate
// (2400px page) were reading opposite answers off the same paper. The fix is to
// measure at a fixed page-relative scale; this is what proves it took.
//
// The check is deliberately only over the range the pipeline actually operates
// in. Below the floor the number *should* fall off, because a 1200px page
// really does hold half the detail, and pretending otherwise would be the
// original bug wearing a different hat.
for (const name of PRODUCTION_PAGES) {
  test(`sharpness reads the same at every resolution above the floor: ${name}`, async () => {
    const native = await decodeFixture(name);
    const long = Math.max(native.width, native.height);
    const atNative = sharpness(native).raw;

    for (const target of [CONDITIONING.MIN_LONG_EDGE, 2800]) {
      if (target > long) continue;
      const scaled = await decodeFixture(name, { resizeWidth: Math.round(target * native.width / long) });
      const atTarget = sharpness(scaled).raw;
      const drift = Math.abs(atTarget - atNative) / atNative;
      assert.ok(drift < 0.15,
        `${name}: raw sharpness ${atNative} at ${long}px but ${atTarget} at ${target}px — ${(drift * 100).toFixed(0)}% drift. The measure is scale-dependent again.`);
    }
  });

  test(`sharpness falls honestly below the floor: ${name}`, async () => {
    const native = await decodeFixture(name);
    const long = Math.max(native.width, native.height);
    const small = await decodeFixture(name, { resizeWidth: Math.round(700 * native.width / long) });
    assert.ok(sharpness(small).raw < sharpness(native).raw / 2,
      `${name} at 700px measured as sharp as at ${long}px — the metric is not seeing lost detail, which is how it was wrong before`);
  });
}

// ── the blur thresholds, against actual blur ───────────────────────────────
//
// contract.js states where BLUR_WARN and BLUR_FAIL came from: a Gaussian sweep
// on these two pages at the pipeline's own 2400px target. This runs the ends of
// that sweep so the constants cannot drift away from the measurement that
// produced them.
for (const name of PRODUCTION_PAGES) {
  test(`an in-focus page clears BLUR_WARN and a badly blurred one does not: ${name}`, async () => {
    // Width chosen so the *long* edge lands on the pipeline's own target. These
    // fixtures are portrait, so passing 2400 as a width would upscale them and
    // then blur the upscale, which measures the resampler rather than the page.
    const native = await decodeFixture(name);
    const atTarget = Math.round(2400 * native.width / Math.max(native.width, native.height));

    const sharpPage = await decodeFixture(name, { resizeWidth: atTarget });
    const focus = sharpness(sharpPage);
    assert.ok(focus.score >= QUALITY.BLUR_WARN,
      `${name} at 2400px scored ${focus.score} (raw ${focus.raw}) — a real in-focus page fell under the warn line`);

    const blurred = await decodeFixture(name, { resizeWidth: atTarget, blur: 3 });
    const soft = sharpness(blurred);
    assert.ok(soft.score < QUALITY.BLUR_FAIL,
      `${name} blurred at sigma 3 still scored ${soft.score} (raw ${soft.raw}) — above the fail line, so nothing is being caught`);
  });
}

// ── glare, with a labelled synthetic positive ──────────────────────────────
//
// The corpus contains no genuine glare true positive. Both fixtures named
// "glare-blown" are readable pages: one recovered 144 teacher marks in
// production and the other recovered zero only because it is tagged
// `layer_fallback = 'student_wrote_red'`. So a positive had to be made, and it
// is named for what it is.
//
// `glare-specular-synthetic.png` is `page-tilted.jpg` with two saturating white
// ellipses composited over it in `lighten` mode — which is what a specular
// reflection physically does: it adds light, it does not replace the page.
// Everything else about the fixture, including the ink under the blob, is the
// original photograph. It is a *metric* fixture, not a verdict one: it is well
// below the resolution floor and would be refused at capture, so only its glare
// number is asserted here.
test('a specular highlight is found, and the same page without one is not', async () => {
  const clean = await decodeFixture('page-tilted.jpg');
  const glared = await decodeFixture('glare-specular-synthetic.png');

  const before = glareScore(clean);
  const after = glareScore(glared);

  assert.equal(before.score, 0,
    `the unmodified photograph measured ${before.score} glare — a clean page must read zero or the positive below proves nothing`);
  assert.ok(after.score > QUALITY.GLARE_FAIL,
    `the synthesised highlight measured ${after.score}, at or under GLARE_FAIL ${QUALITY.GLARE_FAIL} — real glare is not being caught`);
  // The blob only adds light, so if the base level moved the measure is picking
  // up the composite rather than the highlight.
  assert.ok(Math.abs(after.base - before.base) <= 4,
    `page base moved ${before.base} -> ${after.base}; the fixture is no longer isolating a local highlight`);
});

// ── over-exposure, which glare cannot see ──────────────────────────────────
//
// A uniformly blown page has no bright patch for a local measure to find. That
// case belongs to `clipping`, and the pair below is why both exist.
test('over-exposure shows up in clipping even where glare stays at zero', async () => {
  const correct = await decodeFixture('page-tilted.jpg');
  const hot = await decodeFixture('page-tilted.jpg', { exposure: 1.3 });

  assert.ok(clipping(correct) < QUALITY.CLIP_WARN,
    `a correctly exposed photograph measured ${clipping(correct)} clipping — over the warn line, so the metric is counting paper`);
  assert.ok(clipping(hot) > QUALITY.CLIP_WARN,
    `the same page at x1.30 exposure measured ${clipping(hot)} — under the warn line, so nothing is being caught`);
  assert.ok(glareScore(hot).headroom < glareScore(correct).headroom,
    'exposure headroom did not fall on an over-exposed page — the signal that lets a refusal say "bright all over" rather than "tilt it" is not working');
});

// ── the resolution floor ───────────────────────────────────────────────────
//
// This used to assert that a downsampled page failed on resolution *alone*,
// with sharpness still in its ok band. That assertion is no longer meaningful
// and its disappearance is the finding, not a loosening: under a scale-invariant
// sharpness measure, "this page is small" and "this page has no fine detail"
// are the same physical fact, so both signals fire together by construction.
// What is still worth pinning is that the floor fires at all, and that it is
// the floor that fires — the capture step refuses below it, so nothing should
// be able to reach the pipeline under it.
for (const name of ['page-tilted.jpg', 'page-straight.jpg']) {
  test(`a genuinely low-resolution capture of ${name} is failed by the gate`, async () => {
    const small = await decodeFixture(name, { resizeWidth: 500 });
    const gate = scorePage(small, { longEdge: Math.max(small.width, small.height) });

    assert.equal(gate.verdict, 'fail', `expected a low-res capture of ${name} to fail, got ${gate.verdict}`);
    assert.ok(gate.signals.long_edge < QUALITY.RESOLUTION_FAIL,
      `long_edge ${gate.signals.long_edge} is not actually below RESOLUTION_FAIL — this test would be measuring nothing`);
    assert.ok(gate.reasons.some((r) => r.includes('too small')),
      `the refusal did not mention resolution: ${gate.reasons.join(' | ')}`);
  });
}

for (const name of ['viewfinder-a.jpg', 'viewfinder-b.jpg']) {
  test(`detectQuad finds the page in the real viewfinder frame ${name}`, async () => {
    const proxy = await decodeFixture(name, { crop: VIEWFINDER_FEED, resizeWidth: PROXY_W });
    const quad = detectQuad(proxy);
    assert.ok(quad, `no quad found in a real viewfinder frame with a page in it (${name})`);
  });
}

// ── reconcileWithInk, now a backstop rather than a patch ───────────────────
//
// It was written to rescue readable pages from the old glare metric, and both
// pages it was written for now measure 0.0000 glare and never reach a glare
// fail at all. So it can no longer be pinned against a fixture — there is no
// fixture that produces the input any more, which is the point. Its contract is
// pinned directly instead: given a glare-only fail, a meaningful number of
// recovered teacher marks downgrades it and no marks does not.
test('reconcileWithInk downgrades a glare-only fail when the ink survived, and only then', async () => {
  const glared = await decodeFixture('glare-specular-synthetic.png');
  const raw = scorePage(glared, { longEdge: CONDITIONING.MIN_LONG_EDGE });
  assert.equal(raw.verdict, 'fail', 'the synthetic glare fixture no longer produces a fail — nothing to reconcile');

  assert.equal(reconcileWithInk(raw, 144).verdict, 'warn',
    'a page whose red layer yielded 144 teacher marks was still refused for glare');
  assert.equal(reconcileWithInk(raw, 0).verdict, 'fail',
    'a page whose red layer yielded nothing was let through — reconcileWithInk must not pass a page on no evidence');
});

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
