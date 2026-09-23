// Tests for the two decisions that made auto-capture never fire.
//
// Both were wrong in a way that no amount of reading caught and a phone found in
// seconds: the page was detected, the gate was clear, and the shutter simply
// never went. A camera is a bad place to discover that twice, so the decisions
// are pure functions now and this is what holds them.
//
//   node --test bench/capture.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTURE_CONFIRM_TIMING,
  GUIDANCE_DWELL_MS, GUIDANCE_HYSTERESIS, LIVE_SOURCE_FLOOR, MIN_EDGE_COVERAGE,
  LIVE_SEARCH_MIN_FILL, LIVE_PROXY_LONG_EDGE, LIVE_PROXY_RECOVERY_LONG_EDGE,
  PAPER_EVIDENCE_CONFIRMATIONS, PAPER_EVIDENCE_LOSS_MS, SEARCH_GUIDANCE,
  applyPreviewStabilizer, captureConfirmFrame, coverCropRect, fitLongEdge, isVerifiedQuad, liveGateVerdict,
  previewStabilizerFrame, resolveOverlayPhase, settledGuidance, settledPaperEvidence,
  settledScannerGuidance, shouldAutoCapture,
} from '../src/scan/capture.js';
import { easeQuad, isPageShaped } from '../src/scan/edges.js';
import { CAPTURE, CONDITIONING, QUALITY } from '../src/scan/contract.js';

const W = 240, H = 320;

test('unknown ImageCapture still resolution is not a false Closer blocker', () => {
  const verdict = liveGateVerdict({
    glare: 0, clipping: 0, fill: 0.7, sharpness: 1, skew: 0,
    pageLongEdge: 1500, steady: true, resolutionStatus: 'unknown',
  });
  assert.equal(verdict.blocking, null);
  assert.equal(verdict.hint, 'Ready');
});

test('canvas-grab still uses preview pixels as a hard resolution signal', () => {
  const verdict = liveGateVerdict({
    glare: 0, clipping: 0, fill: 0.7, sharpness: 1, skew: 0,
    pageLongEdge: 1500, steady: true, resolutionStatus: 'known',
  });
  assert.equal(verdict.blocking, 'resolution');
});
// A page quad, and the same page with every corner nudged by `px`.
const page = (px = 0) => [
  { x: 40 + px, y: 60 + px }, { x: 200 - px, y: 62 + px },
  { x: 198 - px, y: 280 - px }, { x: 42 + px, y: 278 - px },
];


test('portrait object-fit cover searches the same source crop the student sees', () => {
  const crop = coverCropRect(1280, 720, 390, 844);
  assert.ok(crop.x > 400, `expected landscape side margins to be cropped, got x=${crop.x}`);
  assert.equal(crop.y, 0);
  assert.ok(crop.width < 400);
  assert.equal(crop.height, 720);
  assert.ok(Math.abs(crop.width / crop.height - 390 / 844) < 0.001);
});

test('live detection is allowed to find a page before it is capture-sized', () => {
  const quad = [
    { x: 37, y: 37 }, { x: 63, y: 37 },
    { x: 63, y: 63 }, { x: 37, y: 63 },
  ];
  assert.ok(LIVE_SEARCH_MIN_FILL < 0.16);
  assert.equal(isPageShaped(quad, 100, 100), false, 'legacy live floor would still reject this early page');
  assert.equal(isPageShaped(quad, 100, 100, LIVE_SEARCH_MIN_FILL), true);
});

test('live proxies are bounded by long edge instead of portrait width', () => {
  assert.deepEqual(fitLongEdge(450, 1000, LIVE_PROXY_LONG_EDGE), { width: 216, height: 480 });
  assert.deepEqual(
    fitLongEdge(450, 1000, LIVE_PROXY_RECOVERY_LONG_EDGE),
    { width: 324, height: 720 },
  );
});

test('still-frame detection keeps its own permissive fill floor', () => {
  const quad = [
    { x: 34, y: 34 }, { x: 66, y: 34 },
    { x: 66, y: 66 }, { x: 34, y: 66 },
  ];
  assert.equal(isPageShaped(quad, 100, 100), false);
  assert.equal(isPageShaped(quad, 100, 100, 0.07), true);
});


