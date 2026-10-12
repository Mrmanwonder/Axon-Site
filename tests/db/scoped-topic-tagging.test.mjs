import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-226. Minimal stand-ins: the scope resolver is stubbed to whatever the
// test sets in _scope, because its own rules are proven by
// supabase/tests/axo_226_scoped_syllabus_retrieval.sql.

const DOC = '60000000-0000-0000-0000-000000000001';
const PAPER = '20000000-0000-0000-0000-000000000001';
const STUDENT = '10000000-0000-0000-0000-000000000001';
const REGION = '50000000-0000-0000-0000-000000000001';
const SHA = 'a'.repeat(64);

async function boot() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table public._scope(v jsonb);
    insert into public._scope values ('{"status":"available","document_id":"${DOC}","source_sha256":"${SHA}","qualification_scopes":[""]}');
    create function public.resolve_syllabus_retrieval_scope(p uuid) returns jsonb language sql stable as $$ select v from public._scope $$;
    create table public.syllabus_document(id uuid primary key);
    insert into public.syllabus_document values ('${DOC}');
    create table public.syllabus_topic(id uuid primary key default gen_random_uuid(), document_id uuid, parent_id uuid, kind text,
      code text, title text, objective_text text, source_page int, qualification_scope text, sort_order int);
    insert into public.syllabus_topic(document_id, kind, code, title, objective_text, source_page, sort_order) values
      ('${DOC}','objective','3.1','Kinematics','use equations of motion for uniformly accelerated motion in a straight line',4,1),
      ('${DOC}','objective','3.2','Projectiles','describe the motion of projectiles with uniform acceleration',4,2),
      ('${DOC}','objective','7.4','Waves','recall the wave equation relating speed frequency and wavelength',9,3),
      ('${DOC}','objective','9.9','Draft-only','not shown',0,4);
    create table public.paper(id uuid primary key, student_id uuid, subject_offering_id uuid);
    insert into public.paper values ('${PAPER}','${STUDENT}','70000000-0000-0000-0000-000000000001');
    create table public.question_region(id uuid primary key, paper_id uuid, student_id uuid, question_text text, committed_attempt_id uuid);
    insert into public.question_region values ('${REGION}','${PAPER}','${STUDENT}','A ball is thrown','80000000-0000-0000-0000-000000000001');
    create table public.region_topic(region_id uuid, topic_id uuid, student_id uuid, source text, student_rejected_at timestamptz, primary key(region_id, topic_id));
    create table private.topic_tag_job(region_id uuid primary key references public.question_region(id) on delete cascade,
      document_id uuid not null references public.syllabus_document(id), status text not null check (status in ('queued','done','failed','no_match')),
      attempts smallint not null default 0, last_error text, queued_at timestamptz not null default now(), finished_at timestamptz);
    create function private.syllabus_for_paper(p uuid) returns uuid language sql stable as $$ select '${DOC}'::uuid $$;
    grant usage on schema public, private to service_role, authenticated, anon;
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261012200000_axo_226_scoped_topic_tagging.sql', import.meta.url), 'utf8'));
  return db;
}

const search = async (db, terms, sha = SHA) =>
  (await db.query('select public.search_syllabus_topics_any($1,$2,$3,$4,12) r', [PAPER, DOC, sha, terms])).rows[0].r;
const codes = (r) => r.candidates.map((c) => c.code);

test('any term may match; words inside one term must all match', async () => {
  const db = await boot();
  try {
    assert.deepEqual(codes(await search(db, ['projectiles', 'wavelength'])).sort(), ['3.2', '7.4']);
    assert.deepEqual(codes(await search(db, ['equations of motion'])), ['3.1']);
    assert.deepEqual(codes(await search(db, ['equations of frequency'])), []); // not one phrase-like unit anywhere
    const r = await search(db, ['acceleration', 'uniformly', 'straight']);
    assert.equal(r.retrieval, 'lexical_any_v1');
    assert.equal(codes(r)[0], '3.1'); // matches more terms, ranks first
  } finally { await db.close(); }
});

test('an exact objective code is found and ranked first; a source_page 0 row never is', async () => {
  const db = await boot();
  try {
    assert.equal(codes(await search(db, ['motion', '3.2']))[0], '3.2');
    assert.deepEqual(codes(await search(db, ['9.9', 'shown'])), []);
  } finally { await db.close(); }
});

