import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-225 slice 1. A minimal schema stands in for the real one: the journal only
// needs public.paper (id, student_id) and the roles. The full-stack check is the
// migration applying in CI; this proves the behaviour.

const PAPER = '20000000-0000-0000-0000-000000000001';
const OTHER_PAPER = '20000000-0000-0000-0000-000000000002';
const STUDENT = '10000000-0000-0000-0000-000000000001';
const OTHER_STUDENT = '10000000-0000-0000-0000-000000000002';
const d = (c) => c.repeat(64);

async function boot() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table public.paper(id uuid primary key, student_id uuid not null, unique (id, student_id));
    insert into public.paper values ('${PAPER}','${STUDENT}'), ('${OTHER_PAPER}','${OTHER_STUDENT}');
    grant usage on schema public, private to service_role, authenticated, anon;
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261012180000_axo_225_paper_work_journal.sql', import.meta.url), 'utf8'));
  return db;
}

const begin = async (db, over = {}) => {
  const a = { paper: PAPER, student: STUDENT, stage: 'content', unit: 'content:p2:aa', input: d('a'), prompt: d('b'),
    model: 'gemini-x', pv: 'content.v3', sv: 'schema.v1', lease: 300, ...over };
  const r = await db.query('select public.work_begin($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as r',
    [a.paper, a.student, a.stage, a.unit, a.input, a.prompt, a.model, a.pv, a.sv, a.lease]);
  return r.rows[0].r;
};
const save = async (db, id, token, output = { question_text: 'x' }) =>
  (await db.query('select public.work_save_output($1,$2,$3,$4) as r', [id, token, JSON.stringify(output), '{"model":"gemini-x"}'])).rows[0].r;
const row = async (db, id) => (await db.query('select * from private.paper_work_item where work_id=$1', [id])).rows[0];

test('a saved answer is reused by a later run: one paid call, not two', async () => {
  const db = await boot();
  try {
    let paidCalls = 0;
    const first = await begin(db);
    assert.equal(first.action, 'run');
    paidCalls += 1; // the model call
    assert.equal((await save(db, first.work_id, first.lease_token, { question_text: 'Q1' })).result, 'saved');

    // A new run (a retry after the sweep failed the old one) asks for the same work.
    const second = await begin(db);
    assert.equal(second.action, 'reuse');
    assert.deepEqual(second.output, { question_text: 'Q1' });
    assert.equal(second.work_id, first.work_id);
    assert.equal(paidCalls, 1);
    assert.match(second.checksum, /^[0-9a-f]{64}$/);
    await begin(db); // a third run reuses it as well
    assert.equal((await row(db, first.work_id)).reuse_count, 2);
  } finally { await db.close(); }
});

test('worker dies after the answer is saved and before the downstream write: replay, no second call', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    await save(db, a.work_id, a.lease_token);
    // crash here: status stays output_saved, never applied
    const replay = await begin(db);
    assert.equal(replay.action, 'reuse');
    assert.equal(replay.status, 'output_saved');
    assert.equal((await db.query('select public.work_mark_applied($1) as ok', [a.work_id])).rows[0].ok, true);
    const again = await begin(db);
    assert.equal(again.action, 'reuse');
    assert.equal(again.status, 'applied');
    // marking applied twice is harmless
    assert.equal((await db.query('select public.work_mark_applied($1) as ok', [a.work_id])).rows[0].ok, true);
  } finally { await db.close(); }
});

test('two workers: only one holds the lease, the other is told to wait', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    const b = await begin(db);
    assert.equal(a.action, 'run');
    assert.equal(b.action, 'busy');
    assert.ok(b.retry_after_seconds >= 1);
  } finally { await db.close(); }
});

test('an expired lease is reclaimed, counted as an unknown outcome, and the stale worker is fenced', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    await db.query(`update private.paper_work_item set lease_expires_at = now() - interval '1 minute' where work_id=$1`, [a.work_id]);
    const b = await begin(db);
    assert.equal(b.action, 'run');
    assert.notEqual(b.lease_token, a.lease_token);
    assert.equal(b.unknown_outcomes, 1);
    assert.equal(b.attempt, 2);

    // The first worker finally returns with its answer: it no longer owns the work.
    assert.equal((await save(db, a.work_id, a.lease_token, { question_text: 'stale' })).result, 'fenced');
    assert.equal((await db.query('select output from private.paper_work_item where work_id=$1', [a.work_id])).rows[0].output, null);

    assert.equal((await save(db, b.work_id, b.lease_token, { question_text: 'fresh' })).result, 'saved');
    // A late retry of the second save returns the stored answer.
    const late = await save(db, b.work_id, b.lease_token, { question_text: 'other' });
    assert.equal(late.result, 'already_saved');
    assert.deepEqual(late.output, { question_text: 'fresh' });
  } finally { await db.close(); }
});

