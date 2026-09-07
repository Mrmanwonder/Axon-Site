#!/usr/bin/env node
// Does the detector still find the page when the phone is not held square?
//
// Every page in bench/fixtures/ was photographed roughly square-on, which is
// why this blind spot survived two rounds of detector work: the corpus could
// not see it. The line search in edges.js sorts candidate lines into
// "vertical" and "horizontal" families with a hard ±40° test (AXIS_TOLERANCE),
// so a page rotated toward 45° has all four of its edges sitting on the
// boundary of that split, and the pairing has nothing to pair.
//
//   node bench/rotation-report.mjs
//
// Rotation is applied by decodeFixture onto a desk-toned background, so what
// is being measured is "the same real page, held at an angle" rather than a
// synthetic shape on white.

import { detectQuad } from '../src/scan/edges.js';
import { paperScore } from '../src/scan/quad.js';
import { decodeFixture } from './decode.mjs';

const PROXY_W = 240;
const PAGES = ['page-tilted.jpg', 'page-straight.jpg', 'page-angled.jpg', 'page-skew.jpg'];
const ANGLES = [0, 10, 20, 30, 40, 45, 50, 60, 75, 90];

const rows = [];
let found = 0, total = 0;

for (const name of PAGES) {
  for (const angle of ANGLES) {
    const proxy = await decodeFixture(name, { rotate: angle || null, resizeWidth: PROXY_W });
    const quad = detectQuad(proxy);
    const paper = quad ? paperScore(proxy, quad).paper : null;
    rows.push({ name, angle, ok: !!quad, paper });
    total++;
    if (quad) found++;
  }
}

console.log('\nDetection against rotation · per fixture\n');
process.stdout.write('  ' + 'fixture'.padEnd(22));
for (const a of ANGLES) process.stdout.write(String(a + '°').padStart(6));
console.log();
for (const name of PAGES) {
  process.stdout.write('  ' + name.padEnd(22));
  for (const a of ANGLES) {
    const row = rows.find((r) => r.name === name && r.angle === a);
    process.stdout.write((row.ok ? '  ok  ' : '  --  '));
  }
  console.log();
}

console.log('\nDetection against rotation · rate\n');
console.log(`  found ${found}/${total}  (${Math.round((found / total) * 100)}%)`);

const byAngle = ANGLES.map((a) => {
  const at = rows.filter((r) => r.angle === a);
  return { a, ok: at.filter((r) => r.ok).length, n: at.length };
});
console.log('\n  by angle:');
for (const { a, ok, n } of byAngle) console.log(`    ${String(a + '°').padStart(4)}  ${ok}/${n}`);

console.log('\nA page held at an angle is a page, and a "--" in the 20°–75° band is a');
console.log('student holding a marked paper at a camera that says it sees nothing.');
console.log('\nAt 90° a portrait fixture becomes a landscape frame the page then fills');
console.log('almost entirely, and isPageShaped refuses it on MAX_FILL — by design:');
console.log('a page with no visible edges has nothing to deskew and nothing to fire');
console.log('the shutter at. Those are the rule working, not the detector failing.\n');
