#!/usr/bin/env node
// The precision/recall report scansystemredesign.md §4.5 and the follow-up
// implementation prompt both ask for: false-accept rate (a bad photo the
// gate let through) and false-reject rate (a good photo the gate blocked or
// warned unnecessarily), tracked continuously rather than eyeballed.
//
// golden.test.mjs pins pass/fail expectations per fixture as a CI check.
// This is the same fixtures and the same functions, but as a report — run it
// locally after a threshold change to see the actual rates move, not just
// whether the pinned assertions still hold.
//
//   node bench/golden-report.mjs
//
// The golden set here is small — five real captured pages, two real
// viewfinder frames, one deliberate non-page scene — because that is what
// this repo has real photographs for today. The mechanism is what matters:
// every fixture added to bench/fixtures/ with an entry in FIXTURES below is
// one more data point in this report and in golden.test.mjs, for free.

import { detectQuad } from '../src/scan/edges.js';
import { paperScore } from '../src/scan/quad.js';
import { scorePage } from '../src/scan/quality.js';
import { QUALITY } from '../src/scan/contract.js';
import { decodeFixture } from './decode.mjs';

const PROXY_W = 240;
const PAPER_MIN = 0.85;
const VIEWFINDER_FEED = { left: 0, top: 110, width: 1440, height: 1075 };

/**
 * Ground truth for each fixture. `page: true` means a real, marked exam page
 * is genuinely in shot; `false` means it genuinely is not. This is the only
 * hand-labelled input the report needs — everything else is measured.
 */
const FIXTURES = [
  { name: 'page-tilted.jpg', page: true },
  { name: 'page-straight.jpg', page: true },
  { name: 'page-angled.jpg', page: true },
  { name: 'page-skew.jpg', page: true },
  { name: 'page-clean.jpg', page: false }, // a room, no page in shot
  { name: 'viewfinder-a.jpg', page: true, crop: VIEWFINDER_FEED },
  { name: 'viewfinder-b.jpg', page: true, crop: VIEWFINDER_FEED },
];

async function measure(fixture) {
  const proxy = await decodeFixture(fixture.name, { crop: fixture.crop, resizeWidth: PROXY_W });
  const quad = detectQuad(proxy);
  const paper = quad ? paperScore(proxy, quad).paper : null;
  const detected = !!quad && paper >= PAPER_MIN;

  const native = await decodeFixture(fixture.name, { crop: fixture.crop });
  const gate = fixture.page
    ? scorePage(native, { longEdge: Math.max(native.width, native.height) })
    : null;

  return { ...fixture, detected, paper, gate };
}

function rate(n, of) { return of ? `${((n / of) * 100).toFixed(0)}%` : '—'; }

async function main() {
  const results = await Promise.all(FIXTURES.map(measure));

  console.log('Quad detection · per fixture\n');
  for (const r of results) {
    const truth = r.page ? 'page ' : 'no-page';
    const call = r.detected ? 'detected' : 'not detected';
    const flag = r.detected !== r.page ? '  <-- ' + (r.page ? 'FALSE REJECT' : 'FALSE ACCEPT') : '';
    console.log(`  ${r.name.padEnd(22)} truth=${truth}  paper=${r.paper?.toFixed(2) ?? ' — '}  ${call}${flag}`);
  }

  const realPages = results.filter((r) => r.page);
  const noPages = results.filter((r) => !r.page);
  const falseRejects = realPages.filter((r) => !r.detected).length;
  const falseAccepts = noPages.filter((r) => r.detected).length;

  console.log('\nQuad detection · rates\n');
  console.log(`  false-reject rate  ${rate(falseRejects, realPages.length)}  (${falseRejects}/${realPages.length} real pages not detected)`);
  console.log(`  false-accept rate  ${rate(falseAccepts, noPages.length)}  (${falseAccepts}/${noPages.length} non-pages detected as pages)`);

  console.log('\nQuality gate (native resolution) · real pages only\n');
  const blurRejects = realPages.filter((r) => r.gate.signals.sharpness < QUALITY.BLUR_WARN);
  for (const r of realPages) {
    console.log(`  ${r.name.padEnd(22)} verdict=${r.gate.verdict.padEnd(4)} sharpness=${r.gate.signals.sharpness.toFixed(2)} glare=${r.gate.signals.glare.toFixed(3)} long_edge=${r.gate.signals.long_edge}`);
  }
  console.log(`\n  blur false-reject rate  ${rate(blurRejects.length, realPages.length)}  (${blurRejects.length}/${realPages.length} sharp real pages scored soft)`);

  console.log('\nThis golden set is small. Treat these as directional, not calibrated —');
  console.log('the numbers to trust are the ones this grows into as more fixtures land.');
}

main();