test('preview stabilizer overscans and opposes small hand tremor', () => {
  const q = page();
  const first = previewStabilizerFrame(null, q, W, H);
  const moved = q.map((p) => ({ x: p.x + 8, y: p.y + 3 }));
  const second = previewStabilizerFrame(first, moved, W, H);
  assert.match(second.transform, /scale\(1\.060\)/);
  assert.ok(second.panX < 0, `expected a left pan against rightward tremor, got ${second.panX}`);
  assert.ok(second.panY < 0, `expected an upward pan against downward tremor, got ${second.panY}`);
  assert.ok(Math.abs(second.panX) <= W * 0.035 + 0.01);
  assert.ok(Math.abs(second.panY) <= H * 0.035 + 0.01);

  const point = applyPreviewStabilizer({ x: W / 2 + 8, y: H / 2 }, second, W, H);
  assert.ok(point.x < (W / 2 + 8) * second.scale,
    'overlay transform did not follow the video pan');
});

test('preview stabilizer resets instead of fighting a deliberate reframe', () => {
  const first = previewStabilizerFrame(null, page(), W, H);
  const reframed = page().map((p) => ({ x: p.x + 70, y: p.y }));
  const second = previewStabilizerFrame(first, reframed, W, H);
  assert.equal(second.panX, 0);
  assert.equal(second.panY, 0);
  assert.match(second.transform, /translate\(0\.00px, 0\.00px\)/);
});

// ── the shutter decision ───────────────────────────────────────────────────

const ready = {
  autoCapture: true, armed: true, blocking: null,
  consecutiveFinds: 8, globalConfirmations: 2,
};

test('an unblocked independently confirmed page fires after the steady window', () => {
  assert.equal(shouldAutoCapture({ ...ready, stableForMs: CAPTURE.STABILITY_MS }), true);
});

test('auto capture waits for real time, not just five fast tracker frames', () => {
  assert.equal(shouldAutoCapture({
    ...ready,
    stableForMs: CAPTURE.STABILITY_MS - 1,
    candidateForMs: CAPTURE.PATIENCE_MS - 1,
  }), false);
  assert.equal(shouldAutoCapture({
    ...ready,
    stableForMs: CAPTURE.STABILITY_MS,
    candidateForMs: CAPTURE.STABILITY_MS,
  }), true);
});

test('patience eventually fires a valid page that never becomes perfectly still', () => {
  assert.equal(shouldAutoCapture({
    ...ready,
    stableForMs: 0,
    candidateForMs: CAPTURE.PATIENCE_MS,
  }), true);
});

test('anything blocking holds the shutter', () => {
  assert.equal(shouldAutoCapture({ ...ready, blocking: 'glare' }), false);
});

test('auto off, or already fired, holds the shutter', () => {
  assert.equal(shouldAutoCapture({ ...ready, autoCapture: false }), false);
  assert.equal(shouldAutoCapture({ ...ready, armed: false }), false);
});

test('one lucky detection is not enough', () => {
  assert.equal(shouldAutoCapture({ ...ready, consecutiveFinds: 1 }), false);
  // Pinned against the constant rather than a literal, so raising the run
  // length (§7.3 asks for about five) cannot leave this test silently
  // asserting something weaker than what the phone requires.
  assert.equal(shouldAutoCapture({ ...ready, consecutiveFinds: CAPTURE.CONSECUTIVE_FINDS - 1 }), false);
  assert.equal(shouldAutoCapture({ ...ready, consecutiveFinds: CAPTURE.CONSECUTIVE_FINDS }), true);
});

test('a tracker that is not sure yet holds the shutter', () => {
  // The run-length guard used to carry this alone: five *searches* in a row
  // meant five independent whole-frame detections agreeing. Once the tracker
  // took over, five frames became five extrapolations of one detection over
  // eighty milliseconds, which is not the same evidence at all. 'tracking' is
  // the state reached only when all four corners have been found separately
  // and agree on a document-shaped quad, so it is what the guard rests on now.
  for (const state of ['searching', 'locking', 'reacquiring', 'recovering']) {
    assert.equal(shouldAutoCapture({ ...ready, trackState: state }), false,
      `the shutter fired while the tracker was still ${state}`);
  }
  assert.equal(shouldAutoCapture({ ...ready, trackState: 'tracking' }), true);
});

test('one global detection cannot auto-capture a random rectangle', () => {
  assert.equal(shouldAutoCapture({ ...ready, globalConfirmations: 1 }), false);
  assert.equal(shouldAutoCapture({
    ...ready, globalConfirmations: PAPER_EVIDENCE_CONFIRMATIONS,
  }), true);
});

