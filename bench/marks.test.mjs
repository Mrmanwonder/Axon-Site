import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markAlternatives, allocationIsUsable } from '../src/scan/marks.js';

/**
 * The row this file exists for.
 *
 * Reported live on 2026-09-06: the "which number did your teacher write?" row
 * offered `0 · 0.5 · 1 · 1.5 · 2 · 3`. Half marks do not exist in CAIE at any
 * of IGCSE, AS or A Level, so 0.5 and 1.5 are marks no teacher could have
 * written — and a paper total that only balances once one is admitted is the
 * reconciler reporting that the extraction is wrong, which a half-mark chip
 * turns into a shrug.
 */
test('a 3-mark question awarded 1 offers whole marks only', () => {
  assert.deepEqual(markAlternatives({ marks_available: 3, marks_awarded: 1 }), [0, 1, 2, 3]);
});

test('a 1-mark question offers exactly 0 and 1', () => {
  assert.deepEqual(markAlternatives({ marks_available: 1, marks_awarded: 0 }), [0, 1]);
  assert.deepEqual(markAlternatives({ marks_available: 1, marks_awarded: 1 }), [0, 1]);
});

test('no decimal is reachable through the row, at any allocation', () => {
  for (let available = 1; available <= 20; available++) {
    for (let awarded = 0; awarded <= available; awarded++) {
      for (const v of markAlternatives({ marks_available: available, marks_awarded: awarded })) {
        assert.equal(v, Math.round(v), `${v} offered on a ${available}-mark question`);
      }
    }
  }
});

test('options stay inside the allocation', () => {
  for (let available = 1; available <= 12; available++) {
    for (let awarded = 0; awarded <= available; awarded++) {
      for (const v of markAlternatives({ marks_available: available, marks_awarded: awarded })) {
        assert.ok(v >= 0 && v <= available, `${v} offered on a ${available}-mark question`);
      }
    }
  }
});

test('both ends are always reachable, however big the question', () => {
  // Trimming used to slice the tail, which dropped the top of the range: a
  // 9-mark question offered no way to say "all of them".
  for (const available of [1, 3, 7, 9, 12, 20, 50]) {
    const opts = markAlternatives({ marks_available: available, marks_awarded: null });
    assert.ok(opts.includes(0), `no 0 on a ${available}-mark question`);
    assert.ok(opts.includes(available), `no ${available} on a ${available}-mark question`);
    assert.ok(opts.length <= 7, `${opts.length} chips is more than the row holds`);
  }
});

test('the row stays around the mark we read', () => {
  const opts = markAlternatives({ marks_available: 8, marks_awarded: 4 });
  for (const near of [3, 4, 5]) assert.ok(opts.includes(near), `${near} should be one tap away`);
});

test('no allocation on the page means no row to offer', () => {
  assert.deepEqual(markAlternatives({ marks_available: null, marks_awarded: 2 }), []);
  assert.deepEqual(markAlternatives({ marks_available: 0, marks_awarded: 0 }), []);
});

/**
 * An allocation that cannot be right renders no grid at all.
 *
 * The first version rounded it: 2.5 marks available produced `0 · 3`, offering
 * a mark above the allocation itself, which `correctMark` then refused. That is
 * the worst of both — it launders a bad read into a plausible-looking option
 * and spends the student's tap to tell them nothing. An unusable allocation is
 * an extraction failure and the screen says so instead.
 */
test('an unusable allocation renders no grid', () => {
  for (const marks_available of [2.5, 0.5, -1, 0, null, undefined, NaN, 'three', '', {}]) {
    assert.deepEqual(
      markAlternatives({ marks_available, marks_awarded: 1 }), [],
      `an allocation of ${JSON.stringify(marks_available)} should offer nothing`,
    );
  }
});

test('allocationIsUsable names the same set, so the screen can explain itself', () => {
  for (const bad of [2.5, 0.5, -1, 0, null, undefined, NaN, 'three']) {
    assert.equal(allocationIsUsable({ marks_available: bad }), false, `${JSON.stringify(bad)} is not usable`);
  }
  for (const good of [1, 3, 12, '4']) {
    assert.equal(allocationIsUsable({ marks_available: good }), true, `${JSON.stringify(good)} is usable`);
  }
});

test('nothing offered is ever above the allocation, at any input', () => {
  // The 2.5 bug in one assertion: every option must be a mark the typed rung
  // would also accept, so no chip can be rejected after it is tapped.
  for (const marks_available of [1, 2, 3, 7, 9, 20]) {
    for (const marks_awarded of [null, 0, 1, 2, 5, 20, 1.5, -1, 'x']) {
      for (const v of markAlternatives({ marks_available, marks_awarded })) {
        assert.ok(v >= 0 && v <= marks_available, `${v} offered on a ${marks_available}-mark question`);
        assert.equal(v, Math.floor(v), `${v} is not a whole mark`);
      }
    }
  }
});

test('a fractional or impossible awarded mark does not poison the grid', () => {
  // Unlike the allocation, a bad awarded mark is the thing being corrected, so
  // the row still renders — it just does not centre on a number that cannot be.
  assert.deepEqual(markAlternatives({ marks_available: 3, marks_awarded: 1.5 }), [0, 1, 2, 3]);
  assert.deepEqual(markAlternatives({ marks_available: 3, marks_awarded: 99 }), [0, 1, 2, 3]);
  assert.deepEqual(markAlternatives({ marks_available: 3, marks_awarded: -2 }), [0, 1, 2, 3]);
});