test('no approved scope, a changed source, or bad input returns no candidates', async () => {
  const db = await boot();
  try {
    assert.equal((await search(db, ['motion'], 'b'.repeat(64))).reason, 'scope_changed');
    await db.exec(`update public._scope set v = '{"status":"unavailable","reason":"unlicensed"}'`);
    const r = await search(db, ['motion']);
    assert.equal(r.reason, 'unlicensed');
    assert.deepEqual(r.candidates, []);
    await db.exec(`update public._scope set v = '{"status":"available","document_id":"${DOC}","source_sha256":"${SHA}","qualification_scopes":[""]}'`);
    for (const bad of [[], [''], ['x'.repeat(65)], Array(13).fill('a')]) {
      assert.equal((await search(db, bad)).reason, 'invalid_query');
    }
    // hostile text is only text
    assert.deepEqual(codes(await search(db, ["'); drop table syllabus_topic; --"])), []);
    assert.equal((await db.query('select count(*)::int n from public.syllabus_topic')).rows[0].n, 4);
  } finally { await db.close(); }
});

test('unavailable: model tags go, student tags and rejections stay, the reason is recorded', async () => {
  const db = await boot();
  try {
    await db.exec(`insert into private.topic_tag_job(region_id, document_id, status) values ('${REGION}','${DOC}','queued')`);
    const ids = (await db.query('select id from public.syllabus_topic order by sort_order')).rows.map((r) => r.id);
    await db.query(`insert into public.region_topic values ($1,$2,$3,'model',null), ($1,$4,$3,'student',null), ($1,$5,$3,'model',now())`,
      [REGION, ids[0], STUDENT, ids[1], ids[2]]);
    const ok = (await db.query('select public.finish_topic_tags_unavailable($1,$2,$3) ok', [REGION, DOC, 'draft_only'])).rows[0].ok;
    assert.equal(ok, true);
    const left = (await db.query('select source, student_rejected_at is not null rejected from public.region_topic order by source, rejected')).rows;
    assert.deepEqual(left, [{ source: 'model', rejected: true }, { source: 'student', rejected: false }]);
    const job = (await db.query('select status, unavailable_reason from private.topic_tag_job')).rows[0];
    assert.deepEqual(job, { status: 'unavailable', unavailable_reason: 'draft_only' });
    await assert.rejects(db.query('select public.finish_topic_tags_unavailable($1,$2,$3)', [REGION, DOC, 'Not A Code']), /machine code/);
    // a superseded claim does nothing
    assert.equal((await db.query('select public.finish_topic_tags_unavailable($1,$2,$3) ok', [REGION, PAPER, 'missing'])).rows[0].ok, false);
  } finally { await db.close(); }
});

test('an unavailable job is offered again after a day, not before', async () => {
  const db = await boot();
  try {
    await db.exec(`insert into private.topic_tag_job(region_id, document_id, status, unavailable_reason, finished_at, attempts)
      values ('${REGION}','${DOC}','unavailable','unlicensed', now() - interval '2 hours', 1)`);
    assert.equal((await db.query('select * from public.claim_topic_tag_work(10)')).rows.length, 0);
    await db.exec(`update private.topic_tag_job set finished_at = now() - interval '25 hours'`);
    assert.equal((await db.query('select * from public.claim_topic_tag_work(10)')).rows.length, 1);
    const job = (await db.query('select status, unavailable_reason, attempts from private.topic_tag_job')).rows[0];
    assert.deepEqual(job, { status: 'queued', unavailable_reason: null, attempts: 1 });
  } finally { await db.close(); }
});

test('only the service role can call the new functions', async () => {
  const db = await boot();
  try {
    for (const role of ['authenticated', 'anon']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(search(db, ['motion']), /permission denied/);
      await assert.rejects(db.query('select public.finish_topic_tags_unavailable($1,$2,$3)', [REGION, DOC, 'missing']), /permission denied/);
      await assert.rejects(db.query('select * from public.claim_topic_tag_work(1)'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.ok((await search(db, ['motion'])).candidates.length >= 1);
  } finally { await db.close(); }
});