test('quality blocking still overrides a confirmed lock', () => {
  assert.equal(shouldAutoCapture({ ...ready, blocking: 'focus' }), false);
});

// ── the live gate's own verdict ─────────────────────────────────────────────
// Extracted out of capture.js's step() so it can be checked directly, and so
// bench/verdict-agreement.mjs is comparing the actual decision a phone makes
// against scorePage()'s final verdict — not a hand-copied reimplementation of
// it that could quietly drift.

// Every signal comfortably inside its "ok" band — nothing should block or
// even earn advice beyond steadiness.
const clean = {
  glare: 0, clipping: 0, fill: 0.4, edgeCoverage: MIN_EDGE_COVERAGE + 0.1,
  sharpness: QUALITY.BLUR_WARN + 0.1, skew: 0, pageLongEdge: LIVE_SOURCE_FLOOR + 100,
};

test('every signal clean reads Ready without a stillness requirement', () => {
  assert.deepEqual(liveGateVerdict(clean), { blocking: null, hint: 'Ready' });
});

// Resolution comes first now, and it is a block rather than advice — the two
// changes are one change (AXON_FIX_BRIEF.md §7.3). A page that will land under
// CONDITIONING.MIN_LONG_EDGE is a page `acceptPage` refuses outright, so saying
// so while moving the phone closer still fixes it is the entire argument for
// having a live gate. Blocking here still never touches the shutter — it
// withholds *auto*-capture, and the student can always take the shot.
test('a page that will land under the capture floor blocks, ahead of every other check', () => {
  const v = liveGateVerdict({
    ...clean, pageLongEdge: LIVE_SOURCE_FLOOR - 1,
    glare: 1, clipping: 1, fill: 0, sharpness: 0, skew: 999, steady: false,
  });
  assert.equal(v.blocking, 'resolution');
});

test('too far away blocks on edge coverage, independent of frame aspect ratio', () => {
  const v = liveGateVerdict({ ...clean, edgeCoverage: MIN_EDGE_COVERAGE - 0.01 });
  assert.equal(v.blocking, 'distance');
});

test('low area fill alone does not block a fully framed portrait page', () => {
  const v = liveGateVerdict({ ...clean, fill: 0.32, edgeCoverage: MIN_EDGE_COVERAGE + 0.08 });
  assert.equal(v.blocking, null);
  assert.equal(v.hint, 'Ready');
});

test('warning-level glare is advice and does not disable Auto', () => {
  const v = liveGateVerdict({
    ...clean, glare: QUALITY.GLARE_WARN + 0.001,
  });
  assert.equal(v.blocking, null);
  assert.match(v.hint, /glare/i);
});

test('only failed glare blocks the live shutter', () => {
  const v = liveGateVerdict({
    ...clean, glare: QUALITY.GLARE_FAIL + 0.001,
  });
  assert.equal(v.blocking, 'glare');
});

test('uniform over-exposure is advisory because the durable scorer treats it as a warning', () => {
  const v = liveGateVerdict({ ...clean, clipping: QUALITY.CLIP_WARN + 0.001 });
  assert.equal(v.blocking, null);
  assert.match(v.hint, /bright/i);
});

test('warning-level softness is advice and does not disable Auto', () => {
  const v = liveGateVerdict({
    ...clean,
    sharpness: (QUALITY.BLUR_FAIL + QUALITY.BLUR_WARN) / 2,
  });
  assert.equal(v.blocking, null);
  assert.match(v.hint, /soft/i);
});

test('genuinely unreadable focus still blocks', () => {
  const v = liveGateVerdict({ ...clean, sharpness: QUALITY.BLUR_FAIL - 0.01 });
  assert.equal(v.blocking, 'focus');
});

// Null is "we could not measure this", not "this is zero". The focus window
// lands on blank paper often enough that treating the two the same would refuse
// a lightly-written page for being lightly written.
test('an unmeasurable focus window does not block', () => {
  const v = liveGateVerdict({ ...clean, sharpness: null });
  assert.equal(v.blocking, null);
  assert.equal(v.hint, 'Ready');
});

test('skew past the warn line is advisory, never blocking', () => {
  const v = liveGateVerdict({ ...clean, skew: QUALITY.SKEW_WARN_DEG + 1 });
  assert.equal(v.blocking, null);
  assert.match(v.hint, /square/i);
});

