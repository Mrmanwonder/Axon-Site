import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-225 slice 2. A minimal stand-in for the pipeline tables; the full-stack
// check is the migration applying in CI's supabase/tests run.

const STUDENT = '10000000-0000-0000-0000-000000000001';
const PAPER = '20000000-0000-0000-0000-000000000001';
const RUN = '30000000-0000-0000-0000-000000000001';
const page = (n) => `40000000-0000-0000-0000-00000000000${n}`;
const region = (n) => `50000000-0000-0000-0000-00000000000${n}`;

async function boot({ flag = true, status = 'content' } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create type public.extraction_status as enum ('queued','triaging','structure','cropping','content','reconciliation',
      'adjudicating','needs_review','explaining','ready','committed','rejected','failed');
    create table public.paper(id uuid primary key, student_id uuid not null, unique (id, student_id));
    create table public.extraction_run(id uuid primary key, paper_id uuid not null, student_id uuid not null,
      status public.extraction_status not null, heartbeat_at timestamptz, started_at timestamptz not null default now(),
      failure_reason text, status_reason text, finished_at timestamptz, unique (id, student_id));
    create table public.paper_page(id uuid primary key, paper_id uuid not null, student_id uuid not null,
      page_number smallint not null, structure_status text not null default 'pending', crop_status text not null default 'pending');
    create table public.question_region(id uuid primary key, run_id uuid not null, paper_id uuid not null, student_id uuid not null,
      order_index smallint not null, extract_status text not null default 'pending', explain_status text, explain_failure_reason text,
      confidence_tier text, needs_review boolean not null default false, confidence_signals jsonb, updated_at timestamptz);
    create table private.feature_flag(key text primary key, enabled boolean not null default false, note text, updated_at timestamptz default now());
    create function private.flag(p_key text) returns boolean language sql stable as
      $$ select coalesce((select enabled from private.feature_flag where key = p_key), false) $$;
    create function private.run_lock(p uuid) returns void language sql as $$ select pg_advisory_xact_lock(hashtextextended(p::text, 0)) $$;
    create function private.run_pages_stored(p uuid) returns boolean language sql as $$ select true $$;
    create function private.sweep_stuck_explanations(p interval default '15 minutes') returns integer language sql as $$ select 0 $$;
    grant usage on schema public, private to service_role, authenticated, anon;
    insert into public.paper values ('${PAPER}', '${STUDENT}');
    insert into public.extraction_run(id, paper_id, student_id, status, heartbeat_at)
      values ('${RUN}', '${PAPER}', '${STUDENT}', '${status}', now() - interval '20 minutes');
    insert into public.paper_page(id, paper_id, student_id, page_number, structure_status, crop_status) values
      ('${page(1)}', '${PAPER}', '${STUDENT}', 1, 'done', 'done'),
      ('${page(2)}', '${PAPER}', '${STUDENT}', 2, 'done', 'done');
    insert into public.question_region(id, run_id, paper_id, student_id, order_index, extract_status) values
      ('${region(1)}', '${RUN}', '${PAPER}', '${STUDENT}', 0, 'done'),
      ('${region(2)}', '${RUN}', '${PAPER}', '${STUDENT}', 1, 'running'),
      ('${region(3)}', '${RUN}', '${PAPER}', '${STUDENT}', 2, 'pending');
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261012190000_axo_225_task_level_recovery.sql', import.meta.url), 'utf8'));
  if (flag) await db.exec(`update private.feature_flag set enabled = true where key = 'task_recovery'`);
  return db;
}

const one = async (db, sql, args = []) => (await db.query(sql, args)).rows[0];
const all = async (db, sql, args = []) => (await db.query(sql, args)).rows;
const sweep = (db) => db.query('select private.sweep_stuck_runs()');
const stale = (db) => db.exec(`update public.extraction_run set heartbeat_at = now() - interval '20 minutes'`);

