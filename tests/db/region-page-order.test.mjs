import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-216 · council D1 step 2. Pages finish structure in any order (axon-backend
// #176 runs them concurrently), so the provisional order_index is finish order.
// private.assemble_structure renumbers once, by page then position on the page.

const RUN = '00000000-0000-4000-8000-000000000010';
const OTHER = '00000000-0000-4000-8000-000000000011';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema private;
    create table public.question_region(
      id uuid primary key default gen_random_uuid(),
      run_id uuid not null,
      order_index integer not null check (order_index >= 0),
      page_spans jsonb not null,
      question_label text,
      question_label_box jsonb,
      continues_from_previous boolean not null default false,
      needs_review boolean not null default false,
      unique (run_id, order_index)
    );
    create table public.teacher_mark(id uuid primary key default gen_random_uuid(), region_id uuid);
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261007160000_region_page_order.sql', import.meta.url), 'utf8'));
  return db;
}

const span = (page, y, x = 10) => JSON.stringify([{ page, box: { x, y, w: 900, h: 100 } }]);

async function insert(db, run, rows) {
  for (const [order_index, page, y, label, extra = {}] of rows) {
    await db.query(
      'insert into public.question_region(run_id, order_index, page_spans, question_label, question_label_box, continues_from_previous) values ($1,$2,$3,$4,$5,$6)',
      [run, order_index, extra.spans ?? span(page, y, extra.x), label, extra.labelY == null ? null : JSON.stringify({ page, x: 1, y: extra.labelY, w: 1, h: 1 }), extra.cont ?? false],
    );
  }
}

const labels = async (db, run) =>
  (await db.query('select question_label as l, order_index as i from public.question_region where run_id=$1 order by order_index', [run])).rows;

test('regions are renumbered by page, then top-to-bottom, with no gaps', async () => {
  const db = await setup();
  try {
    // Finish order: page 3, then page 1, then page 2 — the provisional indices.
    await insert(db, RUN, [
      [0, 3, 500, '(d)'],
      [1, 3, 100, '(c)'],
      [2, 1, 700, '(b)'],
      [3, 1, 100, '1(a)'],
      [4, 2, 300, '2'],
    ]);
    await insert(db, OTHER, [[0, 1, 100, 'other run']]);
    await db.query('select private.assemble_structure($1)', [RUN]);
    const rows = await labels(db, RUN);
    assert.deepEqual(rows.map((r) => r.l), ['1(a)', '(b)', '2', '(c)', '(d)']);
    assert.deepEqual(rows.map((r) => r.i), [0, 1, 2, 3, 4]);
    assert.deepEqual((await labels(db, OTHER)).map((r) => r.i), [0], 'another run is untouched');
  } finally { await db.close(); }
});

test('a merged continuation is ordered by the page its question starts on', async () => {
  const db = await setup();
  try {
    // Page 2 finished first: its top band continues question 1 from page 1.
    await insert(db, RUN, [
      [0, 2, 0, null, { cont: true }],
      [1, 2, 400, '2'],
      [2, 1, 100, '1'],
    ]);
    const merged = (await db.query('select private.assemble_structure($1) as n', [RUN])).rows[0].n;
    assert.equal(merged, 1);
    const rows = await labels(db, RUN);
    assert.deepEqual(rows.map((r) => r.l), ['1', '2']);
    assert.deepEqual(rows.map((r) => r.i), [0, 1]);
    const spans = (await db.query("select page_spans from public.question_region where question_label='1'")).rows[0].page_spans;
    assert.deepEqual(spans.map((s) => s.page), [1, 2]);
  } finally { await db.close(); }
});

test('ties on the region box fall back to the label box, then left to right, then the provisional index', async () => {
  const db = await setup();
  try {
    await insert(db, RUN, [
      [7, 1, 100, 'right', { x: 500 }],
      [3, 1, 100, 'left', { x: 10 }],
      [9, 1, 50, 'label-low', { labelY: 80 }],
      [8, 1, 50, 'label-high', { labelY: 60 }],
    ]);
    await db.query('select private.assemble_structure($1)', [RUN]);
    assert.deepEqual((await labels(db, RUN)).map((r) => r.l), ['label-high', 'label-low', 'left', 'right']);
    // Running it again (a redelivered advance) is a no-op on the order.
    await db.query('select private.assemble_structure($1)', [RUN]);
    assert.deepEqual((await labels(db, RUN)).map((r) => r.i), [0, 1, 2, 3]);
  } finally { await db.close(); }
});
