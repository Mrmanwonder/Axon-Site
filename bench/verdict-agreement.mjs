#!/usr/bin/env node
// The live/final agreement check scan-system-redesign-plan.md asked for: does
// the live gate's decision (let the shutter fire, or block it) hold up
// against `scorePage()`'s verdict on the actual captured still?
//
// A naive symmetric "did they agree" number turns out to be the wrong
// question against *this* codebase's current design, not a stale one — see
// contract.js's own comment on GLARE_WARN vs GLARE_FAIL: the live gate is
// deliberately more sensitive than the final check, because blocking the
// shutter costs nothing while the page is still in front of the student and
// a retake later costs a trip back to the schoolbag. So "the live gate
// blocked something the final check would have accepted" is not a
// disagreement to fix, it is the gate doing its job cheaply. Measuring that
// as a failure would push a future change toward *loosening* the live gate
// to chase a number, which is the wrong direction.
//
// The disagreement that actually matters is the other one: the live gate
// said "Ready" — the student was told to shoot — and the final check on the
// resulting still fails it anyway. That is the case the whole gate exists to
// prevent, and it is the only one this report treats as a defect.
//
//   node bench/verdict-agreement.mjs

import { detectQuad } from '../src/scan/edges.js';
import { quadFill, quadSize } from '../src/scan/geometry.js';
import { focusWindowRect, measureQuad, scorePage, sharpness, skewDegrees } from '../src/scan/quality.js';
import { liveGateVerdict } from '../src/scan/capture.js';
import { CAPTURE, CONDITIONING, QUALITY } from '../src/scan/contract.js';
import { decodeFixture } from './decode.mjs';

const PROXY_W = 240;        // capture.js's PROXY_WIDTH
const FOCUS_WINDOW = 384;   // capture.js's FOCUS_WINDOW
const VIEWFINDER_FEED = { left: 0, top: 110, width: 1440, height: 1075 };

// The same real fixtures golden.test.mjs and golden-report.mjs use — see
// their own notes on why this set is still small. `viewfinder-a/b.jpg` are
// genuine live-viewfinder frames; the `page-*.jpg` fixtures are captured
// stills, simulated here as what the live gate would have seen a moment
// earlier by re-deriving the same 240px proxy capture.js itself searches.
const FIXTURES = [
  { name: 'page-tilted.jpg' },
  { name: 'page-straight.jpg' },
  { name: 'page-angled.jpg' },
  { name: 'page-skew.jpg' },
  { name: 'viewfinder-a.jpg', crop: VIEWFINDER_FEED },
  { name: 'viewfinder-b.jpg', crop: VIEWFINDER_FEED },
];

/**
 * Re-derive exactly what capture.js's step() would have computed for one
 * fixture: the live signals on a 240px proxy, and the final scorePage()
 * verdict on the captured still at native resolution. Exported so the pinned
 * test can assert on the same numbers this report prints, rather than a
 * second, only-loosely-related computation.
 */
export async function measure({ name, crop = null }) {
  const native = await decodeFixture(name, { crop });
  const proxy = await decodeFixture(name, { crop, resizeWidth: PROXY_W });
  const quad = detectQuad(proxy);
  const final = scorePage(native, { longEdge: Math.max(native.width, native.height) });

  if (!quad) {
    // No quad on the proxy is not "agreement" or "disagreement" — there is no
    // live verdict to compare, because the live gate would not have offered
    // the shutter at all. Reported separately so it cannot silently inflate
    // either count.
    return { name, quad: false, final };
  }

  const fill = quadFill(quad, proxy.width, proxy.height);
  const exposure = measureQuad(proxy, quad);
  const skew = skewDegrees(quad);
  const size = quadSize(quad);
  // Mirrors capture.js's own `next.pageLongEdge` line exactly: the proxy
  // quad's size, scaled up by the ratio between the real frame and the
  // proxy it was found on.
  const pageLongEdge = Math.round(Math.max(size.width, size.height) * (native.width / proxy.width));

  // Focus the way the phone now measures it: not on the 240px proxy — which is
  // the defect this whole change exists to remove, since the detail is not in
  // those pixels at all — but on a native-resolution window of the page
  // interior, drawn at the canonical scale `scorePage` uses. `focusWindowRect`
  // is imported rather than reimplemented so this cannot drift from what
  // capture.js actually cuts.
  const focus = focusWindow(native, quad, proxy, pageLongEdge);

  // Simulating the instant of the shot, once the student has actually held
  // the page still — steadiness is a timing state machine (steadyWindow),
  // not a property of one frame, so it is not what this report is checking.
  const live = liveGateVerdict({
    glare: exposure.glare, clipping: exposure.clipping, fill,
    sharpness: focus, skew, pageLongEdge, steady: true,
  });

  // Every condition the gate would have tripped, not just the first one it
  // returns. The gate short-circuits by design — the student gets one
  // instruction at a time — but a report that only ever showed the first
  // blocker would hide the other five behind whichever fixture happens to be
  // smallest, which is exactly what this corpus does.
  const blockers = [
    pageLongEdge < CONDITIONING.MIN_LONG_EDGE ? 'resolution' : null,
    fill < CAPTURE.MIN_FILL ? 'distance' : null,
    exposure.glare > QUALITY.GLARE_WARN ? 'glare' : null,
    exposure.clipping > QUALITY.CLIP_WARN ? 'exposure' : null,
    focus !== null && focus < QUALITY.BLUR_WARN ? 'focus' : null,
  ].filter(Boolean);

  return {
    name, quad: true, live, final, blockers,
    signals: { fill, sharpness: focus, glare: exposure.glare, clipping: exposure.clipping, skew, pageLongEdge },
    // The one disagreement this report treats as real: the live gate said go
    // and the final check rejected it anyway.
    falseGo: live.blocking === null && final.verdict === 'fail',
  };
}

