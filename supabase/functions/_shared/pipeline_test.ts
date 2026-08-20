// Unit tests for the parts of the pipeline that are arithmetic and geometry
// rather than a model call.
//
// These are the stages where a quiet mistake does the most damage. A mark bound
// to the wrong question, a paper that reconciles when it should not, a field
// called confident on a page nobody could read — none of those announce
// themselves, and all three are decided here by code that can be tested.
//
//   deno test supabase/functions/_shared/pipeline_test.ts

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { assignToRegion, classifyMark, groupComments } from './attribution.ts';
import { reconcile } from './reconcile.ts';
import { assess, numberingSoundness } from './confidence.ts';
import { takeBox, tierToConfidence } from './contract.ts';
import { clearsTheFloor } from './quality_floor.ts';

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const region = (page: number, x: number, y: number, w: number, h: number) =>
  ({ order_index: 0, label: null, spans: [{ page, box: box(x, y, w, h) }] });

// ── stage 5 · what a mark is ───────────────────────────────────────────────

Deno.test('a digit in the margin is the awarded mark; the same digit in the answer is not', () => {
  const glyph = { page: 1, box: box(900, 100, 30, 40), shape: 'glyph' as const, metrics: {} };
  assertEquals(classifyMark(glyph, true), 'marginal_number');
  assertEquals(classifyMark(glyph, false), 'unknown');
});

Deno.test('a cross reaches all four quadrants; a tick leaves its top-left empty', () => {
  const cross = { page: 1, box: box(0, 0, 40, 40), shape: 'crossing' as const,
                  metrics: { quadrants: [0.25, 0.25, 0.25, 0.25] } };
  const tick = { page: 1, box: box(0, 0, 40, 40), shape: 'crossing' as const,
                 metrics: { quadrants: [0.02, 0.40, 0.28, 0.30] } };
  assertEquals(classifyMark(cross, false), 'cross');
  assertEquals(classifyMark(tick, false), 'tick');
});

Deno.test('a crossing that is neither shape is unknown rather than guessed', () => {
  const ambiguous = { page: 1, box: box(0, 0, 40, 40), shape: 'crossing' as const,
                      metrics: { quadrants: [0.13, 0.30, 0.30, 0.27] } };
  assertEquals(classifyMark(ambiguous, false), 'unknown');
});

// ── stage 5 · where a mark belongs ─────────────────────────────────────────

Deno.test('a mark inside a region belongs to it', () => {
  const regions = [region(1, 0, 0, 800, 200), region(1, 0, 200, 800, 200)];
  regions[1].order_index = 1;
  assertEquals(assignToRegion({ page: 1, box: box(100, 250, 20, 20) }, regions), 1);
});

Deno.test('a margin mark binds to the region it sits alongside, not the first one', () => {
  const regions = [region(1, 0, 0, 800, 200), region(1, 0, 200, 800, 200)];
  regions[1].order_index = 1;
  // Well outside every region box horizontally — the usual case for a margin.
  assertEquals(assignToRegion({ page: 1, box: box(950, 300, 30, 30) }, regions), 1);
});

Deno.test('overlapping regions give the mark to the tighter one', () => {
  const outer = region(1, 0, 0, 800, 400);
  const inner = { ...region(1, 0, 180, 800, 60), order_index: 1 };
  assertEquals(assignToRegion({ page: 1, box: box(100, 200, 10, 10) }, [outer, inner]), 1);
});

Deno.test('a mark on a page with no regions binds to nothing rather than to anything', () => {
  assertEquals(assignToRegion({ page: 3, box: box(10, 10, 10, 10) }, [region(1, 0, 0, 10, 10)]), null);
});

// ── stage 5 · the teacher's own words ──────────────────────────────────────

Deno.test('a row of small marks with word spacing is a comment', () => {
  const marks = Array.from({ length: 9 }, (_, i) => ({
    page: 1, box: box(100 + i * 26, 400, 18, 20), shape: 'glyph' as const, metrics: {},
  }));
  const groups = groupComments(marks, 1000);
  assertEquals(groups.length, 1);
  assertEquals(groups[0].length, 9);
});

Deno.test('three marks scattered down the margin are not a comment', () => {
  const marks = [0, 1, 2].map((i) => ({
    page: 1, box: box(940, 100 + i * 200, 18, 20), shape: 'glyph' as const, metrics: {},
  }));
  assertEquals(groupComments(marks, 1000).length, 0);
});

// ── stage 6 · reconciliation ───────────────────────────────────────────────

const r = (i: number, awarded: number | null, available: number | null,
           recognition: 'high' | 'medium' | 'low' = 'high') =>
  ({ order_index: i, label: `Q${i + 1}`, awarded, available, recognition });

Deno.test('a paper whose marks sum to the reported total reconciles', () => {
  const out = reconcile([r(0, 4, 5), r(1, 3, 5), r(2, 5, 5)], 12, 15);
  assert(out.reconciled);
  assertEquals(out.delta, 0);
  assertEquals(out.message, null);
});

Deno.test('a paper that does not add up says so without blaming the teacher', () => {
  const out = reconcile([r(0, 4, 5), r(1, 3, 5)], 12, 15);
  assert(!out.reconciled);
  assertEquals(out.delta, -5);
  assert(out.message!.includes('Our reading of this paper'));
  assert(!/teacher/i.test(out.message!));
});