test('flag off: today\'s behaviour is unchanged (run failed, done pages reset, no outbox)', async () => {
  const db = await boot({ flag: false });
  try {
    await sweep(db);
    const run = await one(db, 'select status, failure_reason, recovery_attempts from public.extraction_run');
    assert.equal(run.status, 'failed');
    assert.equal(run.failure_reason, 'sweep_timeout:content');
    assert.equal(run.recovery_attempts, 0);
    assert.deepEqual((await all(db, 'select structure_status from public.paper_page order by page_number')).map(r => r.structure_status), ['pending', 'pending']);
    assert.equal((await one(db, 'select count(*)::int n from private.stage_outbox')).n, 0);
  } finally { await db.close(); }
});

test('flag on: a stale content run is re-driven, finished work is untouched', async () => {
  const db = await boot();
  try {
    await sweep(db);
    const run = await one(db, `select status, recovery_attempts, heartbeat_at > now() - interval '1 minute' fresh from public.extraction_run`);
    assert.equal(run.status, 'content');
    assert.equal(run.recovery_attempts, 1);
    assert.equal(run.fresh, true);
    const regions = await all(db, 'select id, extract_status from public.question_region order by order_index');
    assert.deepEqual(regions.map(r => r.extract_status), ['done', 'pending', 'pending']);
    assert.deepEqual((await all(db, 'select structure_status from public.paper_page order by page_number')).map(r => r.structure_status), ['done', 'done']);
    const out = await all(db, 'select stage, unit_id, reason from private.stage_outbox order by unit_id');
    assert.deepEqual(out, [
      { stage: 'content', unit_id: region(2), reason: 'recover' },
      { stage: 'content', unit_id: region(3), reason: 'recover' },
    ]);
  } finally { await db.close(); }
});

test('a fresh run is left alone and nothing is enqueued twice', async () => {
  const db = await boot();
  try {
    await sweep(db);
    await sweep(db); // heartbeat is fresh now
    assert.equal((await one(db, 'select recovery_attempts from public.extraction_run')).recovery_attempts, 1);
    assert.equal((await one(db, 'select count(*)::int n from private.stage_outbox')).n, 2);
    await stale(db);
    await sweep(db); // second recovery: the two undelivered rows are not duplicated
    assert.equal((await one(db, 'select recovery_attempts from public.extraction_run')).recovery_attempts, 2);
    assert.equal((await one(db, 'select count(*)::int n from private.stage_outbox')).n, 2);
  } finally { await db.close(); }
});

test('bounded: the third stall takes the old path and fails the run', async () => {
  const db = await boot();
  try {
    for (let i = 0; i < 2; i++) { await sweep(db); await stale(db); }
    await sweep(db);
    const run = await one(db, 'select status, failure_reason, recovery_attempts from public.extraction_run');
    assert.equal(run.status, 'failed');
    assert.equal(run.failure_reason, 'sweep_timeout:content');
    assert.equal(run.recovery_attempts, 2);
  } finally { await db.close(); }
});

test("an old run's undelivered row does not block the next run's re-drive", async () => {
  const db = await boot({ status: 'structure' });
  try {
    await db.exec(`update public.paper_page set structure_status = 'running' where page_number = 2`);
    await sweep(db); // old run queues page 2
    const NEW = '30000000-0000-0000-0000-000000000002';
    await db.exec(`update public.extraction_run set status = 'failed', failure_reason = 'x';
      insert into public.extraction_run(id, paper_id, student_id, status, heartbeat_at)
      values ('${NEW}', '${PAPER}', '${STUDENT}', 'structure', now() - interval '20 minutes');
      update public.paper_page set structure_status = 'running' where page_number = 2`);
    await sweep(db);
    const rows = await all(db, `select run_id from private.stage_outbox where unit_id = '${page(2)}' and delivered_at is null order by created_at`);
    assert.deepEqual(rows.map((r) => r.run_id), [RUN, NEW]);
    const claimed = await all(db, 'select run_id from public.claim_stage_outbox(10)');
    assert.deepEqual(claimed.map((c) => c.run_id), [NEW]); // the failed run's row is dropped, the new one is sent
  } finally { await db.close(); }
});

