// node --test harness/validate-goldenset.test.mjs
//
// Synthetic fixtures only, built in memory — never real paper data, and
// never written to harness/goldenset/. See harness/goldenset/README.md for
// why that directory stays empty until real, consented papers exist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverage, validatePaper } from './validate-goldenset.mjs';

const box = { x: 0, y: 0, w: 10, h: 10 };

const goodPaper = {
  paper: {
    id: 'p1', board: 'CBSE', class_level: 11, subject: 'Physics',
    type: 'unit_test', pages: 2, reported_total: 10, stated_maximum: 20,
  },
  questions: [
    {
      label: 'Q1', spans: [{ page: 1, box }], region_type: 'prose',
      marks_awarded: 4, marks_available: 5, answer_text: 'x',
      teacher_marks: [{ page: 1, box, mark_class: 'marginal_number', value: 4 }],
    },
    {
      label: 'Q2', spans: [{ page: 1, box }], region_type: 'prose',
      marks_awarded: 6, marks_available: 15,
    },
  ],
};

test('a well-formed paper produces no errors', () => {
  const { errors } = validatePaper(goodPaper, 'good.json');
  assert.deepEqual(errors, []);
});

test('missing paper.id is a hard error', () => {
  const bad = { ...goodPaper, paper: { ...goodPaper.paper, id: undefined } };
  const { errors } = validatePaper(bad, 'x.json');
  assert.ok(errors.some((e) => e.includes('paper.id')));
});

test('a question with no spans is a hard error', () => {
  const bad = { ...goodPaper, questions: [{ label: 'Q1', spans: [] }] };
  const { errors } = validatePaper(bad, 'x.json');
  assert.ok(errors.some((e) => e.includes('spans')));
});

test('a box missing a coordinate is a hard error', () => {
  const bad = { ...goodPaper, questions: [{ label: 'Q1', spans: [{ page: 1, box: { x: 0, y: 0, w: 10 } }] }] };
  const { errors } = validatePaper(bad, 'x.json');
  assert.ok(errors.some((e) => e.includes('box')));
});

test('an unknown region_type is a hard error, not silently accepted', () => {
  const bad = { ...goodPaper, questions: [{ ...goodPaper.questions[0], region_type: 'essay' }] };
  const { errors } = validatePaper(bad, 'x.json');
  assert.ok(errors.some((e) => e.includes('region_type')));
});

test('an unknown mark_class is a hard error', () => {
  const bad = {
    ...goodPaper,
    questions: [{ ...goodPaper.questions[0], teacher_marks: [{ page: 1, box, mark_class: 'squiggle' }] }],
  };
  const { errors } = validatePaper(bad, 'x.json');
  assert.ok(errors.some((e) => e.includes('mark_class')));
});

test('marks_awarded above marks_available is a hard error', () => {
  const bad = { ...goodPaper, questions: [{ ...goodPaper.questions[0], marks_awarded: 9, marks_available: 5 }] };
  const { errors } = validatePaper(bad, 'x.json');
  assert.ok(errors.some((e) => e.includes('exceeds')));
});

test('marks_awarded: null is not an error — an unmarked question is not a zero', () => {
  const ok = { ...goodPaper, questions: [{ ...goodPaper.questions[0], marks_awarded: null }] };
  const { errors } = validatePaper(ok, 'x.json');
  assert.deepEqual(errors, []);
});

test('missing board/subject/type produce warnings, not errors — labelling in progress is not malformed', () => {
  const partial = { paper: { id: 'p2', pages: 1 }, questions: goodPaper.questions };
  const { errors, warnings } = validatePaper(partial, 'x.json');
  assert.deepEqual(errors, []);
  assert.ok(warnings.length > 0);
});

test('not an object at all is one hard error, not a crash', () => {
  const { errors } = validatePaper(null, 'x.json');
  assert.equal(errors.length, 1);
});

// ── coverage() ───────────────────────────────────────────────────────────

test('coverage reports zero bad cases on a set of only-clean papers', () => {
  const cov = coverage([goodPaper]);
  assert.equal(cov.papers, 1);
  assert.deepEqual(cov.subjects, ['Physics']);
  assert.equal(Object.values(cov.badCases).every((v) => v === false), true);
});

test('an unreconciled total is detected structurally, no note needed', () => {
  const unreconciled = {
    paper: { ...goodPaper.paper, id: 'p3', reported_total: 999 },
    questions: goodPaper.questions,
  };
  const cov = coverage([unreconciled]);
  assert.equal(cov.badCases.teacher_arithmetic_error, true);
});

test('a diagram region and a 3-page question are detected structurally', () => {
  const paper = {
    paper: { ...goodPaper.paper, id: 'p4' },
    questions: [
      { label: 'Q1', spans: [box, box, box].map((b, i) => ({ page: i + 1, box: b })), region_type: 'prose', marks_awarded: 1, marks_available: 1 },
      { label: 'Q2', spans: [{ page: 1, box }], region_type: 'diagram', marks_awarded: 1, marks_available: 1 },
    ],
  };
  const cov = coverage([paper]);
  assert.equal(cov.badCases.long_answer, true);
  assert.equal(cov.badCases.diagram_heavy, true);
});

test('green pen and glare are read from paper.notes, explicitly a keyword match', () => {
  const paper = { paper: { ...goodPaper.paper, id: 'p5', notes: 'Green pen throughout; glare on page 3' }, questions: goodPaper.questions };
  const cov = coverage([paper]);
  assert.equal(cov.badCases.non_red_marking, true);
  assert.equal(cov.badCases.glare, true);
});

test('coverage over an empty set reports zero, not a crash or a false 100%', () => {
  const cov = coverage([]);
  assert.equal(cov.papers, 0);
  assert.deepEqual(cov.subjects, []);
  assert.equal(Object.values(cov.badCases).every((v) => v === false), true);
});