Deno.test('a delta the size of one question promotes that question to the front', () => {
  const out = reconcile([r(0, 4, 5), r(1, 3, 5, 'low'), r(2, 5, 5)], 7, 15);
  // Sum 12 against a reported 7: the delta is 5, which is exactly Q3's mark.
  assertEquals(out.delta, 5);
  assertEquals(out.suspects[0], 2);
});

Deno.test('a paper with no total keeps the per-question check and does not reconcile on nothing', () => {
  const out = reconcile([r(0, 4, 5), r(1, 3, 5)], null, null);
  assert(!out.reconciled);
  assertEquals(out.delta, null);
  assert(out.checks.every_question_within_its_maximum);
  assert(out.message!.includes('could not find'));
});

Deno.test('a question awarded more than it was worth fails the third check', () => {
  const out = reconcile([r(0, 7, 5)], 7, 5);
  assert(!out.reconciled);
  assert(!out.checks.every_question_within_its_maximum);
});

Deno.test('reconciliation never rewrites a mark to make the sum work', () => {
  const regions = [r(0, 4, 5), r(1, 3, 5)];
  const before = regions.map((x) => x.awarded);
  reconcile(regions, 99, 10);
  assertEquals(regions.map((x) => x.awarded), before);
});

// ── the confidence model ───────────────────────────────────────────────────

const signals = (over: Partial<Parameters<typeof assess>[0]> = {}) => assess({
  recognition: 'high', numberingSound: true, paperReconciled: true,
  awarded: 4, available: 5, layerFallback: false, unreadable: false, ...over,
});

Deno.test('all four signals passing is the only route to confident', () => {
  assertEquals(signals().tier, 'confident');
  assertEquals(signals({ numberingSound: false }).tier, 'unsure');
  assertEquals(signals({ paperReconciled: false }).tier, 'unsure');
  assertEquals(signals({ recognition: 'low' }).tier, 'unsure');
});

Deno.test('a page that broke the colour assumption cannot produce a confident field', () => {
  assertEquals(signals({ layerFallback: true }).tier, 'unsure');
});

Deno.test('nothing readable is unreadable, not unsure', () => {
  assertEquals(signals({ unreadable: true }).tier, 'unreadable');
  assertEquals(signals({ recognition: null }).tier, 'unreadable');
});

Deno.test('a mark off the half-mark grid is not plausible', () => {
  assert(!signals({ awarded: 3.7 }).signals.plausibility);
  assert(signals({ awarded: 3.5 }).signals.plausibility);
  assert(!signals({ awarded: 6, available: 5 }).signals.plausibility);
});

Deno.test('a gap in the numbering costs the region after it its structural signal', () => {
  assertEquals(numberingSoundness(['Q1', 'Q2', 'Q4']), [true, true, false]);
  assertEquals(numberingSoundness(['Q1', 'Q2', 'Q3']), [true, true, true]);
  // A part label makes no claim about the sequence, so it does not break one.
  assertEquals(numberingSoundness(['Q1', '(a)', 'Q2']), [true, true, true]);
  assertEquals(numberingSoundness(['Q1', null, 'Q2']), [true, false, true]);
});

Deno.test('confident commits as likely, never as confirmed', () => {
  assertEquals(tierToConfidence('confident'), 'likely');
  assertEquals(tierToConfidence('unsure'), 'unsure');
  assertEquals(tierToConfidence('unreadable'), 'unsure');
});

// ── provenance ─────────────────────────────────────────────────────────────

Deno.test('a box outside the normalised grid is discarded, not clamped', () => {
  assertEquals(takeBox({ x: 1400, y: 10, w: 20, h: 20 }, 1, 1000, 1400), null);
  assertEquals(takeBox({ x: 900, y: 10, w: 200, h: 20 }, 1, 1000, 1400), null);
});

Deno.test('a box with no size does not exist', () => {
  assertEquals(takeBox({ x: 10, y: 10, w: 0, h: 20 }, 1, 1000, 1400), null);
  assertEquals(takeBox(null, 1, 1000, 1400), null);
});

Deno.test('a good box lands in page pixels', () => {
  const out = takeBox({ x: 500, y: 250, w: 100, h: 50 }, 2, 1000, 1400);
  assertEquals(out, { page: 2, x: 500, y: 350, w: 100, h: 70 });
});

// ── the do-this-next floor ─────────────────────────────────────────────────

Deno.test('a line about this answer clears the floor', () => {
  assert(clearsTheFloor('Write the formula on its own line before you substitute into it.'));
  assert(clearsTheFloor('Name the net force explicitly in the first sentence of the definition.'));
});

Deno.test('advice about studying does not clear the floor', () => {
  assert(!clearsTheFloor('Revise Newton’s laws before the next test.'));
  assert(!clearsTheFloor('Practice more numericals from this chapter.'));
  assert(!clearsTheFloor('Read the chapter again and be careful with units.'));
  assert(!clearsTheFloor('Work on your presentation in long answers.'));
  assert(!clearsTheFloor('Be more careful.'));
  assert(!clearsTheFloor(null));
  assert(!clearsTheFloor(''));
});
