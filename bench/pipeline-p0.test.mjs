// The five P0 failure modes from the scanner specification, pinned.
//
// These cover `supabase/functions/_shared/`, which is Deno code — but this is
// a Node test file on purpose. `_shared/pipeline_test.ts` already holds Deno
// tests for some of this logic and **CI never runs them**: the workflow runs
// `npm test` (bench + harness) and the pgTAP suites, and Deno is not installed
// on either job. A test suite nothing executes is documentation with a
// misleading file extension, and every one of the failures below sat behind
// one. Node 22 strips TypeScript types on import, so the same modules load
// here and run in the job that already exists.
//
// Each test names the specification rule it enforces and the behaviour that
// used to violate it. They are regression pins, not a description of intent:
// every one of them fails on the code as it stood before this change.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reconcile } from '../supabase/functions/_shared/reconcile.ts';
import { assess, recognitionOf } from '../supabase/functions/_shared/confidence.ts';
import { assignToRegion } from '../supabase/functions/_shared/attribution.ts';

const region = (order_index, spans, label = String(order_index + 1)) =>
  ({ order_index, label, spans });
const span = (page, x, y, w, h) => ({ page, box: { x, y, w, h } });
const markAt = (page, x, y, w = 10, h = 10) => ({ page, box: { x, y, w, h } });

// ── P0-1 · never force nearest-question attribution ────────────────────────
//
// Spec §40.6 and §124/P0-1. The distance rule had no ceiling: whatever was
// nearest won, however far away. A mark at the foot of a page bound to the
// last question on it — silently, and indistinguishably from a correct bind.

test('P0-1: a mark far from every question is unattributed, not bound to the nearest', () => {
  const regions = [region(0, [span(1, 100, 100, 400, 80)])];
  // A whole page below the only question on the page.
  const result = assignToRegion(markAt(1, 120, 2000), regions);
  assert.equal(result.region_index, null,
    'a mark a page away from the only question was still bound to it');
  assert.equal(result.ambiguous, false);
});

test('P0-1: a mark just outside a question still binds, with its reason recorded', () => {
  const regions = [region(0, [span(1, 100, 100, 400, 80)])];
  const result = assignToRegion(markAt(1, 120, 200), regions);
  assert.equal(result.region_index, 0, 'a mark in the margin beside a question should bind');
  assert.ok(result.confidence > 0, 'a binding with no confidence is not a binding');
  assert.ok(result.method.length, 'every binding records how it was reached (§41)');
});

test('P0-1: two equally close questions produce ambiguous, not the lower index', () => {
  // The mark sits exactly between them, and near enough to both to be a real
  // candidate for either — the old code took whichever came first.
  const regions = [
    region(0, [span(1, 100, 100, 400, 100)]),
    region(1, [span(1, 100, 300, 400, 100)]),
  ];
  const result = assignToRegion(markAt(1, 120, 245, 10, 10), regions);
  assert.equal(result.region_index, null, 'a coin toss was resolved instead of reported (§42)');
  assert.equal(result.ambiguous, true);
  assert.ok(result.alternatives.length >= 2, 'both candidates are kept for review');
});

test('P0-1: a mark inside a question is bound with high confidence', () => {
  const regions = [region(0, [span(1, 100, 100, 400, 200)])];
  const result = assignToRegion(markAt(1, 200, 150), regions);
  assert.equal(result.region_index, 0);
  assert.ok(result.confidence >= 0.9, 'containment is the strongest evidence there is');
  assert.deepEqual(result.method, ['inside_span']);
});

// ── P0-2 · attribution must inspect every span ─────────────────────────────
//
// Spec §20 and §124/P0-2. `spans.find(s => s.page === page)` took the first
// span on the page and ignored the rest, so a question split around a diagram
// was matched on its first piece only.

test('P0-2: a mark inside a question\'s SECOND span on the page is bound to it', () => {
  const regions = [
    // One question, interrupted by a diagram: two spans, same page.
    region(0, [span(1, 100, 100, 400, 60), span(1, 100, 900, 400, 200)]),
    // A different question, physically nearer the first span.
    region(1, [span(1, 100, 200, 400, 60)]),
  ];
  // Squarely inside region 0's second span.
  const result = assignToRegion(markAt(1, 200, 1000), regions);
  assert.equal(result.region_index, 0,
    'only the first span was considered, so a mark inside the second was missed');
  assert.deepEqual(result.method, ['inside_span']);
});

// ── P0-3 · missing is not zero ─────────────────────────────────────────────
//
// Spec §48/§49 and §124/P0-3. `sum()` folded null into the total as a zero, so
// a paper with an unread mark could sum to exactly the reported total and be
// declared reconciled — handing every other question on it a free arithmetic
// pass, and inflating the reconciliation rate that is meant to be the
// production monitor for extraction being wrong.

const marks = (awarded) => awarded.map((a, i) => ({
  order_index: i, label: String(i + 1), awarded: a, available: 5, recognition: 'high',
}));

test('P0-3: the specification\'s own §48 example is not reconciled', () => {
  // Q1 = 2, Q2 = UNKNOWN, Q3 = 4, reported total 6.
  const r = reconcile(marks([2, null, 4]), 6, null);
  assert.equal(r.sum_awarded, 6, 'the known marks do sum to the total');
  assert.equal(r.reconciled, false, 'but an unknown mark means the paper is not reconciled');
  assert.equal(r.state, 'CONDITIONALLY_CONSISTENT');
  assert.equal(r.completeness, 'INCOMPLETE');
  assert.deepEqual(r.unknown_awarded, [1], 'and it says which question it could not read');
});

