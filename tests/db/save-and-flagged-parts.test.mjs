import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-216: commit_extraction_run, fix_saved_part, begin_explanations, the D7 paper type rules and
// the share resolver, run from the migration itself against the columns and constraints they
// touch in production.
const MIGRATION = new URL('../../supabase/migrations/20261008044957_save_placed_labels_and_flagged_parts.sql', import.meta.url);

const STUDENT = '00000000-0000-0000-0000-0000000000a1';
const PAPER = '00000000-0000-0000-0000-0000000000b1';
const RUN = '00000000-0000-0000-0000-0000000000c1';

async function load() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create schema extensions;
    create function auth.role() returns text language sql as $$ select null::text $$;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function private.student_scope_allows(uuid) returns boolean language sql as $$ select true $$;
    create function private.run_lock(uuid) returns void language sql as $$ select $$;
    create function extensions.digest(text, text) returns bytea language sql as $$ select sha256(convert_to($1, 'UTF8')) $$;
    create type public.paper_type as enum ('unit_test', 'mid_term', 'final_exam', 'pyq', 'sample_paper');
    create type public.paper_tier as enum ('tier_1', 'tier_2');
    create type public.confidence as enum ('confirmed', 'likely', 'unsure');
    create type public.confidence_tier as enum ('confident', 'unsure', 'unreadable');

    create table public.paper (
      id uuid primary key, student_id uuid not null, type public.paper_type not null,
      tier public.paper_tier not null, date_taken date not null default current_date, subject text,
      reported_total numeric, total_awarded numeric, total_available numeric, total_basis text,
      total_partial boolean not null default false, reconciled boolean,
      unique (id, tier), unique (id, student_id),
      constraint school_tests_are_tier_1 check (tier = 'tier_1' or type in ('pyq', 'sample_paper'))
    );
    create table public.extraction_run (
      id uuid primary key, paper_id uuid not null, student_id uuid not null, status text not null,
      committed_at timestamptz, finished_at timestamptz, adjudication jsonb, reconciled boolean,
      reconcile_delta numeric, tier_routing jsonb, started_at timestamptz default now()
    );
    create function public.run_advance(p uuid, s text) returns void language sql as $$ update public.extraction_run set status = s where id = p $$;
    create table public.student_attempt (
      id uuid primary key default gen_random_uuid(), student_id uuid not null, paper_id uuid not null,
      paper_tier public.paper_tier not null, canonical_question_id uuid, question_label text not null,
      question_text text, student_answer text, answer_block jsonb, marks_awarded numeric not null,
      max_marks numeric not null, marks_source text not null, teacher_remark text,
      extraction_confidence public.confidence not null, student_confirmed_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      constraint marks_within_max check (marks_awarded <= max_marks),
      constraint tier_1_has_no_canonical_question check (paper_tier = 'tier_2' or canonical_question_id is null),
      constraint student_attempt_paper_id_paper_tier_fkey foreign key (paper_id, paper_tier) references public.paper(id, tier) on delete cascade
    );
    create table public.question_region (
      id uuid primary key default gen_random_uuid(), run_id uuid not null, paper_id uuid not null,
      student_id uuid not null, order_index integer not null, question_label text, question_label_box jsonb,
      question_text text, student_answer text, student_answer_box jsonb, answer_block jsonb,
      teacher_remark text, marks_awarded numeric, marks_awarded_box jsonb, marks_available numeric,
      marks_available_box jsonb, confidence_tier public.confidence_tier not null default 'confident',
      confidence_signals jsonb, needs_review boolean not null default false,
      student_confirmed_at timestamptz, student_corrected boolean not null default false,
      committed_attempt_id uuid references public.student_attempt(id) on delete set null,
      canonical_question_id uuid, page_spans jsonb, explain_status text not null default 'pending',
      explain_failure_reason text, updated_at timestamptz default now(), created_at timestamptz default now(),
      constraint awarded_has_provenance check ((marks_awarded is null) = (marks_awarded_box is null)),
      constraint available_has_provenance check ((marks_available is null) = (marks_available_box is null)),
      constraint answer_has_provenance check ((student_answer is null) = (student_answer_box is null)),
      constraint awarded_within_available check (marks_awarded is null or marks_available is null or marks_awarded <= marks_available),
      constraint unreadable_stays_unreviewed check (confidence_tier <> 'unreadable' or committed_attempt_id is null),
      constraint explain_failure_reason_is_a_code check (explain_failure_reason is null or explain_failure_reason ~ '^[a-z0-9_]+(:[a-z0-9_]+)?$')
    );
    create table public.mark_loss_event (
      id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.student_attempt(id) on delete cascade,
      student_id uuid not null, cause text, marks_lost numeric, ai_explanation text, do_this_next text,
      confidence public.confidence, concepts text[], command_word text, command_word_note text,
      model_answer text, loss_reasons jsonb, grounding_status text, model_answer_source text,
      depends_on_parts text[], unresolved_parts text[], student_confirmed_at timestamptz,
      student_rejected_at timestamptz, created_at timestamptz default now()
    );
    create table public.region_explanation (
      region_id uuid, student_id uuid, run_id uuid, cause text, marks_lost numeric, body text,
      do_this_next text, concepts text[], command_word text, command_word_note text, model_answer text,
      loss_reasons jsonb, grounding_status text, model_answer_source text, depends_on_parts text[], unresolved_parts text[]
    );
    create table public.page_unreadable (paper_id uuid, student_id uuid, page_number integer);
    create table public.paper_page (paper_id uuid, student_id uuid, page_number integer, structure_status text);
    create table private.academic_share (
      id uuid primary key default gen_random_uuid(), token_hash bytea, revoked_at timestamptz,
      expires_at timestamptz, resource_type text, paper_id uuid, student_id uuid, attempt_id uuid
    );
    create function private.share_loss_reasons(jsonb) returns jsonb language sql as $$ select coalesce($1, '[]'::jsonb) $$;
  `);
  await db.exec(await readFile(MIGRATION, 'utf8'));
  return db;
}

const box = { x: 0.1, y: 0.1, w: 0.5, h: 0.1 };
const spans = (page = 1) => JSON.stringify([{ page, box }]);

async function paper(db, { type = 'unit_test', tier = 'tier_1', source } = {}) {
  await db.query(
    `insert into public.paper (id, student_id, type, tier${source ? ', type_source' : ''}) values ($1, $2, $3, $4${source ? ', $5' : ''})`,
    source ? [PAPER, STUDENT, type, tier, source] : [PAPER, STUDENT, type, tier],
  );
  await db.query(`insert into public.extraction_run (id, paper_id, student_id, status) values ($1, $2, $3, 'ready')`, [RUN, PAPER, STUDENT]);
}

async function region(db, order, { label = null, placed = null, awarded = 1, available = 2, tier = 'confident', review = false, confirmed = false, answer = null } = {}) {
  const { rows } = await db.query(
    `insert into public.question_region (run_id, paper_id, student_id, order_index, question_label, question_label_box, placed_label,
       marks_awarded, marks_awarded_box, marks_available, marks_available_box, confidence_tier, needs_review,
       student_confirmed_at, page_spans, student_answer, student_answer_box)
     values ($1, $2, $3, $4, $5, case when $5::text is null then null else '{}'::jsonb end, $6, $7,
       case when $7::numeric is null then null else '{}'::jsonb end, $8, case when $8::numeric is null then null else '{}'::jsonb end,
       $9, $10, case when $11 then now() end, $12::jsonb, $13, case when $13::text is null then null else '{}'::jsonb end)
     returning id`,
    [RUN, PAPER, STUDENT, order, label, placed, awarded, available, tier, review, confirmed, spans(), answer],
  );
  return rows[0].id;
}

const commit = (db) => db.query('select public.commit_extraction_run($1) as r', [RUN]).then((r) => r.rows[0].r);
const attempts = (db) => db.query('select question_label, extraction_confidence::text as conf, student_confirmed_at is not null as confirmed, marks_awarded::int as awarded from public.student_attempt order by question_label').then((r) => r.rows);

test('bare part labels placed under different questions save', async () => {
  const db = await load();
  try {
    await paper(db);
    await region(db, 0, { label: '3' , awarded: 1, available: 1 });
    await region(db, 1, { label: '(c)', placed: '3(c)' });
    await region(db, 2, { label: '5' , awarded: 1, available: 1 });
    await region(db, 3, { label: '(c)', placed: '5(c)' });
    const result = await commit(db);
    assert.equal(result.attempts_committed, 4);
    assert.equal((await db.query(`select status from public.extraction_run`)).rows[0].status, 'committed');
  } finally { await db.close(); }
});

test('bare labels with no placed label are not duplicates, as in the unique index', async () => {
  const db = await load();
  try {
    await paper(db);
    await region(db, 0, { label: '(c)' });
    await region(db, 1, { label: '(c)' });
    assert.equal((await commit(db)).attempts_committed, 2);
  } finally { await db.close(); }
});

test('two parts placed under the same label are still refused, and the refusal names them', async () => {
  const db = await load();
  try {
    await paper(db);
    await region(db, 0, { label: '(c)', placed: '3(c)' });
    await region(db, 1, { label: '3(c)', placed: '3(c)' });
    await assert.rejects(commit(db), (error) => /both read as 3\(c\)/.test(error.message) && /Check the reading/.test(error.message));
    assert.equal((await db.query('select count(*)::int as n from public.student_attempt')).rows[0].n, 0);
    assert.equal((await db.query(`select committed_at from public.extraction_run`)).rows[0].committed_at, null);
  } finally { await db.close(); }
});

test('printed labels that differ only in punctuation are the same part', async () => {
  const db = await load();
  try {
    await paper(db);
    await region(db, 0, { label: '2a' });
    await region(db, 1, { label: '2. a)' });
    await assert.rejects(commit(db), /both read as/);
  } finally { await db.close(); }
});

test('a flagged part the student has not checked is saved as unsure and kept out of analytics', async () => {
  const db = await load();
  try {
    await paper(db);
    await region(db, 0, { label: '1', review: false });
    await region(db, 1, { label: '2', review: true });
    await region(db, 2, { label: '3', review: true, confirmed: true });
    await region(db, 3, { label: '4', review: true, tier: 'unsure' });
    assert.equal((await commit(db)).attempts_committed, 4);
    assert.deepEqual(await attempts(db), [
      { question_label: '1', conf: 'likely', confirmed: false, awarded: 1 },
      { question_label: '2', conf: 'unsure', confirmed: false, awarded: 1 },
      { question_label: '3', conf: 'likely', confirmed: true, awarded: 1 },
      { question_label: '4', conf: 'unsure', confirmed: false, awarded: 1 },
    ]);
    // The production analytics view's rule (attempt_analytics).
    const eligible = await db.query(`select question_label from public.student_attempt
      where extraction_confidence <> 'unsure' or student_confirmed_at is not null order by 1`);
    assert.deepEqual(eligible.rows.map((r) => r.question_label), ['1', '3']);
  } finally { await db.close(); }
});

test('a run already saved is refused, and nothing is written twice', async () => {
  const db = await load();
  try {
    await paper(db);
    await region(db, 0, { label: '1' });
    await commit(db);
    await assert.rejects(commit(db), (error) => error.code === '23505');
    assert.equal((await db.query('select count(*)::int as n from public.student_attempt')).rows[0].n, 1);
  } finally { await db.close(); }
});

test('explanations go ahead for the paper and wait for flagged parts until they are checked', async () => {
  const db = await load();
  try {
    await paper(db);
    await db.query(`update public.extraction_run set status = 'needs_review'`);
    const clean = await region(db, 0, { label: '1', awarded: 0, available: 2 });
    const flagged = await region(db, 1, { label: '2', awarded: 0, available: 2, review: true });
    const begun = (await db.query('select public.begin_explanations($1) as r', [RUN])).rows[0].r;
    assert.deepEqual(begun.region_ids, [clean]);
    const held = (await db.query('select explain_status, explain_failure_reason from public.question_region where id = $1', [flagged])).rows[0];
    assert.deepEqual(held, { explain_status: 'skipped', explain_failure_reason: 'held_for_check' });
    assert.equal((await db.query('select public.retry_failed_explanations($1) as r', [RUN])).rows[0].r.queued, 0);
    await db.query('update public.question_region set student_confirmed_at = now() where id = $1', [flagged]);
    const retry = (await db.query('select public.retry_failed_explanations($1) as r', [RUN])).rows[0].r;
    assert.deepEqual(retry.region_ids, [flagged]);
  } finally { await db.close(); }
});

test('Fix this on a saved paper corrects the reading, counts it as checked and redoes the totals', async () => {
  const db = await load();
  try {
    await paper(db);
    const flagged = await region(db, 0, { label: '1', awarded: 1, available: 3, review: true });
    await region(db, 1, { label: '2', awarded: 2, available: 2 });
    await commit(db);
    const attempt = (await db.query('select committed_attempt_id as id from public.question_region where id = $1', [flagged])).rows[0].id;
    await db.query(`insert into public.mark_loss_event (attempt_id, student_id, cause, marks_lost, confidence) values ($1, $2, 'procedural_slip', 2, 'unsure')`, [attempt, STUDENT]);

    await assert.rejects(db.query('select public.fix_saved_part($1, 4)', [flagged]), /out of 3, so 4/);
    const fixed = (await db.query('select public.fix_saved_part($1, 2) as r', [flagged])).rows[0].r;
    assert.equal(fixed.explain, true);

    const saved = (await db.query('select marks_awarded::int as awarded, student_confirmed_at is not null as confirmed from public.student_attempt where id = $1', [attempt])).rows[0];
    assert.deepEqual(saved, { awarded: 2, confirmed: true });
    const regionRow = (await db.query('select marks_awarded::int as awarded, student_corrected, explain_failure_reason from public.question_region where id = $1', [flagged])).rows[0];
    assert.deepEqual(regionRow, { awarded: 2, student_corrected: true, explain_failure_reason: 'held_for_check' });
    assert.equal((await db.query('select count(*)::int as n from public.mark_loss_event')).rows[0].n, 0, 'the explanation was for the misread mark');
    const totals = (await db.query('select total_awarded::int as a, total_available::int as b from public.paper')).rows[0];
    assert.deepEqual(totals, { a: 4, b: 5 });
  } finally { await db.close(); }
});

test('a flagged part with no mark read is saved once the student gives the teacher\'s mark', async () => {
  const db = await load();
  try {
    await paper(db);
    await region(db, 0, { label: '1', awarded: 1, available: 1 });
    const missing = await region(db, 1, { label: '2', awarded: null, available: 3, review: true });
    assert.equal((await commit(db)).attempts_committed, 1);
    assert.equal((await db.query('select total_partial from public.paper')).rows[0].total_partial, true);

    const fixed = (await db.query('select public.fix_saved_part($1, 1) as r', [missing])).rows[0].r;
    assert.ok(fixed.attempt_id);
    const row = (await db.query(`select question_label, extraction_confidence::text as conf, student_confirmed_at is not null as confirmed
      from public.student_attempt where id = $1`, [fixed.attempt_id])).rows[0];
    assert.deepEqual(row, { question_label: '2', conf: 'likely', confirmed: true });
    const boxRow = (await db.query('select marks_awarded_box from public.question_region where id = $1', [missing])).rows[0];
    assert.deepEqual(boxRow.marks_awarded_box, { page: 1, ...box }, 'the mark is tied to where the student was looking');
    const p = (await db.query('select total_awarded::int as a, total_partial from public.paper')).rows[0];
    assert.deepEqual(p, { a: 2, total_partial: false });
  } finally { await db.close(); }
});

test('Fix this is for saved papers; an unsaved one is fixed in Check the reading', async () => {
  const db = await load();
  try {
    await paper(db);
    const id = await region(db, 0, { label: '1', review: true });
    await assert.rejects(db.query('select public.fix_saved_part($1, 1)', [id]), /not saved yet/);
  } finally { await db.close(); }
});

test('a printed paper code read with high confidence makes a default paper a past paper', async () => {
  const db = await load();
  try {
    await paper(db);
    assert.equal((await db.query('select type_source from public.paper')).rows[0].type_source, 'default');
    const code = (confidence) => JSON.stringify({ triage: { assessment_identity: { subject_code: '9709', paper_code: '62', confidence } } });
    await db.query('update public.extraction_run set tier_routing = $1::jsonb', [code('medium')]);
    assert.deepEqual((await db.query('select type::text, tier::text from public.paper')).rows[0], { type: 'unit_test', tier: 'tier_1' });
    await db.query('update public.extraction_run set tier_routing = $1::jsonb', [code('high')]);
    assert.deepEqual((await db.query('select type::text, tier::text, type_source from public.paper')).rows[0], { type: 'pyq', tier: 'tier_2', type_source: 'triage' });
  } finally { await db.close(); }
});

test('the student\'s own choice of type is never changed by triage', async () => {
  const db = await load();
  try {
    await paper(db, { source: 'student' });
    await db.query('update public.extraction_run set tier_routing = $1::jsonb', [JSON.stringify({ triage: { assessment_identity: { subject_code: '9709', paper_code: '62', confidence: 'high' } } })]);
    assert.deepEqual((await db.query('select type::text, tier::text from public.paper')).rows[0], { type: 'unit_test', tier: 'tier_1' });
  } finally { await db.close(); }
});

test('changing the type on a saved paper moves its parts to the new tier', async () => {
  const db = await load();
  try {
    await paper(db, { type: 'pyq', tier: 'tier_2' });
    await region(db, 0, { label: '1' });
    await commit(db);
    await db.query(`update public.student_attempt set canonical_question_id = gen_random_uuid()`);
    await db.query(`select public.set_paper_type($1, 'unit_test')`, [PAPER]);
    assert.deepEqual((await db.query('select type::text, tier::text, type_source from public.paper')).rows[0], { type: 'unit_test', tier: 'tier_1', type_source: 'student' });
    assert.deepEqual((await db.query('select paper_tier::text as t, canonical_question_id from public.student_attempt')).rows[0], { t: 'tier_1', canonical_question_id: null });
    await db.query(`select public.set_paper_type($1, 'pyq')`, [PAPER]);
    assert.equal((await db.query('select paper_tier::text as t from public.student_attempt')).rows[0].t, 'tier_2');
  } finally { await db.close(); }
});

test('a shared paper shows only checked parts, and no total while any part is withheld', async () => {
  const db = await load();
  try {
    await paper(db);
    await region(db, 0, { label: '1', awarded: 1, available: 2 });
    const flagged = await region(db, 1, { label: '2', awarded: 0, available: 2, review: true });
    await commit(db);
    const token = 'a'.repeat(64);
    await db.query(`insert into private.academic_share (token_hash, expires_at, resource_type, paper_id, student_id)
      values (extensions.digest($1, 'sha256'), now() + interval '1 day', 'paper', $2, $3)`, [token, PAPER, STUDENT]);
    let shared = (await db.query('select public.resolve_academic_share($1) as r', [token])).rows[0].r;
    assert.deepEqual(shared.questions.map((q) => q.question_label), ['1']);
    assert.equal(shared.withheld_parts, 1);
    assert.equal(shared.paper.total_awarded, null);

    const attempt = (await db.query('select committed_attempt_id as id from public.question_region where id = $1', [flagged])).rows[0].id;
    const questionToken = 'b'.repeat(64);
    await db.query(`insert into private.academic_share (token_hash, expires_at, resource_type, paper_id, student_id, attempt_id)
      values (extensions.digest($1, 'sha256'), now() + interval '1 day', 'question', $2, $3, $4)`, [questionToken, PAPER, STUDENT, attempt]);
    const question = (await db.query('select public.resolve_academic_share($1) as r', [questionToken])).rows[0].r;
    assert.equal(question.withheld, true);
    assert.equal(question.question, undefined);

    await db.query('select public.fix_saved_part($1)', [flagged]);
    shared = (await db.query('select public.resolve_academic_share($1) as r', [token])).rows[0].r;
    assert.deepEqual(shared.questions.map((q) => q.question_label), ['1', '2']);
    assert.equal(shared.withheld_parts, 0);
    assert.equal(Number(shared.paper.total_awarded), 1);
  } finally { await db.close(); }
});