test('a page just over the floor is not blocked on resolution', () => {
  const v = liveGateVerdict({ ...clean, pageLongEdge: CONDITIONING.MIN_LONG_EDGE });
  assert.equal(v.blocking, null);
});

// ── guidance that does not nag ──────────────────────────────────────────────
//
// The gate is consulted every frame now rather than a dozen times a second,
// which made two latent problems into visible ones. A measurement sitting on
// a threshold does not produce one answer, it produces both, alternating; and
// a line of advice that changes several times a second is not advice.

test('a measurement sitting on the line does not answer twice', () => {
  // Right on the distance threshold, where a hand-held phone crosses back and
  // forth on ordinary jitter.
  const onTheLine = { ...clean, edgeCoverage: MIN_EDGE_COVERAGE };
  // Nothing showing: the plain reading, which is that this is fine.
  assert.equal(liveGateVerdict(onTheLine).blocking, null);
  // Already warning about distance: it stays, because coming back to exactly
  // the line is not evidence that anything changed.
  assert.equal(liveGateVerdict(onTheLine, 'distance').blocking, 'distance');
  // And it goes as soon as the page is genuinely clear of the line.
  const clear = { ...clean, edgeCoverage: MIN_EDGE_COVERAGE * (1 + GUIDANCE_HYSTERESIS) + 0.001 };
  assert.equal(liveGateVerdict(clear, 'distance').blocking, null);
});

test('the margin only ever delays leaving a blocking failure, never entering one', () => {
  // Holding a different reason must not soften a genuinely failed focus read.
  const soft = { ...clean, sharpness: QUALITY.BLUR_FAIL - 0.001 };
  assert.equal(liveGateVerdict(soft, 'distance').blocking, 'focus');
  assert.equal(liveGateVerdict(soft, null).blocking, 'focus');
});

test('one warning replacing another waits long enough to be read', () => {
  const showing = { hint: 'Move closer so the page fills more of the frame', blocking: 'distance', since: 1000 };
  const glare = { hint: 'Light is bouncing off the page — tilt it slightly away from the light', blocking: 'glare' };
  assert.equal(settledGuidance(showing, glare, 1000 + GUIDANCE_DWELL_MS - 1).hint, showing.hint);
  assert.equal(settledGuidance(showing, glare, 1000 + GUIDANCE_DWELL_MS).hint, glare.hint);
});

test('starting to block, and stopping, are both immediate', () => {
  // Into a blocked state: `blocking` is what holds the automatic shutter, so a
  // page that has just gone soft has to stop it on that frame.
  const fine = { hint: 'Ready', blocking: null, since: 1000 };
  const soft = { hint: 'Hold still — the page is not sharp yet', blocking: 'focus' };
  assert.equal(settledGuidance(fine, soft, 1001).blocking, 'focus');

  // Out of one: the student has just fixed it and should be told at once.
  const showing = { hint: 'Move closer so the page fills more of the frame', blocking: 'distance', since: 1000 };
  assert.equal(settledGuidance(showing, { hint: 'Ready', blocking: null }, 1001).hint, 'Ready');
});

test('an unchanged hint does not restart its own clock', () => {
  // Otherwise a hint that is genuinely steady would never age past the dwell,
  // and the next one that needed to replace it never could.
  const showing = { hint: 'Hold still', blocking: null, since: 1000 };
  assert.equal(settledGuidance(showing, { hint: 'Hold still', blocking: null }, 5000).since, 1000);
});

// ── paper-presence evidence ─────────────────────────────────────────────────

test('a tentative rectangle stays on calm searching guidance', () => {
  const candidate = settledPaperEvidence(null, {
    globalConfirmations: PAPER_EVIDENCE_CONFIRMATIONS - 1,
    geometryReady: true,
    observedGeometry: true,
  }, 1000);
  const lock = liveGateVerdict({ ...clean, geometryReady: false });
  const shown = settledScannerGuidance(null, lock, candidate, 1000);

  assert.equal(candidate.confirmed, false);
  assert.equal(shown.hint, SEARCH_GUIDANCE.hint);
  assert.equal(shown.blocking, null);
});