test('P0-3: a complete paper whose total closes is still reconciled', () => {
  const r = reconcile(marks([2, 3, 4]), 9, null);
  assert.equal(r.reconciled, true);
  assert.equal(r.state, 'CONSISTENT');
  assert.equal(r.completeness, 'COMPLETE');
});

test('P0-3: an unknown mark is never counted as a zero in the sum', () => {
  const withUnknown = reconcile(marks([2, null, 4]), null, null);
  const withZero = reconcile(marks([2, 0, 4]), null, null);
  assert.equal(withUnknown.sum_awarded, withZero.sum_awarded,
    'the sums coincide, which is exactly why the states must not');
  assert.equal(withUnknown.completeness, 'INCOMPLETE');
  assert.equal(withZero.completeness, 'COMPLETE');
});

test('P0-3: a paper with nothing to check against is NOT_CHECKED, not consistent', () => {
  const r = reconcile(marks([2, 3, 4]), null, null);
  assert.equal(r.state, 'NOT_CHECKED');
  assert.equal(r.reconciled, false);
});

test('P0-3: a genuine mismatch is INCONSISTENT and keeps its delta', () => {
  const r = reconcile(marks([2, 3, 4]), 10, null);
  assert.equal(r.state, 'INCONSISTENT');
  assert.equal(r.delta, -1);
});

test('P0-3: an incomplete paper says so before it mentions the sum', () => {
  const r = reconcile(marks([2, null, 4]), 6, null);
  assert.match(r.message ?? '', /could not read the mark/i,
    'a delta of zero across an unread mark must not read as "all good"');
});

// ── P0-4 · recognition confidence must survive the pipeline ────────────────
//
// Spec §56 and §124/P0-4. Reconciliation replaced the model's own high/medium/
// low with a flat 'medium' for every region that was not already unreadable,
// so a question the model said it read poorly and one it said it read cleanly
// arrived at the confidence model indistinguishable.

test('P0-4: the recorded recognition grade is read back, not replaced', () => {
  assert.equal(recognitionOf({ recognition_confidence: 'low' }, 'unsure'), 'low');
  assert.equal(recognitionOf({ recognition_confidence: 'high' }, 'unsure'), 'high');
});

test('P0-4: a low reading stays out of analytics', () => {
  const base = {
    numberingSound: true, arithmeticSound: true, awarded: 4, available: 5,
    layerFallback: false, unreadable: false,
  };
  assert.equal(assess({ ...base, recognition: 'low' }).tier, 'unsure');
  assert.equal(assess({ ...base, recognition: 'high' }).tier, 'confident');
});

test('P0-4: the grade survives reconciliation overwriting the key beside it', () => {
  // w-reconcile merges the confidence model's Signals into the same jsonb,
  // and Signals has a boolean `recognition`. If the grade were only stored
  // under that key, a second reconciliation pass would read the boolean.
  const afterFirstPass = { recognition_confidence: 'high', recognition: true };
  assert.equal(recognitionOf(afterFirstPass, 'unsure'), 'high',
    'a re-run must not read the boolean as a grade');
});

test('P0-4: no recorded grade is unreadable, not a passing one', () => {
  assert.equal(recognitionOf({}, 'unsure'), null);
  assert.equal(recognitionOf({ recognition: true }, 'unsure'), null,
    'a boolean is not a grade');
  const tier = assess({
    recognition: recognitionOf({}, 'unsure'),
    numberingSound: true, arithmeticSound: true, awarded: 4, available: 5,
    layerFallback: false, unreadable: false,
  }).tier;
  assert.equal(tier, 'unreadable', 'a missing signal is not a good one');
});

// ── P0-5 · structure confidence is more than the numbering ─────────────────
//
// Spec §57 and §124/P0-5. `structural` was numbering soundness and nothing
// else, so a question with a tidy sequential label and no usable boundary
// scored as structurally sound.

test('P0-5: a question with no usable boundary is not structurally sound', () => {
  const base = {
    recognition: 'high', numberingSound: true, arithmeticSound: true,
    awarded: 4, available: 5, layerFallback: false, unreadable: false,
  };
  const good = assess({ ...base, boundarySound: true });
  const noBoundary = assess({ ...base, boundarySound: false });
  assert.equal(good.tier, 'confident');
  assert.equal(noBoundary.tier, 'unsure',
    'a perfectly numbered question we cannot point at is not confident');
});

test('P0-5: numbering and boundary are recorded separately (§6)', () => {
  const signals = assess({
    recognition: 'high', numberingSound: false, boundarySound: true,
    arithmeticSound: true, awarded: 4, available: 5,
    layerFallback: false, unreadable: false,
  }).signals;
  assert.equal(signals.structural, false);
  assert.equal(signals.structure_numbering, false);
  assert.equal(signals.structure_boundary, true,
    'which of the two failed has to survive, or review cannot tell them apart');
});

test('P0-5: a decomposed sub-signal never becomes a hidden gate on the tier', () => {
  // tierFrom gates on the four named signals. A diagnostic field added later
  // must not silently start deciding whether a question reaches analytics.
  const tier = assess({
    recognition: 'high', numberingSound: true, boundarySound: true,
    arithmeticSound: true, awarded: 4, available: 5,
    layerFallback: false, unreadable: false,
  }).tier;
  assert.equal(tier, 'confident');
});