test('a released failure is claimable at once and is not counted as an unknown outcome', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    assert.equal((await db.query('select public.work_release($1,$2,$3) as ok', [a.work_id, a.lease_token, 'timeout'])).rows[0].ok, true);
    const b = await begin(db);
    assert.equal(b.action, 'run');
    assert.equal(b.unknown_outcomes, 0);
    // only the lease holder can release
    assert.equal((await db.query('select public.work_release($1,$2,$3) as ok', [b.work_id, a.lease_token, 'x'])).rows[0].ok, false);
  } finally { await db.close(); }
});

test('changed evidence, prompt, model or another paper never reuses someone else\'s answer', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    await save(db, a.work_id, a.lease_token);
    assert.equal((await begin(db, { input: d('c') })).action, 'run');            // page pixels changed
    assert.equal((await begin(db, { prompt: d('c') })).action, 'run');           // teacher mark or label changed
    assert.equal((await begin(db, { model: 'gemini-y' })).action, 'run');        // route changed
    assert.equal((await begin(db, { pv: 'content.v4' })).action, 'run');         // prompt version
    assert.equal((await begin(db, { sv: 'schema.v2' })).action, 'run');         // schema version
    assert.equal((await begin(db, { paper: OTHER_PAPER, student: OTHER_STUDENT })).action, 'run'); // another student's paper
    assert.equal((await begin(db)).action, 'reuse');                             // the original is untouched
  } finally { await db.close(); }
});

test('a student id that does not own the paper is refused', async () => {
  const db = await boot();
  try {
    await assert.rejects(begin(db, { student: OTHER_STUDENT }), /unknown paper for this student/);
  } finally { await db.close(); }
});

test('an invalidated answer is not reused and the work can be paid for again', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    await save(db, a.work_id, a.lease_token);
    assert.equal((await db.query('select public.work_invalidate($1,$2) as ok', [a.work_id, 'schema_changed'])).rows[0].ok, true);
    const b = await begin(db);
    assert.equal(b.action, 'run');
    assert.notEqual(b.work_id, a.work_id);
  } finally { await db.close(); }
});

test('answers older than the retention window are purged and not reused', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    await save(db, a.work_id, a.lease_token);
    await db.query(`update private.paper_work_item set expires_at = now() - interval '1 day' where work_id=$1`, [a.work_id]);
    const b = await begin(db);
    assert.equal(b.action, 'run');
    assert.equal((await db.query('select count(*)::int n from private.paper_work_item where work_id=$1', [a.work_id])).rows[0].n, 0);
  } finally { await db.close(); }
});

test('deleting the paper removes its saved answers', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    await save(db, a.work_id, a.lease_token);
    await db.query(`delete from public.paper where id=$1`, [PAPER]);
    assert.equal((await db.query('select count(*)::int n from private.paper_work_item')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('bad input is refused: no output object, oversize lease, malformed digest', async () => {
  const db = await boot();
  try {
    const a = await begin(db);
    await assert.rejects(db.query(`select public.work_save_output($1,$2,'[1]'::jsonb,'{}')`, [a.work_id, a.lease_token]), /JSON object/);
    await assert.rejects(begin(db, { lease: 5 }), /lease must be/);
    await assert.rejects(begin(db, { input: 'abc' }), /input_digest|check/);
  } finally { await db.close(); }
});

test('only the service role can reach the journal; the browser roles cannot', async () => {
  const db = await boot();
  try {
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from private.paper_work_item'), /permission denied/);
    await assert.rejects(begin(db), /permission denied/);
    await db.exec('set role anon');
    await assert.rejects(begin(db), /permission denied/);
    await db.exec('set role service_role');
    assert.equal((await begin(db)).action, 'run');
    await assert.rejects(db.query('select * from private.paper_work_item'), /permission denied/);
  } finally { await db.close(); }
});