test('alternating false candidates and misses never flip into locking guidance', () => {
  let evidence = null;
  let guidance = null;
  const lock = liveGateVerdict({ ...clean, geometryReady: false });

  for (let frame = 0; frame < 20; frame++) {
    const candidate = frame % 2 === 0;
    evidence = settledPaperEvidence(evidence, {
      globalConfirmations: candidate ? PAPER_EVIDENCE_CONFIRMATIONS - 1 : 0,
      geometryReady: candidate,
      observedGeometry: candidate,
    }, frame * 16);
    guidance = settledScannerGuidance(guidance, lock, evidence, frame * 16);
    assert.equal(guidance.hint, SEARCH_GUIDANCE.hint, `guidance flipped on frame ${frame}`);
  }
});

test('locking guidance only appears after independently confirmed paper evidence', () => {
  const evidence = settledPaperEvidence(null, {
    globalConfirmations: PAPER_EVIDENCE_CONFIRMATIONS,
    geometryReady: true,
    observedGeometry: true,
  }, 1000);
  const lock = liveGateVerdict({ ...clean, geometryReady: false });
  const shown = settledScannerGuidance(null, lock, evidence, 1000);

  assert.equal(evidence.confirmed, true);
  assert.equal(shown.blocking, 'tracking');
  assert.match(shown.hint, /lock onto all four corners/i);
});

test('confirmed paper presence survives brief misses, then calmly returns to search', () => {
  let evidence = settledPaperEvidence(null, {
    globalConfirmations: PAPER_EVIDENCE_CONFIRMATIONS,
    geometryReady: true,
    observedGeometry: true,
  }, 1000);

  evidence = settledPaperEvidence(evidence, {
    globalConfirmations: 0,
    geometryReady: false,
    observedGeometry: false,
  }, 1000 + PAPER_EVIDENCE_LOSS_MS - 1);
  assert.equal(evidence.confirmed, true, 'a brief miss discarded confirmed paper evidence');

  evidence = settledPaperEvidence(evidence, {
    globalConfirmations: 0,
    geometryReady: false,
    observedGeometry: false,
  }, 1000 + PAPER_EVIDENCE_LOSS_MS);
  const lock = liveGateVerdict({ ...clean, geometryReady: false });
  const shown = settledScannerGuidance(null, lock, evidence, 1000 + PAPER_EVIDENCE_LOSS_MS);
  assert.equal(evidence.confirmed, false);
  assert.equal(shown.hint, SEARCH_GUIDANCE.hint);
});

// ── capture-confirm overlay ─────────────────────────────────────────────────

test('overlay phases are explicit and confirmation takes priority', () => {
  assert.equal(resolveOverlayPhase(), 'searching');
  assert.equal(resolveOverlayPhase({
    hasQuad: true, trackState: 'tracking', trackConfidence: 1,
  }), 'locked');
  assert.equal(resolveOverlayPhase({
    hasQuad: true, trackState: 'recovering', trackConfidence: 1,
  }), 'searching');
  assert.equal(resolveOverlayPhase({
    confirming: true, hasQuad: false, trackState: 'searching', trackConfidence: 0,
  }), 'captured-confirm');
});

test('capture confirmation follows the 40/90/160/180ms sequence', () => {
  assert.deepEqual(captureConfirmFrame(0), { active: true, morph: 0, edges: 0, opacity: 1 });
  assert.equal(captureConfirmFrame(CAPTURE_CONFIRM_TIMING.freezeEnd - 1).morph, 0);
  assert.ok(captureConfirmFrame(65).morph > 0);
  assert.equal(captureConfirmFrame(CAPTURE_CONFIRM_TIMING.morphEnd).morph, 1);
  assert.equal(captureConfirmFrame(CAPTURE_CONFIRM_TIMING.morphEnd).edges, 0);
  assert.ok(captureConfirmFrame(125).edges > 0);
  assert.equal(captureConfirmFrame(CAPTURE_CONFIRM_TIMING.edgesEnd).edges, 1);
  assert.ok(captureConfirmFrame(170).opacity < 1);
  assert.equal(captureConfirmFrame(CAPTURE_CONFIRM_TIMING.end).active, false);
});

test('reduced motion shows a static accepted rectangle instead of drawing it', () => {
  const frame = captureConfirmFrame(0, true);
  assert.equal(frame.morph, 1);
  assert.equal(frame.edges, 1);
  assert.equal(frame.opacity, 1);
});

