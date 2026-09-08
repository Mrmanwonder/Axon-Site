#!/usr/bin/env node
// What illumination flattening does to a page, and what it costs the red ink.
//
// The change this measures: flattening used to run only on the rescue path, so
// a page large enough not to need rescuing got no lighting correction at all —
// which is exactly the common case where a hand or a desk-lamp shadow shows up.
// It runs on every page now.
//
// The reason to measure rather than argue: the teacher's red pen is the whole
// product, and any stage that touches pixels before `separateLayers` sees them
// has to be shown not to cost it anything. Flattening is a per-pixel scalar
// gain — it cannot change a pixel's hue, only its level — so the expectation is
// "unchanged or better", and colour.js estimating one paper baseline for a
// whole sheet is the reason to expect better: on a page with a gradient there
// is no single paper level, so one end of the sheet gets compared against the
// other end's paper.
//
//   node bench/flatten-report.mjs
//
// Three numbers per fixture:
//
//   evenness   how flat the lighting is, as the spread of a heavily blurred
//              copy of the page over its own mean. Lower is flatter. This is
//              the thing flattening is for, so it should fall on a shadowed
//              page and barely move on an evenly lit one.
//   red px     pixels the teacher-ink separation claims, before and after.
//   marks      connected components it resolves those into — the number that
//              actually reaches attribution.

import { readdir } from 'node:fs/promises';
import { decodeFixture } from './decode.mjs';
import { flattenPage } from '../src/scan/enhance.js';
import { separateLayers } from '../src/scan/layers.js';

// The size production actually conditions a page at — CONDITIONING.PAGE_LONG_EDGE
// on the LONG edge, which for a portrait page is nothing like 2400 wide.
//
// Getting this wrong is not a detail. Red separation is a per-pixel colour
// judgement and a downscale bleeds chroma across strokes, so the red share of
// the ink — which decides whether the whole page is written off as
// `student_wrote_red` — moves with the scale it is measured at. Measured on a
// 1100px working copy this change looked like it destroyed 490 teacher marks.
// The number to trust is the one taken at the size the phone actually produces.
const LONG_EDGE = 2400;

/**
 * How uneven the lighting across a page is.
 *
 * A wide box blur leaves only the illumination field — page detail has no say
 * at this radius — and its coefficient of variation says how far the bright end
 * is from the dark end. Deliberately not the same estimator flattening itself
 * uses: measuring with the tool being tested would report on the tool.
 */
function evenness(img) {
  const { data, width, height } = img;
  // A coarse grid is all this needs; the field has no high frequencies.
  const cols = 24, rows = Math.max(1, Math.round(24 * height / width));
  const cellW = Math.ceil(width / cols), cellH = Math.ceil(height / rows);
  const cells = [];
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let sum = 0, n = 0;
      for (let y = cy * cellH; y < Math.min(height, (cy + 1) * cellH); y += 3) {
        for (let x = cx * cellW; x < Math.min(width, (cx + 1) * cellW); x += 3) {
          const i = (y * width + x) * 4;
          sum += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
          n++;
        }
      }
      if (n) cells.push(sum / n);
    }
  }
  const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
  const variance = cells.reduce((a, b) => a + (b - mean) ** 2, 0) / cells.length;
  return mean > 0 ? Math.sqrt(variance) / mean : 0;
}

/**
 * A hand's shadow laid across a real page.
 *
 * Synthetic, and labelled as such wherever its numbers are used — the corpus
 * has no photograph with a shadow in it, and the alternative to synthesising
 * one is not measuring the thing the change is for. A soft-edged darkening over
 * part of the sheet is what a phone or a hand between a lamp and the paper
 * actually does: no colour cast, no hard edge, just less light.
 */
function shadowed(img, { depth = 0.55 } = {}) {
  const { data, width, height } = img;
  const out = new Uint8ClampedArray(data);
  // A soft diagonal band across the upper-left, the way a hand holding a phone
  // over a page on a desk casts one.
  const softness = Math.max(width, height) * 0.28;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const along = (x * 0.7 + y * 0.7) - (width * 0.55);
      const t = Math.max(0, Math.min(1, 0.5 - along / softness));
      const k = 1 - depth * t;
      const i = (y * width + x) * 4;
      out[i] *= k; out[i + 1] *= k; out[i + 2] *= k;
    }
  }
  return { data: out, width, height };
}

