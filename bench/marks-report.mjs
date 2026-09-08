#!/usr/bin/env node
// Does the teacher's ink survive stage 2, on the pages a real student submitted?
//
// This exists because of a claim I made and then could not reproduce. Reporting
// on the shadow-removal work I wrote that "on the corpus's two real production
// scans at their true native size, separateLayers already returns
// student_wrote_red and zero teacher marks today". The second half of that
// sentence is doing all the work and the first half makes it wrong: *native
// size* is not a size the pipeline ever sees. `conditionPage` resizes every page
// to CONDITIONING.PAGE_LONG_EDGE on its long edge before `separateLayers` is
// called, and both fixtures are 3301px on the long edge — a third larger than
// anything production hands to layer separation.
//
// Red separation is a per-pixel colour judgement over a ratio of channels, and
// resampling bleeds chroma across a stroke, so its answers move with scale.
// Measuring it anywhere but at 2400px on the long edge is measuring a page the
// app will never see. That mistake has now been made three times in this
// codebase — the sharpness scale bug in AXON_FIX_BRIEF.md §B7, the 1100px
// working copy in flatten-report.mjs, and this — so every line this prints
// carries the dimensions it was measured at.
//
//   node bench/marks-report.mjs
//
// Columns:
//
//   dims        what separateLayers was actually handed
//   ink         share of the page the ink mask claims
//   red share   red as a share of that ink — the number RED_INK_SHARE_MAX
//               judges, and the one that decides the whole page's fate
//   fallback    null means "this is a marked page, read the marks"
//   marks       connected components reaching attribution

import { decodeFixture } from './decode.mjs';
import { separateLayers } from '../src/scan/layers.js';
import { flattenPage } from '../src/scan/enhance.js';
import { targetSize } from '../src/scan/conditioning.js';
import { CONDITIONING, LAYER_FALLBACK } from '../src/scan/contract.js';

// The two real pages a real student submitted on 2026-08-26. golden.test.mjs
// calls these the corpus's only honest anchor for anything absolute, and one of
// them (glare-blown-background-2, extraction_run fc030c2a-...) is on record as
// having had 144 genuine teacher marks recovered from these exact pixels.
const PRODUCTION = ['glare-blown-background-1.png', 'glare-blown-background-2.png'];

/**
 * The page exactly as `conditionPage` would hand it to `separateLayers`.
 *
 * Same function production uses to pick the size, rather than a reimplementation
 * of the arithmetic — the whole point of this file is to stop measuring
 * something adjacent to what ships.
 */
async function asConditioned(file) {
  const probe = await decodeFixture(file, { resizeWidth: 64 });
  const aspect = probe.width / probe.height;
  // Recover the true dimensions from the probe's aspect, then ask targetSize.
  const native = await decodeFixture(file);
  const target = targetSize(native.width, native.height, CONDITIONING.PAGE_LONG_EDGE);
  const at = await decodeFixture(file, { resizeWidth: target.width });
  return { native, conditioned: at, aspect };
}

const row = (label, img, layers) =>
  `  ${label.padEnd(34)} ${String(img.width).padStart(4)}x${String(img.height).padStart(4)}  ` +
  `${layers.coverage.ink_share.toFixed(4)}  ${layers.coverage.red_share_of_ink.toFixed(4)}  ` +
  `${String(layers.fallback ?? 'null').padEnd(18)} ${String(layers.teacher.components.length).padStart(5)}`;

console.log('\nTeacher ink through stage 2 · real submitted pages\n');
console.log(`  RED_INK_SHARE_MAX = ${LAYER_FALLBACK.RED_INK_SHARE_MAX}` +
  `   RED_INK_SHARE_MIN = ${LAYER_FALLBACK.RED_INK_SHARE_MIN}` +
  `   PAGE_LONG_EDGE = ${CONDITIONING.PAGE_LONG_EDGE}\n`);
console.log('  what                                    dims     ink     red     fallback           marks');

for (const file of PRODUCTION) {
  console.log(`\n  ${file}`);
  const { native, conditioned } = await asConditioned(file);

  // As decoded, which is NOT a size production ever sees — printed only so the
  // gap between it and the row below is on the record.
  console.log(row('as decoded (never seen in prod)', native, separateLayers(native)));
  console.log(row('as conditioned (what ships)', conditioned, separateLayers(conditioned)));

  const flat = flattenPage(conditioned);
  console.log(row(
    `after flattening (${flat.applied ? 'applied' : 'skipped'}, spread ${flat.spread.toFixed(2)})`,
    flat.image, separateLayers(flat.image),
  ));
}

console.log(`
  ── reading this ──

  The "as decoded" row is the mistake, kept visible on purpose. Both fixtures
  are 3301px on the long edge; conditioning caps every page at
  ${CONDITIONING.PAGE_LONG_EDGE}px and never upscales, so the row below it is the only one that
  describes what the app does. Where they disagree, the decoded row is wrong
  about production, not the other way round.
`);