test('capture confirmation requires a real four-point verified quad', () => {
  assert.equal(isVerifiedQuad(page()), true);
  assert.equal(isVerifiedQuad(null), false);
  assert.equal(isVerifiedQuad(page().slice(0, 3)), false);
  assert.equal(isVerifiedQuad([...page().slice(0, 3), { x: NaN, y: 4 }]), false);
});

// ── the brackets: deadzone and adaptive damping ────────────────────────────
//
// scan-tracking-zoom-stability-2026-09-08 §2/§3. A fixed-factor lerp did both
// of these jobs badly at once, and the two complaints it produced were
// "the bracket trembles when my hand does" and "it moves a certain distance
// and then seems to stall".

const FRAME = { width: 480, height: 640 };

test('a deliberate reframe is answered on the first frame, not the ninth', () => {
  // The whole page moves a fifth of the frame — the student turned to the next
  // one. The fixed 0.35 lerp this replaced gave that the same gentle catch-up
  // it gave a millimetre of wobble, which is what "it moves a certain distance
  // and then stalls" was describing. The first frame is the one that matters:
  // it is where the difference between sluggish and responsive is felt.
  const from = page();
  const to = from.map((p) => ({ x: p.x + 96, y: p.y }));
  const closed = (easeQuad(from, to, FRAME)[0].x - from[0].x) / 96;
  assert.ok(closed > 0.8,
    `closed only ${(closed * 100).toFixed(0)}% of a full reframe on the first frame`);
  // ...and it is still all the way there shortly after, rather than approaching
  // forever.
  let at = from;
  for (let i = 0; i < 8; i++) at = easeQuad(at, to, FRAME);
  assert.ok(Math.abs(to[0].x - at[0].x) < 96 * 0.03,
    'eight frames on and the reframe has still not landed');
});

test('a small correction stays damped', () => {
  // Nothing like a reframe: this must still be eased rather than snapped, or
  // every detection wobble would land on screen at full amplitude.
  const from = page();
  const to = from.map((p) => ({ x: p.x + 12, y: p.y }));
  const moved = easeQuad(from, to, FRAME)[0].x - from[0].x;
  assert.ok(moved > 12 * 0.35 && moved < 12 * 0.70,
    `moved ${moved.toFixed(1)}px of 12 in one frame — smoothing is no longer responsive`);
});

test('easing always converges, never parks short of the page', () => {
  // The first attempt at tremor rejection put a deadzone here, comparing the
  // target against where the brackets already were — which froze them wherever
  // the gap happened to fall under it, a permanent visible offset rather than a
  // still bracket. Rejecting tremor is capture.js's job, using the steady
  // window's anchor; this function's job is to arrive.
  const from = page();
  const to = from.map((p) => ({ x: p.x + 96, y: p.y }));
  let at = from;
  for (let i = 0; i < 40; i++) at = easeQuad(at, to, FRAME);
  assert.ok(Math.abs(to[0].x - at[0].x) < 0.01,
    `parked ${Math.abs(to[0].x - at[0].x).toFixed(2)}px short of the page`);
});

test('a target that does not move lets the brackets come to rest', () => {
  // What capture.js hands this while the page is held still: the steady
  // window's anchor, unchanged frame after frame. The brackets must settle on
  // it and stop, which is the whole of "the bracket does not tremble".
  const held = page();
  let at = page(6);
  for (let i = 0; i < 40; i++) at = easeQuad(at, held, FRAME);
  assert.ok(Math.hypot(at[0].x - held[0].x, at[0].y - held[0].y) < 0.01,
    'the brackets never came to rest on a page that never moved');
});

test('without a frame size the old fixed factor still applies', () => {
  // Callers with no frame to measure a share of keep exactly the behaviour they
  // had, rather than silently getting a different curve in a unit nobody told
  // this function about.
  const from = page();
  const to = from.map((p) => ({ x: p.x + 100, y: p.y }));
  assert.equal(easeQuad(from, to)[0].x, from[0].x + 35);
});

// ── the pinch-zoom guard ───────────────────────────────────────────────────

test('a pinched viewport holds the shutter', () => {
  // scan-tracking-zoom-stability-2026-09-08 §1. Every screen-space number the
  // decision rests on was measured through a mapping the pinch broke, so the
  // one thing that must not happen is a photograph of a frame nobody could see
  // straight. The gesture is blocked at source; this is the backstop.
  assert.equal(shouldAutoCapture({ ...ready, viewportScaled: true }), false);
  assert.equal(shouldAutoCapture({ ...ready, viewportScaled: false }), true);
});
