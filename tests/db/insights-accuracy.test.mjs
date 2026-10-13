// AXO-270: the database half of the analytics accuracy work. The printed
// command word matches the UI's reading (shared fixture), the printed paper
// reference is parsed strictly, equating follows the board's grade lines,
// and the scorecard's rates use printed words only.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fullSchema } from './helpers/full-schema.mjs';

let db;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const fixture = JSON.parse(readFileSync(new URL('../fixtures/printed-command-words.json', import.meta.url)));

before(async () => { db = await fullSchema(); });
after(async () => { await db?.close(); });

test('the printed command word reads the same as the UI (shared fixture)', async () => {
  for (const [text, expected] of fixture.cases) {
    assert.equal((await one('select private.printed_command_word($1) w', [text])).w, expected, String(text));
  }
});

test('a printed paper reference is parsed strictly', async () => {
  const ref = async (o) => (await one('select * from private.cambridge_ref($1::jsonb)', [JSON.stringify(o)])) ?? null;
  assert.deepEqual({ ...(await ref({ paper_code: '9709/12/M/J/24', confidence: 'low' })) },
    { syllabus_code: '9709', component: '12', series_key: '2024-06' });
  assert.deepEqual({ ...(await ref({ subject_code: '9231', component_code: '11', session: 'October/November', exam_year: 2025, confidence: 'high' })) },
    { syllabus_code: '9231', component: '11', series_key: '2025-11' });
  assert.deepEqual({ ...(await ref({ subject_code: '9702', paper_code: '2', variant: '2', session: 'Feb/March', exam_year: 2026, confidence: 'high' })) },
    { syllabus_code: '9702', component: '22', series_key: '2026-03' });
  // Low confidence without the full footer, a code that disagrees with the
  // footer, or a missing session: nothing.
  assert.equal(await ref({ subject_code: '9231', component_code: '11', session: 'Oct/Nov', exam_year: 2025, confidence: 'low' }), null);
  assert.equal(await ref({ subject_code: '9702', paper_code: '9709/12/M/J/24' }), null);
  assert.equal(await ref({ subject_code: '9231', component_code: '11', exam_year: 2025, confidence: 'high' }), null);
});

test('equating carries a share to the same place relative to the grade lines', async () => {
  const g = (A, B, C, D, E) => JSON.stringify({ A, B, C, D, E });
  const eq = async (share, sm, s, dm, d) => Number((await one('select private.equate_share($1, $2, $3::jsonb, $4, $5::jsonb) v', [share, sm, s, dm, d])).v);
  // Exactly on the source A line lands exactly on the target A line.
  assert.ok(Math.abs(await eq(50 / 75, 75, g(50, 43, 36, 29, 22), 75, g(56, 48, 40, 32, 24)) - 56 / 75) < 1e-9);
  // Halfway between C and B stays halfway.
  assert.ok(Math.abs(await eq(39.5 / 75, 75, g(50, 43, 36, 29, 22), 75, g(56, 48, 40, 32, 24)) - 44 / 75) < 1e-9);
  // Ends are fixed: zero stays zero, full marks stay full marks.
  assert.equal(await eq(0, 75, g(50, 43, 36, 29, 22), 60, g(40, 34, 28, 22, 16)), 0);
  assert.equal(await eq(1, 75, g(50, 43, 36, 29, 22), 60, g(40, 34, 28, 22, 16)), 1);
  // Thresholds that do not rise are refused, so the caller keeps the raw share.
  assert.equal((await one('select private.equate_share(0.5, 75, $1::jsonb, 75, $2::jsonb) v', [g(50, 43, 44, 29, 22), g(56, 48, 40, 32, 24)])).v, null);
});
