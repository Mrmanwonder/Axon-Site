#!/usr/bin/env node
// The accuracy harness.
//
// v1 is not done when scanning works. It is done when scanning is measured.
//
//   node harness/run.mjs harness/runs/<run>.json [--baseline harness/runs/<older>.json]
//                         [--goldenset <dir>]
//
// Reads a run's predictions, scores them against the golden set, prints the five
// metrics in priority order, and exits non-zero if either gate fails. Run it on
// every pipeline change — ExtractionRun.pipeline_version is what makes the
// comparison between two runs mean anything.
//
// No dependencies, by design. A harness nobody can run because its lockfile
// rotted is a harness that stops being run.

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GATES, answerWer, correctionRate, gate, markAttribution, reconciliationRate, segmentation,
} from './metrics.mjs';

const here = dirname(fileURLToPath(import.meta.url));

async function loadGoldenSet(dirName = 'goldenset') {
  const dir = join(here, dirName);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  const papers = [];
  for (const file of files) {
    const paper = JSON.parse(await readFile(join(dir, file), 'utf8'));
    paper._file = file;
    papers.push(paper);
  }
  return papers;
}

function report(golden, run, setName) {
  const byId = new Map(run.papers.map((p) => [p.paper_id, p]));

  let correct = 0, scored = 0;
  let matched = 0, labelled = 0, predicted = 0, over = 0, under = 0;
  let werTotal = 0, werCount = 0;
  const perPaper = [];
  const misses = [];

  for (const paper of golden) {
    const prediction = byId.get(paper.paper.id);
    const predictions = prediction?.questions ?? [];

    const marks = markAttribution(paper.questions, predictions);
    const seg = segmentation(paper.questions, predictions);
    const wer = answerWer(paper.questions, predictions);

    correct += marks.correct; scored += marks.scored;
    matched += seg.matched; labelled += seg.labelled; predicted += seg.predicted;
    over += seg.over_segmented; under += seg.under_segmented;
    if (wer.counted) { werTotal += wer.wer * wer.counted; werCount += wer.counted; }
    for (const w of marks.wrong) misses.push({ paper: paper.paper.id, ...w });

    perPaper.push({
      id: paper.paper.id,
      subject: paper.paper.subject,
      notes: paper.paper.notes ?? '',
      ran: !!prediction,
      attribution: marks.accuracy,
      reconciled: prediction?.reconciled === true,
      f1: seg.f1,
      wer: wer.wer,
      cost_paise: prediction?.cost_paise ?? null,
    });
  }

  const precision = predicted ? matched / predicted : 0;
  const recall = labelled ? matched / labelled : 0;

  return {
    setName,
    pipeline_version: run.pipeline_version ?? 'unversioned',
    models: run.models ?? {},
    papers: golden.length,
    mark_attribution: { correct, scored, accuracy: scored ? correct / scored : 0 },
    reconciliation: reconciliationRate(
      golden.map((p) => byId.get(p.paper.id) ?? { reconciled: false }),
    ),
    segmentation: {
      precision, recall,
      f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
      over_segmented: over,
      under_segmented: under,
    },
    answer_wer: werCount ? werTotal / werCount : 0,
    corrections: correctionRate(run.papers ?? []),
    cost_paise: (run.papers ?? []).reduce((t, p) => t + (p.cost_paise ?? 0), 0),
    perPaper,
    misses,
  };
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const rupees = (paise) => `₹${(paise / 100).toFixed(2)}`;

function print(r, baseline) {
  const delta = (now, before, unit = pct) => {
    if (before === undefined || before === null) return '';
    const d = now - before;
    if (Math.abs(d) < 1e-9) return '  (unchanged)';
    return `  (${d > 0 ? '+' : ''}${unit === pct ? `${(d * 100).toFixed(1)}pp` : unit(d)})`;
  };

  console.log(`\nAccuracy harness · pipeline ${r.pipeline_version}`);
  if (Object.keys(r.models).length) {
    console.log(`  models: ${Object.entries(r.models).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  }
  console.log(`  ${r.papers} paper(s) in the golden set` + (r.setName ? ` (${r.setName})` : '') + '\n');

  console.log('  1 · mark attribution   ' + pct(r.mark_attribution.accuracy) +
    `  (${r.mark_attribution.correct}/${r.mark_attribution.scored})` +
    delta(r.mark_attribution.accuracy, baseline?.mark_attribution.accuracy));
  console.log('  2 · reconciliation     ' + pct(r.reconciliation.rate) +
    `  (${r.reconciliation.closed}/${r.reconciliation.papers} papers closed unaided)` +
    delta(r.reconciliation.rate, baseline?.reconciliation.rate));
  console.log('  3 · segmentation F1    ' + pct(r.segmentation.f1) +
    `  (precision ${pct(r.segmentation.precision)}, recall ${pct(r.segmentation.recall)})` +
    delta(r.segmentation.f1, baseline?.segmentation.f1));
  console.log(`        over-segmented ${r.segmentation.over_segmented}` +
    `, under-segmented ${r.segmentation.under_segmented}` +
    '   ← different causes, different fixes');
  console.log('  4 · answer WER         ' + pct(r.answer_wer) +
    '  (lower is better; matters least)' +
    delta(r.answer_wer, baseline?.answer_wer));
  console.log('  5 · correction rate    ' + pct(r.corrections.rate) +
    `  (${r.corrections.corrections}/${r.corrections.questions} fields, from production)`);
  console.log(`\n  cost               ${rupees(r.cost_paise)} over ${r.papers} paper(s)` +
    (r.papers ? `, ${rupees(r.cost_paise / r.papers)} each` : ''));

  // Per paper, worst first. The golden set deliberately contains the bad cases,
  // and a mean over twenty papers hides which one is the problem.
  console.log('\n  per paper');
  for (const p of [...r.perPaper].sort((a, b) => a.attribution - b.attribution)) {
    console.log(
      `    ${p.ran ? ' ' : '!'} ${pct(p.attribution).padStart(6)}  ` +
      `${p.reconciled ? 'closed  ' : 'open    '}F1 ${pct(p.f1).padStart(6)}  ` +
      `WER ${pct(p.wer).padStart(6)}  ${p.id}${p.notes ? `  — ${p.notes}` : ''}`);
  }

  if (r.misses.length) {
    console.log('\n  marks read wrong');
    for (const m of r.misses.slice(0, 25)) {
      console.log(`    ${m.paper} ${m.label ?? '(unlabelled)'}: ` +
        (m.found ? `expected ${m.expected}, read ${m.got ?? 'nothing'}` : 'question never found'));
    }
    if (r.misses.length > 25) console.log(`    …and ${r.misses.length - 25} more`);
  }

  const failures = gate(r, baseline);
  console.log('');
  if (!failures.length) {
    console.log(`  Gates: ${baseline ? 'all three' : 'both'} pass.`);
    console.log(`    mark attribution ≥ ${pct(GATES.MARK_ATTRIBUTION)} · reconciliation ≥ ${pct(GATES.RECONCILIATION)}` +
      (baseline ? ` · no more than ${(GATES.MAX_REGRESSION * 100).toFixed(1)}pp below ${baseline.pipeline_version}` : ''));
  } else {
    for (const f of failures) {
      console.log(`  GATE FAILED · ${f.gate}: ${pct(f.got)} against ${pct(f.required)} required`);
      console.log(`    ${f.consequence}`);
    }
  }
  console.log('');
  return failures.length;
}

async function main() {
  const args = process.argv.slice(2);
  const flagValues = new Set();
  args.forEach((a, i) => { if (a === '--baseline' || a === '--goldenset') flagValues.add(i + 1); });
  const runPath = args.find((a, i) => !a.startsWith('--') && !flagValues.has(i));
  const baselineIndex = args.indexOf('--baseline');
  const baselinePath = baselineIndex === -1 ? null : args[baselineIndex + 1];
  // The example set exists so the runner can be exercised without real papers.
  // It is not a measurement of anything and must never be mistaken for one.
  const setIndex = args.indexOf('--goldenset');
  const setName = setIndex === -1 ? 'goldenset' : args[setIndex + 1];

  if (!runPath) {
    console.error('usage: node harness/run.mjs <run.json> [--baseline <run.json>]');
    process.exit(2);
  }

  const golden = await loadGoldenSet(setName);
  if (!golden.length) {
    // Said plainly rather than reported as a perfect score over nothing. The
    // golden set comes before the pipeline work, not after — otherwise every
    // decision downstream of it is made blind.
    console.error('\nThe golden set is empty. Label some papers into harness/goldenset/ first —');
    console.error('see harness/README.md. Twenty papers before pipeline work, not after.\n');
    process.exit(2);
  }

  const run = JSON.parse(await readFile(resolve(runPath), 'utf8'));
  const baseline = baselinePath
    ? report(golden, JSON.parse(await readFile(resolve(baselinePath), 'utf8')), setName)
    : null;

  process.exit(print(report(golden, run, setName), baseline) ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(2); });
