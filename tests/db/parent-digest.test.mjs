import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-263: the weekly parent digest. The database decides who is owed an email and what it
// may say; the sweep Worker only renders and sends. These tests hold the rules that matter:
// consent (checked twice), analytics-only figures, the 3-question / 2-paper / 4-paper
// thresholds, erasure, idempotency, retry limits, and that the ledger keeps nothing personal.

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const STUBS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema private;
  create table auth.users (id uuid primary key, email text);
  create table public.guardian (id uuid primary key, auth_user_id uuid, deleted_at timestamptz);
  create table public.student (
    id uuid primary key, guardian_id uuid not null references public.guardian (id),
    first_name text not null, deleted_at timestamptz);
  create table public.paper (id uuid primary key, student_id uuid, subject text);
  create table public.extraction_run (
    id uuid primary key default gen_random_uuid(), paper_id uuid, student_id uuid,
    status text, committed_at timestamptz);
  create table public.student_attempt (
    id uuid primary key, student_id uuid, paper_id uuid,
    extraction_confidence text, student_confirmed_at timestamptz);
  create table public.mark_loss_event (
    id uuid primary key default gen_random_uuid(), attempt_id uuid, student_id uuid,
    marks_lost numeric, command_word text, confidence text,
    student_confirmed_at timestamptz, student_rejected_at timestamptz);
  create table public.consent_event (
    seq bigserial primary key, guardian_id uuid, student_id uuid, purpose text, granted boolean);

  -- Same logic as production (harden_helpers_into_private_schema).
  create function private.consent_is_granted(p_guardian uuid, p_student uuid, p_purpose text)
  returns boolean language sql stable security definer set search_path = public, pg_temp as $$
    select coalesce(
      (select ce.granted from public.consent_event ce
        where ce.guardian_id = p_guardian and ce.purpose = p_purpose and ce.student_id = p_student
        order by ce.seq desc limit 1),
      (select ce.granted from public.consent_event ce
        where ce.guardian_id = p_guardian and ce.purpose = p_purpose and ce.student_id is null
        order by ce.seq desc limit 1),
      false);
  $$;

  -- Same eligibility rules as production (rls_and_analytics, insights_evidence_columns).
  create view public.attempt_analytics as
    select id, student_id, paper_id from public.student_attempt
     where extraction_confidence <> 'unsure' or student_confirmed_at is not null;
  create view public.mark_loss_analytics as
    select m.id, m.attempt_id, m.student_id, m.marks_lost, m.command_word
      from public.mark_loss_event m
      join public.attempt_analytics a on a.id = m.attempt_id
     where (m.confidence <> 'unsure' or m.student_confirmed_at is not null)
       and m.student_rejected_at is null;
  create view public.student_analytics_readiness as
    select s.id as student_id,
           count(distinct a.paper_id) as papers_counted,
           count(a.id) as questions_counted,
           count(distinct a.paper_id) >= 4 as has_enough_data
      from public.student s left join public.attempt_analytics a on a.student_id = s.id
     group by s.id;
