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

// ── where the two populations actually separate ───────────────────────────
//
// `LAYER_FALLBACK.RED_INK_SHARE_MAX` decides, from the red share of a page's
// ink alone, whether a page is a teacher's marking or a student who wrote in
// red. Getting it wrong in one direction discards every mark on a marked page;
// in the other it hands stage 5 a map of the student's own answer and calls it
// the marking. It is 0.15, from IMAGE_PIPELINE.md §6.3.
//
// It could not be re-derived until now, because until `modeOf` was fixed the
// number it judges was not stable enough to derive anything from — the same
// page measured 0.126 or 0.257 depending on a one-pixel resize. With that
// fixed, here is what the two populations look like.
//
// This lives here rather than in flatten-report.mjs, where it was first asked
// for, because flattening turned out not to be the variable: it is skipped on
// both real pages (their lighting is already even), so "re-derive it with
// flattening applied" is a no-op for exactly the pages that matter. The
// variable was the baseline, and this is the report about the baseline.
//
// The student-wrote-in-red pages are synthetic and say so. The corpus has no
// genuine one, and the alternative to synthesising them is deriving a
// two-sided threshold from one side.

/** A page where the student's own writing is red instead of blue. */
function studentInRed(img) {
  const { data, width, height } = img;
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i], g = out[i + 1], b = out[i + 2];
    const luma = (r * 299 + g * 587 + b * 114) / 1000;
    // Ink, and blue-dominant: the student's pen. The teacher's red is left
    // exactly as it is, so the result is a page where both are red — which is
    // what a student writing in red actually produces.
    if (luma < 170 && b > r + 12) { out[i] = b; out[i + 2] = r; }
  }
  return { data: out, width, height };
}

console.log('\n  ── re-deriving RED_INK_SHARE_MAX ──\n');
console.log(`  page                                            dims     red share  verdict at ${LAYER_FALLBACK.RED_INK_SHARE_MAX}`);
const marked = [], wroteRed = [];
const sample = (label, img, bucket) => {
  const share = separateLayers(img).coverage.red_share_of_ink;
  bucket.push(share);
  console.log(`  ${label.padEnd(46)} ${String(img.width).padStart(4)}x${String(img.height).padStart(4)}  ` +
    `${share.toFixed(3).padStart(9)}  ` +
    `${share > LAYER_FALLBACK.RED_INK_SHARE_MAX ? 'student_wrote_red' : 'marked'}`);
};

for (const file of PRODUCTION) {
  const { conditioned } = await asConditioned(file);
  const stem = file.replace('.png', '');
  sample(`${stem} · teacher marked (real)`, conditioned, marked);
  sample(`${stem} · student wrote red (synthetic)`, studentInRed(conditioned), wroteRed);
}

// The corpus's other real marked exam pages, and they are NOT evidence — they
// are the demonstration of why the two above are the only evidence there is.
//
// These are 700-1030px derivatives, far below the resolution floor the pipeline
// refuses pages under. At that scale chroma bleeds across every stroke, and the
// red share of the ink inflates accordingly: page-angled is a page a teacher
// marked in red on a student who wrote in blue, exactly like the two above, and
// it reads 0.56 — higher than either *synthetic* student-wrote-in-red page.
// Pooling them into the population would not widen the evidence base, it would
// destroy it.
console.log('\n  not evidence — real marked pages below the resolution floor, shown');
console.log('  because what they do to this measurement is the reason for the floor:');
const belowFloor = [];
for (const file of ['page-straight.jpg', 'page-skew.jpg', 'page-angled.jpg', 'page-tilted.jpg']) {
  const img = await decodeFixture(file);
  sample(`${file} · marked, ${Math.max(img.width, img.height)}px`, img, belowFloor);
}

const span = (xs) => `${Math.min(...xs).toFixed(3)} – ${Math.max(...xs).toFixed(3)}`;
const gapLo = Math.max(...marked), gapHi = Math.min(...wroteRed);
console.log(`
  at production scale, which is the only scale this can be derived at:

    teacher marked      ${span(marked)}
    student wrote red   ${span(wroteRed)}
    the gap             ${gapLo.toFixed(3)} – ${gapHi.toFixed(3)}
    threshold           ${LAYER_FALLBACK.RED_INK_SHARE_MAX}${
    LAYER_FALLBACK.RED_INK_SHARE_MAX <= gapLo
      ? '   <- BELOW a genuinely marked page: that page loses every mark'
      : LAYER_FALLBACK.RED_INK_SHARE_MAX >= gapHi
        ? '   <- ABOVE a page written in red: the student\'s own answer becomes "the marking"'
        : `   (${((LAYER_FALLBACK.RED_INK_SHARE_MAX - gapLo) / (gapHi - gapLo) * 100).toFixed(0)}% into the gap)`}

  Four samples, from two pages. That is thin and it is what the corpus has —
  the two synthetics are derived from the same two photographs, so they are not
  independent, and the transform that makes them (recolouring the student's
  blue ink red) is structurally right but its magnitude depends on how much
  that particular student wrote. What would actually settle this is real pages:
  a genuinely red-penned student answer, and a page from the most heavily
  marking teacher anyone can find.`);

console.log(`
  ── reading this ──

  The "as decoded" row is the mistake, kept visible on purpose. Both fixtures
  are 3301px on the long edge; conditioning caps every page at
  ${CONDITIONING.PAGE_LONG_EDGE}px and never upscales, so the row below it is the only one that
  describes what the app does. Where they disagree, the decoded row is wrong
  about production, not the other way round.
`);
