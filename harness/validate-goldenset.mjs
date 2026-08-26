#!/usr/bin/env node
// Checks label files in harness/goldenset/ against the schema and coverage
// harness/README.md specifies, before anyone finds out the hard way at
// `node harness/run.mjs` time, or worse, after hand-labelling twenty papers
// in a format run.mjs silently can't fully use.
//
// Two separate questions, kept separate:
//   1. Is each file well-formed? (a hard error — run.mjs will misbehave)
//   2. Does the set as a whole cover what SCANNING_SYSTEM.md §18 asks for?
//      (a coverage report — labelling is a process this tool tracks, it does
//      not gate)
//
//   node harness/validate-goldenset.mjs [dir]   # defaults to harness/goldenset/
//
// Pure functions below, so they're unit-tested directly in
// validate-goldenset.test.mjs without needing real files on disk.

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const REGION_TYPES = new Set(['prose', 'math', 'diagram', 'table', 'mcq', 'mixed']);
const MARK_CLASSES = new Set([
  'marginal_number', 'tick', 'half_tick', 'cross', 'strikethrough',
  'circle', 'underline', 'comment', 'unknown',
]);

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isBox = (b) => b && isFiniteNumber(b.x) && isFiniteNumber(b.y) && isFiniteNumber(b.w) && isFiniteNumber(b.h);

/**
 * Validate one paper's label file against the shape harness/README.md
 * documents. Returns `{errors, warnings}` — errors are what would actually
 * break `run.mjs` or produce a silently wrong score; warnings are things
 * worth a second look but not fatal.
 */
export function validatePaper(paper, file = '(unnamed)') {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(`${file}: ${m}`);
  const warn = (m) => warnings.push(`${file}: ${m}`);

  if (!paper || typeof paper !== 'object') {
    err('not a JSON object');
    return { errors, warnings };
  }

  const p = paper.paper;
  if (!p) err('missing top-level "paper"');
  else {
    if (!p.id) err('paper.id is required — run.mjs matches predictions to labels by it');
    if (!p.board) warn('paper.board is not set');
    if (!isFiniteNumber(p.class_level)) warn('paper.class_level is not a number');
    if (!p.subject) warn('paper.subject is not set');
    if (!p.type) warn('paper.type is not set — decides Tier 1 vs Tier 2 routing');
    if (!isFiniteNumber(p.pages) || p.pages < 1) warn('paper.pages is missing or not a positive number');
    if (p.reported_total !== undefined && p.reported_total !== null && !isFiniteNumber(p.reported_total)) {
      err('paper.reported_total is set but not a number');
    }
    if (p.stated_maximum !== undefined && p.stated_maximum !== null && !isFiniteNumber(p.stated_maximum)) {
      err('paper.stated_maximum is set but not a number');
    }
  }

  const questions = paper.questions;
  if (!Array.isArray(questions) || !questions.length) {
    err('"questions" must be a non-empty array');
    return { errors, warnings };
  }

  questions.forEach((q, i) => {
    const at = `questions[${i}]${q?.label ? ` (${q.label})` : ''}`;
    if (!q || typeof q !== 'object') { err(`${at}: not an object`); return; }
    if (!q.label) warn(`${at}: no label — mark attribution can still score it, but segmentation matching prefers a label over geometry`);

    if (!Array.isArray(q.spans) || !q.spans.length) {
      err(`${at}: "spans" must be a non-empty array — a question with no span cannot be matched to a prediction`);
    } else {
      q.spans.forEach((s, si) => {
        if (!isFiniteNumber(s?.page) || s.page < 1) err(`${at}: spans[${si}].page must be a positive page number`);
        if (!isBox(s?.box)) err(`${at}: spans[${si}].box must have numeric x, y, w, h`);
      });
    }

    if (q.region_type && !REGION_TYPES.has(q.region_type)) {
      err(`${at}: region_type "${q.region_type}" is not one of ${[...REGION_TYPES].join(', ')}`);
    }
    if (q.region_type === 'diagram' && q.answer_text) {
      warn(`${at}: region_type is "diagram" but answer_text is set — diagrams are deliberately not transcribed; answerWer() already excludes them, but this is worth a second look`);
    }

    // null is a legitimate label (SCANNING_SYSTEM.md: "never infer" applies
    // to labelling too — an unmarked or illegible question is not a zero),
    // so only flag the field being the wrong *type* when present.
    for (const field of ['marks_awarded', 'marks_available']) {
      const v = q[field];
      if (v !== null && v !== undefined && !isFiniteNumber(v)) {
        err(`${at}: ${field} is set but not a number (or null)`);
      }
    }
    if (isFiniteNumber(q.marks_awarded) && isFiniteNumber(q.marks_available) && q.marks_awarded > q.marks_available) {
      err(`${at}: marks_awarded (${q.marks_awarded}) exceeds marks_available (${q.marks_available})`);
    }

    (q.teacher_marks ?? []).forEach((m, mi) => {
      if (!isFiniteNumber(m?.page)) err(`${at}: teacher_marks[${mi}].page must be a page number`);
      if (!isBox(m?.box)) err(`${at}: teacher_marks[${mi}].box must have numeric x, y, w, h`);
      if (m?.mark_class && !MARK_CLASSES.has(m.mark_class)) {
        err(`${at}: teacher_marks[${mi}].mark_class "${m.mark_class}" is not one of ${[...MARK_CLASSES].join(', ')}`);
      }
    });
  });

  return { errors, warnings };
}