`;

async function load(db) {
  const migration = await readFile(
    new URL('../../supabase/migrations/20261012210000_axo_263_parent_digest.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  return migration;
}

test('parent digest: who is owed one, what it says, and when it stops', async () => {
  const db = new PGlite();
  try {
    await db.exec(STUBS);
    const migration = await load(db);
    await db.exec(migration); // idempotent

    // Guardians 1-8, each with one student of the same number.
    for (let n = 1; n <= 8; n++) {
      await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id(100 + n), `parent${n}@example.test`]);
      await db.query(`insert into public.guardian (id, auth_user_id, deleted_at) values ($1, $2, $3)`,
        [id(n), id(100 + n), n === 6 ? '2026-10-01T00:00:00Z' : null]);
      await db.query(`insert into public.student (id, guardian_id, first_name) values ($1, $2, $3)`,
        [id(200 + n), id(n), ['Ana', 'Ben', 'Cara', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal'][n - 1]]);
    }
    const S = (n) => id(200 + n);
    const G = (n) => id(n);

    // Consent: 1, 2, 5, 6, 7, 8 granted guardian-wide; 3 granted then withdrawn; 4 never asked.
    for (const n of [1, 2, 3, 5, 6, 7, 8]) {
      await db.query(`insert into public.consent_event (guardian_id, student_id, purpose, granted)
                      values ($1, null, 'weekly_parent_digest', true)`, [G(n)]);
    }
    await db.query(`insert into public.consent_event (guardian_id, student_id, purpose, granted)
                    values ($1, null, 'weekly_parent_digest', false)`, [G(3)]);

    let p = 1000;
    const paper = async (student, committedAt, subject = 'Physics') => {
      const pid = id(p++);
      await db.query(`insert into public.paper (id, student_id, subject) values ($1, $2, $3)`, [pid, student, subject]);
      await db.query(`insert into public.extraction_run (paper_id, student_id, status, committed_at)
                      values ($1, $2, 'committed', $3)`, [pid, student, committedAt]);
      return pid;
    };
    let a = 5000;
    const attempt = async (student, pid, confidence = 'confirmed') => {
      const aid = id(a++);
      await db.query(`insert into public.student_attempt (id, student_id, paper_id, extraction_confidence)
                      values ($1, $2, $3, $4)`, [aid, student, pid, confidence]);
      return aid;
    };
    const loss = (student, aid, marks, word, extra = {}) =>
      db.query(`insert into public.mark_loss_event
                  (attempt_id, student_id, marks_lost, command_word, confidence, student_rejected_at)
                values ($1, $2, $3, $4, $5, $6)`,
        [aid, student, marks, word, extra.confidence ?? 'confirmed', extra.rejected ?? null]);

    // ── Ana: five papers, two of them in the week ending 2026-10-11 ────────────
    const pOld = await paper(S(1), '2026-09-01T10:00:00Z');           // no attempts: counts for nothing
    const p2 = await paper(S(1), '2026-09-10T10:00:00Z');
    const p3 = await paper(S(1), '2026-09-20T10:00:00Z');
    const p4 = await paper(S(1), '2026-10-07T10:00:00Z', 'Physics');  // in the week
    const p5 = await paper(S(1), '2026-10-09T10:00:00Z', 'Chemistry');// in the week
    void pOld;
    await loss(S(1), await attempt(S(1), p2), 2, 'Explain');
    await loss(S(1), await attempt(S(1), p2), 1, 'Describe');
    await loss(S(1), await attempt(S(1), p3), 3, 'explain');          // case is folded
    await loss(S(1), await attempt(S(1), p4), 2, 'Explain');
    await loss(S(1), await attempt(S(1), p4), 1, 'Calculate');
    await attempt(S(1), p4);                                           // counted, no marks lost
    await loss(S(1), await attempt(S(1), p5), 4, 'Explain');
    await loss(S(1), await attempt(S(1), p5), 1, 'Describe');
    // Must never reach the digest:
    await loss(S(1), await attempt(S(1), p5, 'unsure'), 9, 'Explain');                    // unsure attempt
    await loss(S(1), await attempt(S(1), p5), 7, 'Explain', { rejected: '2026-10-09T12:00:00Z' }); // student rejected the cause
    await loss(S(1), await attempt(S(1), p5), 5, 'Explain', { confidence: 'unsure' });    // unsure loss

    // ── Ben: two papers in the week, too little for any pattern ───────────────
    const b1 = await paper(S(2), '2026-10-06T10:00:00Z', 'Biology');
    const b2 = await paper(S(2), '2026-10-08T10:00:00Z', 'Biology');
    await loss(S(2), await attempt(S(2), b1), 2, 'Explain');
    await loss(S(2), await attempt(S(2), b2), 2, 'Explain');
    await loss(S(2), await attempt(S(2), b2), 2, 'Explain');

    // Students who must NOT be queued, and two who will be queued then stopped.
    await paper(S(3), '2026-10-07T10:00:00Z');                        // consent withdrawn
    await paper(S(4), '2026-10-07T10:00:00Z');                        // never asked
    await paper(S(5), '2026-09-01T10:00:00Z');                        // consented, nothing in the week
    await paper(S(6), '2026-10-07T10:00:00Z');                        // guardian deleted
    await paper(S(7), '2026-10-07T10:00:00Z');                        // will be erased after queueing
    await paper(S(8), '2026-10-07T10:00:00Z');                        // will withdraw after queueing

    // ── queue ────────────────────────────────────────────────────────────────
    const q1 = (await db.query(`select public.queue_parent_digests('2026-10-11') as n`)).rows[0].n;
    assert.equal(q1, 4, 'Ana, Ben, Gus and Hal only');
    assert.equal((await db.query(`select public.queue_parent_digests('2026-10-11') as n`)).rows[0].n, 0, 'idempotent per student and period');
    const queued = await db.query(`select student_id, period_start::text as s, period_end::text as e from private.parent_digest_delivery order by student_id`);
    assert.deepEqual(queued.rows.map(r => r.student_id), [S(1), S(2), S(7), S(8)]);
    assert.ok(queued.rows.every(r => r.s === '2026-10-05' && r.e === '2026-10-11'), 'seven days ending on the period end');

    // Withdrawal and erasure after queueing win over the queue.
    await db.query(`insert into public.consent_event (guardian_id, student_id, purpose, granted)
                    values ($1, null, 'weekly_parent_digest', false)`, [G(8)]);
    await db.query(`update public.student set first_name = '[erased]', deleted_at = now() where id = $1`, [S(7)]);

    // ── claim ────────────────────────────────────────────────────────────────
    const claimed = (await db.query(`select * from public.claim_parent_digests(25)`)).rows;
    assert.equal(claimed.length, 2);
    const ana = claimed.find(r => r.to_email === 'parent1@example.test');
    const ben = claimed.find(r => r.to_email === 'parent2@example.test');
    assert.ok(ana && ben);

    assert.equal(ana.payload.first_name, 'Ana');
    assert.equal(ana.payload.papers_committed, 2);
    assert.deepEqual(ana.payload.subjects, ['Chemistry', 'Physics']);
    assert.equal(ana.payload.questions_counted, 7, 'unsure attempt left out of the week');
    assert.equal(ana.payload.questions_lost, 4, 'rejected and unsure losses left out');
    assert.equal(ana.payload.marks_lost, 8, '2 + 1 + 4 + 1');
    assert.equal(ana.payload.papers_counted, 4);
    assert.equal(ana.payload.has_enough_data, true);
    assert.deepEqual(ana.payload.areas, [
      { kind: 'command_word', name: 'Explain', questions: 4, papers: 4, marks_lost: 11 },
    ], 'Describe covers only 2 questions, so it is not named');

    assert.equal(ben.payload.has_enough_data, false);
    assert.deepEqual(ben.payload.areas, [], 'three Explain losses, but fewer than four papers overall: no pattern');
    assert.equal(ben.payload.papers_counted, 2);
    assert.equal(ben.payload.marks_lost, 6);

    const skipped = await db.query(`select student_id, skip_reason from private.parent_digest_delivery where status = 'skipped' order by student_id`);
    assert.deepEqual(skipped.rows, [
      { student_id: S(7), skip_reason: 'student_erased' },
      { student_id: S(8), skip_reason: 'consent_withdrawn' },
    ]);

    // Nothing was claimed twice while the claim is held.
    assert.equal((await db.query(`select * from public.claim_parent_digests(25)`)).rows.length, 0);

    // ── finish: sent ─────────────────────────────────────────────────────────
    await db.query(`select public.finish_parent_digest($1, true)`, [ana.delivery_id]);
    const sent = (await db.query(`select status, sent_at is not null as stamped from private.parent_digest_delivery where id = $1`, [ana.delivery_id])).rows[0];
    assert.deepEqual(sent, { status: 'sent', stamped: true });

    // ── finish: failures back off, then become terminal and stay visible ─────
    await db.query(`select public.finish_parent_digest($1, false, 'provider status 503')`, [ben.delivery_id]);
    let row = (await db.query(`select status, send_attempts, last_error, available_at > now() as waiting from private.parent_digest_delivery where id = $1`, [ben.delivery_id])).rows[0];
    assert.deepEqual(row, { status: 'pending', send_attempts: 1, last_error: 'provider status 503', waiting: true });
    assert.equal((await db.query(`select * from public.claim_parent_digests(25)`)).rows.length, 0, 'not before the back-off ends');

    for (let attempt = 2; attempt <= 5; attempt++) {
      await db.query(`update private.parent_digest_delivery set available_at = now() - interval '1 minute' where id = $1`, [ben.delivery_id]);
      const again = (await db.query(`select * from public.claim_parent_digests(25)`)).rows;
      assert.equal(again.length, 1, `attempt ${attempt} is handed out again`);
      await db.query(`select public.finish_parent_digest($1, false, 'provider status 503')`, [ben.delivery_id]);
    }
    row = (await db.query(`select status, send_attempts, last_error from private.parent_digest_delivery where id = $1`, [ben.delivery_id])).rows[0];
    assert.deepEqual(row, { status: 'failed', send_attempts: 5, last_error: 'provider status 503' });
    await db.query(`update private.parent_digest_delivery set available_at = now() - interval '1 minute' where id = $1`, [ben.delivery_id]);
    assert.equal((await db.query(`select * from public.claim_parent_digests(25)`)).rows.length, 0, 'a failed digest is never retried');

    // A sent digest cannot be sent again, even if the queue runs again.
    assert.equal((await db.query(`select public.queue_parent_digests('2026-10-11') as n`)).rows[0].n, 0);

    // ── what the ledger keeps, and who can reach it ──────────────────────────
    const cols = (await db.query(`
      select column_name from information_schema.columns
       where table_schema = 'private' and table_name = 'parent_digest_delivery' order by column_name`)).rows.map(r => r.column_name);
    assert.deepEqual(cols, [
      'available_at', 'claimed_until', 'created_at', 'guardian_id', 'id', 'last_error', 'period_end',
      'period_start', 'send_attempts', 'sent_at', 'skip_reason', 'status', 'student_id',
    ], 'ids, dates and status only: no name, no address, no figures');

    const execs = await db.query(`
      select p.proname, r.rolname
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        cross join pg_roles r
       where ((n.nspname = 'public' and p.proname in ('queue_parent_digests', 'claim_parent_digests', 'finish_parent_digest'))
           or (n.nspname = 'private' and p.proname = 'build_parent_digest'))
         and r.rolname in ('anon', 'authenticated', 'service_role')
         and has_function_privilege(r.rolname, p.oid, 'execute')
       order by p.proname, r.rolname`);
    assert.deepEqual(execs.rows, [
      { proname: 'claim_parent_digests', rolname: 'service_role' },
      { proname: 'finish_parent_digest', rolname: 'service_role' },
      { proname: 'queue_parent_digests', rolname: 'service_role' },
    ], 'only the service role may drive the queue; no client can build a digest');
    for (const role of ['anon', 'authenticated']) {
      const t = await db.query(`select has_table_privilege($1, 'private.parent_digest_delivery', 'select') as can`, [role]);
      assert.equal(t.rows[0].can, false, `${role} cannot read the ledger`);
    }
  } finally {
    await db.close();
  }
});

test('parent digest: a paper whose questions were all left out is reported as unknown, not zero', async () => {
  const db = new PGlite();
  try {
    await db.exec(STUBS);
    await load(db);
    await db.query(`insert into auth.users (id, email) values ($1, 'p@example.test')`, [id(901)]);
    await db.query(`insert into public.guardian (id, auth_user_id) values ($1, $2)`, [id(9), id(901)]);
    await db.query(`insert into public.student (id, guardian_id, first_name) values ($1, $2, 'Ivy')`, [id(209), id(9)]);
    await db.query(`insert into public.consent_event (guardian_id, student_id, purpose, granted)
                    values ($1, null, 'weekly_parent_digest', true)`, [id(9)]);
    await db.query(`insert into public.paper (id, student_id, subject) values ($1, $2, 'Maths')`, [id(1900), id(209)]);
    await db.query(`insert into public.extraction_run (paper_id, student_id, status, committed_at)
                    values ($1, $2, 'committed', '2026-10-08T10:00:00Z')`, [id(1900), id(209)]);
    await db.query(`insert into public.student_attempt (id, student_id, paper_id, extraction_confidence)
                    values ($1, $2, $3, 'unsure')`, [id(5900), id(209), id(1900)]);

    await db.query(`select public.queue_parent_digests('2026-10-11')`);
    const [row] = (await db.query(`select * from public.claim_parent_digests(5)`)).rows;
    assert.equal(row.payload.papers_committed, 1);
    assert.equal(row.payload.questions_counted, 0, 'the Worker must say Axon left them out, not that no marks were lost');
    assert.equal(row.payload.questions_lost, 0);
  } finally {
    await db.close();
  }
});