const dir = new URL('./fixtures/', import.meta.url);
const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();

const rows = [];
for (const file of files) {
  const probe = await decodeFixture(file, { resizeWidth: 64 });
  const width = Math.round(LONG_EDGE * Math.min(1, probe.width / probe.height));
  const native = await decodeFixture(file, { resizeWidth: width });
  for (const [label, img] of [['as shot', native], ['+ shadow', shadowed(native)]]) {
    const started = performance.now();
    const flattening = flattenPage(img);
    const flat = flattening.image;
    const ms = performance.now() - started;

    const before = separateLayers(img);
    const after = separateLayers(flat);
    rows.push({
      file, label, ms,
      evenBefore: evenness(img), evenAfter: evenness(flat),
      marksBefore: before.teacher.components.length,
      marksAfter: after.teacher.components.length,
      redBefore: before.coverage.red_share_of_ink,
      redAfter: after.coverage.red_share_of_ink,
      fallbackBefore: before.fallback, fallbackAfter: after.fallback,
      applied: flattening.applied, spread: flattening.spread,
    });
  }
}

const pct = (a, b) => (a === 0 ? (b === 0 ? '  0%' : '  +∞') : `${(((b - a) / a) * 100 >= 0 ? '+' : '')}${(((b - a) / a) * 100).toFixed(0)}%`);

console.log(`\nIllumination flattening · pages at ${LONG_EDGE}px on the long edge\n`);
console.log('  fixture                     lighting     evenness        red share      marks    spread');
console.log('                                          before  after   before  after   before after');
for (const r of rows) {
  console.log(
    `  ${(r.file.slice(0, 24)).padEnd(25)} ${r.label.padEnd(9)} ` +
    `${r.evenBefore.toFixed(3).padStart(6)} ${r.evenAfter.toFixed(3).padStart(6)}  ` +
    `${r.redBefore.toFixed(3).padStart(6)} ${r.redAfter.toFixed(3).padStart(6)}  ` +
    `${String(r.marksBefore).padStart(6)} ${String(r.marksAfter).padStart(5)}  ` +
    `${r.spread.toFixed(2).padStart(5)} ${r.applied ? 'flattened' : 'left alone'}`,
  );
}

const shadowRows = rows.filter((r) => r.label === '+ shadow');
const cleanRows = rows.filter((r) => r.label === 'as shot');
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

console.log('\n  ── what flattening did to the lighting ──');
console.log(`  shadowed pages   evenness ${mean(shadowRows.map((r) => r.evenBefore)).toFixed(3)} -> ${mean(shadowRows.map((r) => r.evenAfter)).toFixed(3)}`);
console.log(`  as shot          evenness ${mean(cleanRows.map((r) => r.evenBefore)).toFixed(3)} -> ${mean(cleanRows.map((r) => r.evenAfter)).toFixed(3)}`);

console.log('\n  ── what it cost the teacher\'s ink ──');
const flipped = rows.filter((r) => r.fallbackBefore !== r.fallbackAfter);
console.log(`  fixtures whose colour verdict changed  ${flipped.length} of ${rows.length}`);
for (const r of flipped) console.log(`    ${r.file} (${r.label}): ${r.fallbackBefore} -> ${r.fallbackAfter}`);
const lost = rows.filter((r) => r.marksAfter < r.marksBefore);
console.log(`  fixtures where marks fell   ${lost.length} of ${rows.length}`);
for (const r of lost) console.log(`    ${r.file} (${r.label}): ${r.marksBefore} -> ${r.marksAfter}`);
console.log(`  total marks  ${rows.reduce((a, r) => a + r.marksBefore, 0)} -> ${rows.reduce((a, r) => a + r.marksAfter, 0)}`);

console.log(`\n  ── what it cost in time ──`);
console.log(`  mean ${mean(rows.map((r) => r.ms)).toFixed(0)}ms per page, on a bench machine.`);
console.log('  Once per page, off the live loop. Read it against warp_ms from a real');
console.log('  device rather than trusting a bench number — conditioning_meta carries');
console.log('  flatten_ms for exactly that.\n');
console.log('  The "+ shadow" rows are synthetic — a soft darkening laid over a real');
console.log('  photograph, because the corpus has no shadowed page in it. They say');
console.log('  what flattening does to a gradient, not how often one occurs.\n');