/**
 * Does the set as a whole cover what SCANNING_SYSTEM.md §18 and
 * harness/README.md ask for? Structural checks where the label schema can
 * actually tell (a diagram region, a question spanning 3+ pages, an
 * unreconciled total); everything else — a green-pen or pencil marker, a
 * glare-damaged page — has no field of its own in the schema and can only be
 * read from `paper.notes`, so it's a keyword match, named as one, rather than
 * dressed up as something more certain than it is.
 */
export function coverage(papers) {
  const subjects = new Set();
  const classLevels = new Set();
  const notes = papers.map((p) => String(p.paper?.notes ?? '').toLowerCase());

  let hasDiagram = false, hasLongAnswer = false, hasUnreconciled = false;
  for (const paper of papers) {
    if (paper.paper?.subject) subjects.add(paper.paper.subject);
    if (isFiniteNumber(paper.paper?.class_level)) classLevels.add(paper.paper.class_level);

    for (const q of paper.questions ?? []) {
      if (q.region_type === 'diagram') hasDiagram = true;
      if (Array.isArray(q.spans) && q.spans.length >= 3) hasLongAnswer = true;
    }
    const total = paper.paper?.reported_total;
    if (isFiniteNumber(total)) {
      const sum = (paper.questions ?? []).reduce(
        (t, q) => t + (isFiniteNumber(q.marks_awarded) ? q.marks_awarded : 0), 0,
      );
      if (Math.abs(sum - total) > 1e-6) hasUnreconciled = true;
    }
  }

  const noteHas = (...words) => notes.some((n) => words.some((w) => n.includes(w)));

  return {
    papers: papers.length,
    subjects: [...subjects],
    classLevels: [...classLevels].sort((a, b) => a - b),
    badCases: {
      non_red_marking: noteHas('green pen', 'green ink', 'pencil'),
      glare: noteHas('glare'),
      diagram_heavy: hasDiagram,
      long_answer: hasLongAnswer,
      teacher_arithmetic_error: hasUnreconciled || noteHas('arithmetic'),
    },
  };
}

async function main() {
  const dirArg = process.argv[2];
  const dir = dirArg ? join(process.cwd(), dirArg) : join(here, 'goldenset');

  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`Could not read ${dir}`);
    process.exit(2);
  }

  if (!files.length) {
    console.log(`\n${dir} has no label files yet. See harness/goldenset/README.md.\n`);
    process.exit(0);
  }

  const papers = [];
  let errorCount = 0, warningCount = 0;

  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(join(dir, file), 'utf8'));
    } catch (e) {
      console.log(`✗ ${file}: invalid JSON — ${e.message}`);
      errorCount++;
      continue;
    }
    const { errors, warnings } = validatePaper(parsed, file);
    for (const e of errors) console.log(`✗ ${e}`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
    errorCount += errors.length;
    warningCount += warnings.length;
    if (!errors.length) papers.push(parsed);
  }

  const cov = coverage(papers);
  console.log('\nCoverage');
  console.log(`  ${cov.papers} paper(s) with no schema errors (target: ≥ 20)`);
  console.log(`  ${cov.subjects.length} subject(s): ${cov.subjects.join(', ') || '—'} (target: ≥ 4)`);
  console.log(`  class levels: ${cov.classLevels.join(', ') || '—'} (target: spanning 9–12)`);
  console.log('\n  the five required bad cases (SCANNING_SYSTEM.md §18):');
  const label = {
    non_red_marking: 'a green-pen or pencil marker',
    glare: 'a glare-damaged page',
    diagram_heavy: 'a diagram-heavy answer',
    long_answer: 'a long answer running 3+ pages',
    teacher_arithmetic_error: "a paper where the teacher's own arithmetic doesn't add up",
  };
  for (const [key, present] of Object.entries(cov.badCases)) {
    console.log(`    ${present ? '✓' : '·'} ${label[key]}` +
      (key === 'non_red_marking' || key === 'glare' ? '  (read from paper.notes — keyword match, not a certainty)' : ''));
  }

  console.log(`\n${errorCount} error(s), ${warningCount} warning(s).\n`);
  process.exit(errorCount ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