test('a stale structure run re-drives only unfinished pages', async () => {
  const db = await boot({ status: 'structure' });
  try {
    await db.exec(`update public.paper_page set structure_status = 'running' where page_number = 2`);
    await sweep(db);
    assert.deepEqual((await all(db, 'select structure_status from public.paper_page order by page_number')).map(r => r.structure_status), ['done', 'pending']);
    assert.deepEqual(await all(db, 'select stage, unit_id, reason from private.stage_outbox'), [{ stage: 'structure', unit_id: page(2), reason: 'recover' }]);
  } finally { await db.close(); }
});

test('nothing unfinished: one nudge so the lost fan-out happens', async () => {
  const db = await boot();
  try {
    await db.exec(`update public.question_region set extract_status = 'done'`);
    await sweep(db);
    assert.deepEqual(await all(db, 'select stage, unit_id, reason from private.stage_outbox'), [{ stage: 'content', unit_id: region(1), reason: 'nudge' }]);
    assert.equal((await one(db, 'select status from public.extraction_run')).status, 'content');
  } finally { await db.close(); }
});

test('other stages still fail as before with the flag on', async () => {
  const db = await boot({ status: 'adjudicating' });
  try {
    await sweep(db);
    assert.equal((await one(db, 'select status from public.extraction_run')).status, 'failed');
    assert.equal((await one(db, 'select count(*)::int n from private.stage_outbox')).n, 0);
  } finally { await db.close(); }
});

test('dispatcher: claim, hold, deliver, back off', async () => {
  const db = await boot();
  try {
    await sweep(db);
    const claimed = await all(db, 'select * from public.claim_stage_outbox(10)');
    assert.equal(claimed.length, 2);
    assert.equal((await all(db, 'select * from public.claim_stage_outbox(10)')).length, 0); // held for 2 minutes
    const [a, b] = claimed.map(c => c.event_id);
    assert.equal((await one(db, 'select public.finish_stage_outbox($1, $2, $3) n', [[a], [b], 'queue 500'])).n, 2);
    const rows = await all(db, `select event_id, delivered_at is not null delivered, available_at > now() later, last_send_error from private.stage_outbox`);
    const byId = Object.fromEntries(rows.map(r => [r.event_id, r]));
    assert.equal(byId[a].delivered, true);
    assert.equal(byId[b].delivered, false);
    assert.equal(byId[b].later, true);
    assert.equal(byId[b].last_send_error, 'queue 500');
  } finally { await db.close(); }
});

test('dispatcher drops messages for a run that has already finished', async () => {
  const db = await boot();
  try {
    await sweep(db);
    await db.exec(`update public.extraction_run set status = 'failed', failure_reason = 'x'`);
    assert.equal((await all(db, 'select * from public.claim_stage_outbox(10)')).length, 0);
    assert.equal((await one(db, `select count(*)::int n from private.stage_outbox where delivered_at is not null and last_send_error = 'run_finished'`)).n, 2);
  } finally { await db.close(); }
});

test('deleting the paper removes its outbox rows', async () => {
  const db = await boot();
  try {
    await sweep(db);
    await db.exec(`delete from public.extraction_run; delete from public.paper`);
    assert.equal((await one(db, 'select count(*)::int n from private.stage_outbox')).n, 0);
  } finally { await db.close(); }
});

test('only the service role reaches the dispatcher; browser roles cannot', async () => {
  const db = await boot();
  try {
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.claim_stage_outbox(1)'), /permission denied/);
    await assert.rejects(db.query('select * from private.stage_outbox'), /permission denied/);
    await assert.rejects(db.query('select private.redrive_run($1)', [RUN]), /permission denied/);
    await db.exec('set role service_role');
    assert.ok(Array.isArray(await all(db, 'select * from public.claim_stage_outbox(1)')));
    await assert.rejects(db.query('select private.redrive_run($1)', [RUN]), /permission denied/);
  } finally { await db.close(); }
});