/**
 * The focus window, cut out of the native decode rather than drawn from a video
 * element. Same rectangle, same canonical scale, same measurement — the only
 * difference is that a bench script has pixels in an array and a phone has them
 * in a `<video>`.
 */
function focusWindow(native, quadInProxy, proxy, pageLongEdge) {
  const kx = native.width / proxy.width, ky = native.height / proxy.height;
  const inFrame = quadInProxy.map((p) => ({ x: p.x * kx, y: p.y * ky }));
  const rect = focusWindowRect(inFrame, native.width, native.height, pageLongEdge, FOCUS_WINDOW);
  if (!rect) return null;

  const cut = { data: new Uint8ClampedArray(rect.size * rect.size * 4), width: rect.size, height: rect.size };
  for (let y = 0; y < rect.size; y++) {
    const src = ((rect.sy + y) * native.width + rect.sx) * 4;
    cut.data.set(native.data.subarray(src, src + rect.size * 4), y * rect.size * 4);
  }
  // sharpness() takes it from here: the cut is in frame pixels and the ratio to
  // canonical is target/size, which is what a drawImage into `target` applies.
  const read = sharpness(cut, { scale: rect.target / rect.size });
  return read.blank ? null : read.score;
}

async function main() {
  const results = await Promise.all(FIXTURES.map(measure));

  console.log('Live gate vs. final scorePage() · per fixture\n');
  for (const r of results) {
    if (!r.quad) { console.log(`  ${r.name.padEnd(20)} no quad on the proxy — no live verdict to compare`); continue; }
    const flag = r.falseGo ? '  <-- FALSE "GO" (the case that matters)' : '';
    console.log(
      `  ${r.name.padEnd(20)} live=${String(r.live.blocking ?? 'go').padEnd(10)} final=${r.final.verdict.padEnd(4)}` +
      `  [sharp=${r.signals.sharpness === null ? 'n/a  ' : r.signals.sharpness.toFixed(3)}` +
      ` glare=${r.signals.glare.toFixed(4)} clip=${r.signals.clipping.toFixed(4)} long=${r.signals.pageLongEdge}]` +
      `  all-blockers=${r.blockers.length ? r.blockers.join(',') : 'none'}${flag}`,
    );
  }

  const withQuad = results.filter((r) => r.quad);
  const falseGoes = withQuad.filter((r) => r.falseGo);
  const liveBlockedFinalFine = withQuad.filter((r) => r.live?.blocking !== null && r.final.verdict !== 'fail');

  console.log('\nRates\n');
  console.log(`  false "go" rate        ${falseGoes.length}/${withQuad.length} — live said Ready, final failed it. This is the number that should stay at 0.`);
  console.log(`  extra-cautious rate     ${liveBlockedFinalFine.length}/${withQuad.length} — live blocked something the final check would have accepted. Expected: the live gate blocks at the *warn* lines and refuses anything that will land under the capture floor, so this is the gate costing a free retake, not a defect.`);

  console.log('\nThis is six fixtures, and every one of them is under the capture floor:');
  console.log('they are downscaled derivatives (~700-1030px), not the 2400px+ pages the');
  console.log('gate is calibrated for, so "resolution" masks the other conditions in the');
  console.log('gate column. The all-blockers column is there for that reason — read it');
  console.log('rather than the live= column when judging the other four. Treat the');
  console.log('false-"go" rate as directional, not calibrated: the number to trust is the');
  console.log('one this grows into as real, full-resolution captures land in');
  console.log('bench/fixtures/, the same caveat golden-report.mjs makes.');
}

main();
