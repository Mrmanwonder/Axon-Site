// Tests for the metrics themselves.
//
// The harness is what decides whether the pipeline is good enough to ship
// against real data, so a bug in a metric is worse than a bug in the pipeline:
// it makes the wrong thing look fine. These check the cases that would
// otherwise flatter it — a question never found, a merged pair, a split one, a
// diagram that was correctly not transcribed.
//
//   node --test harness/metrics.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerWer, correctionRate, gate, iou, markAttribution, matchRegions,
  reconciliationRate, segmentation, wordErrorRate,
} from './metrics.mjs';

const span = (page, x, y, w, h) => [{ page, box: { x, y, w, h } }];
const q = (label, y, awarded, extra = {}) =>
  ({ label, spans: span(1, 40, y, 900, 200), marks_awarded: awarded, marks_available: 5, ...extra });

test('overlap is zero across pages, whatever the coordinates say', () => {
  assert.equal(iou({ page: 1, x: 0, y: 0, w: 10, h: 10 }, { page: 2, x: 0, y: 0, w: 10, h: 10 }), 0);
  assert.equal(iou({ page: 1, x: 0, y: 0, w: 10, h: 10 }, { page: 1, x: 0, y: 0, w: 10, h: 10 }), 1);
});

test('a shared question label beats geometry', () => {
  const labels = [q('Q1', 100, 4)];
  // The same question, found in the wrong place, is still the same question.
  const predictions = [{ label: 'Q1', spans: span(1, 40, 900, 900, 200), marks_awarded: 4 }];
  const { pairs } = matchRegions(labels, predictions);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].by, 'label');
});

test('a question the pipeline never found counts against attribution', () => {
  const labels = [q('Q1', 100, 4), q('Q2', 400, 3)];
  const predictions = [{ label: 'Q1', spans: span(1, 40, 100, 900, 200), marks_awarded: 4 }];
  const result = markAttribution(labels, predictions);
  assert.equal(result.correct, 1);
  assert.equal(result.scored, 2);
  assert.equal(result.accuracy, 0.5);
  assert.equal(result.wrong[0].found, false);
});

test('a mark bound to the wrong question is wrong, not partly right', () => {
  const labels = [q('Q1', 100, 4), q('Q2', 400, 1)];
  const predictions = [
    { label: 'Q1', spans: span(1, 40, 100, 900, 200), marks_awarded: 1 },
    { label: 'Q2', spans: span(1, 40, 400, 900, 200), marks_awarded: 4 },
  ];
  assert.equal(markAttribution(labels, predictions).accuracy, 0);
});

test('over- and under-segmentation are counted separately', () => {
  const labels = [q('Q1', 100, 4)];
  // One labelled answer read as two: a split.
  const split = [
    { label: null, spans: span(1, 40, 100, 900, 95) },
    { label: null, spans: span(1, 40, 205, 900, 95) },
  ];
  const s = segmentation(labels, split);
  assert.equal(s.over_segmented, 2);
  assert.equal(s.under_segmented, 0);

  // Two labelled answers read as one: a merge.
  const two = [q('Q1', 100, 4), q('Q2', 320, 3)];
  const merged = [{ label: 'Q1', spans: span(1, 40, 100, 900, 420) }];
  const m = segmentation(two, merged);
  assert.equal(m.under_segmented, 1);
  assert.equal(m.over_segmented, 0);
});

test('word error rate counts substitutions, insertions and deletions', () => {
  assert.equal(wordErrorRate('the cat sat', 'the cat sat'), 0);
  assert.equal(wordErrorRate('the cat sat', 'the dog sat'), 1 / 3);
  assert.equal(wordErrorRate('the cat sat', 'the cat'), 1 / 3);
  assert.equal(wordErrorRate('', 'anything'), 1);
  assert.equal(wordErrorRate('', ''), 0);
  // Punctuation and case are not transcription errors worth counting.
  assert.equal(wordErrorRate('F = ma.', 'f = ma'), 0);
});

test('a diagram left untranscribed is not scored as a failed transcription', () => {
  const labels = [
    { ...q('Q1', 100, 4), answer_text: 'a labelled diagram of the eye', region_type: 'diagram' },
    { ...q('Q2', 400, 3), answer_text: 'force equals mass times acceleration', region_type: 'prose' },
  ];
  const predictions = [
    { label: 'Q1', spans: span(1, 40, 100, 900, 200), student_answer: null },
    { label: 'Q2', spans: span(1, 40, 400, 900, 200), student_answer: 'force equals mass times acceleration' },
  ];
  const result = answerWer(labels, predictions);
  assert.equal(result.counted, 1);
  assert.equal(result.wer, 0);
});

test('a paper that did not run counts as unreconciled', () => {
  assert.equal(reconciliationRate([{ reconciled: true }, { reconciled: false }]).rate, 0.5);
  assert.equal(reconciliationRate([{}]).rate, 0);
});

test('the gates hold at the numbers the specification names', () => {
  const passing = {
    mark_attribution: { accuracy: 0.98 },
    reconciliation: { rate: 0.90 },
  };
  assert.equal(gate(passing).length, 0);

  const failing = {
    mark_attribution: { accuracy: 0.9799 },
    reconciliation: { rate: 0.8999 },
  };
  const failures = gate(failing);
  assert.equal(failures.length, 2);
  assert.match(failures[0].consequence, /Insights/);
  assert.match(failures[1].consequence, /review step/);
});

test('the correction rate accepts a question list or a question count', () => {
  assert.equal(correctionRate([{ questions: 10, corrections_count: 2 }]).rate, 0.2);
  assert.equal(correctionRate([{ questions: [1, 2, 3, 4], corrections_count: 1 }]).rate, 0.25);
  assert.equal(correctionRate([{ questions: [] }]).rate, 0);
});
