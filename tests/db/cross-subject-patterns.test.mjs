// AXO-273: the cross-subject pattern writer, on the owner's rule: the same
// cause in at least 2 subjects, each with 4 or more papers, and above the
// student's usual rate beyond chance. Run against the full schema.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fullSchema } from './helpers/full-schema.mjs';

let db;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const all = async (sql, params = []) => (await db.query(sql, params)).rows;
let n = 0;

async function student(name) {
  const u = await one(`insert into auth.users (email) values ($1) returning id`, [`${name}@example.test`]);
  const g = await one(`insert into public.guardian (auth_user_id, name, contact) values ($1, $2, $3) returning id`, [u.id, name, `${name}@example.test`]);
  const notice = await one(`select notice_version from public.consent_notice_text order by notice_version desc limit 1`).catch(() => null);
  await db.query(`insert into public.consent_event (guardian_id, purpose, granted, notice_version, method)
                  select $1, purpose, true, $2, 'in_app_itemised' from public.consent_purpose where is_required`,
    [g.id, notice?.notice_version ?? 'v1']);
  return (await one(`insert into public.student (guardian_id, first_name, age_band) values ($1, $2, 'under_18') returning id`, [g.id, name])).id;
}

// One paper in `subject` with `total` questions, `lost` of them losing 2 marks to `cause`.
async function paper(st, subject, total, lost, cause) {
  const p = await one(`insert into public.paper (student_id, type, tier, date_taken, subject) values ($1, 'unit_test', 'tier_1', current_date - $2::int, $3) returning id`,
    [st, ++n, subject]);
  for (let i = 0; i < total; i++) {
    const a = await one(`insert into public.student_attempt (student_id, paper_id, paper_tier, question_label, question_text, student_answer, marks_awarded, max_marks, marks_source, extraction_confidence)
                         values ($1, $2, 'tier_1', $3, 'State the law.', 'answer', $4, 3, 'teacher_pen', 'confirmed') returning id`,
      [st, p.id, String(i + 1), i < lost ? 1 : 3]);
    if (i < lost) {
      await db.query(`insert into public.mark_loss_event (attempt_id, student_id, cause, marks_lost, confidence, grounding_status, ai_explanation)
                      values ($1, $2, $3, 2, 'confirmed', 'complete', 'Explanation text')`, [a.id, st, cause]);
    }
  }
}

const rows = async (st) => all(`select cause, subjects, question_count, cardinality(paper_ids) papers, summary_text, dismissed_at
                                  from public.pattern_insight where student_id = $1 and scope = 'cross_subject' order by cause`, [st]);

before(async () => { db = await fullSchema(); });
after(async () => { await db?.close(); });

test('the same cause above the usual rate in two subjects with four papers each is written', async () => {
  const st = await student('pat');
  // Physics and Chemistry: 2 of 8 questions per paper lost to missing keywords.
  // Maths: plenty of questions, almost nothing lost, which keeps "usual" low.
  for (const s of ['Physics', 'Chemistry']) for (let i = 0; i < 4; i++) await paper(st, s, 8, 2, 'keyword_miss');
  for (let i = 0; i < 4; i++) await paper(st, 'Mathematics', 10, i === 0 ? 1 : 0, 'procedural_slip');
  assert.equal((await one('select private.refresh_cross_subject_patterns($1) n', [st])).n, 1);
  const [r] = await rows(st);
  assert.equal(r.cause, 'keyword_miss');
  assert.deepEqual(r.subjects, ['Chemistry', 'Physics']);
  assert.equal(r.question_count, 16);
  assert.equal(r.papers, 8);
  assert.equal(r.summary_text, 'Missing keywords cost marks more often than usual in Chemistry and Physics: 16 questions across 8 papers.');
  // Idempotent.
  await one('select private.refresh_cross_subject_patterns($1) n', [st]);
  assert.equal((await rows(st)).length, 1);
});

test('two subjects are enough even when the cause is high everywhere', async () => {
  const st = await student('two');
  for (const s of ['Physics', 'Chemistry']) for (let i = 0; i < 4; i++) await paper(st, s, 8, 3, 'conceptual_gap');
  await one('select private.refresh_cross_subject_patterns($1) n', [st]);
  assert.deepEqual((await rows(st)).map((r) => r.cause), ['conceptual_gap']);
});

test('fewer than four papers in a subject, or the cause in only one subject, writes nothing', async () => {
  const st = await student('few');
  for (let i = 0; i < 4; i++) await paper(st, 'Physics', 8, 3, 'keyword_miss');
  for (let i = 0; i < 3; i++) await paper(st, 'Chemistry', 8, 3, 'keyword_miss');
  for (let i = 0; i < 4; i++) await paper(st, 'Biology', 8, 3, 'presentation');
  assert.equal((await one('select private.refresh_cross_subject_patterns($1) n', [st])).n, 0);
});

test('a cause no more frequent than the student\'s usual rate writes nothing', async () => {
  const st = await student('even');
  // Every paper loses one question to each of the seven causes: no cause is
  // above the student's usual rate, in any subject.
  const causes = ['conceptual_gap', 'procedural_slip', 'misread_question', 'incomplete', 'presentation', 'keyword_miss', 'timed_out'];
  for (const s of ['Physics', 'Chemistry']) {
    for (let i = 0; i < 4; i++) {
      const p = await one(`insert into public.paper (student_id, type, tier, date_taken, subject) values ($1, 'unit_test', 'tier_1', current_date - $2::int, $3) returning id`, [st, ++n, s]);
      for (let q = 0; q < 14; q++) {
        const a = await one(`insert into public.student_attempt (student_id, paper_id, paper_tier, question_label, question_text, student_answer, marks_awarded, max_marks, marks_source, extraction_confidence)
                             values ($1, $2, 'tier_1', $3, 'Q', 'a', $4, 3, 'teacher_pen', 'confirmed') returning id`, [st, p.id, String(q + 1), q < 7 ? 1 : 3]);
        if (q < 7) await db.query(`insert into public.mark_loss_event (attempt_id, student_id, cause, marks_lost, confidence, grounding_status, ai_explanation)
                                   values ($1, $2, $3, 2, 'confirmed', 'complete', 'E')`, [a.id, st, causes[q]]);
      }
    }
  }
  assert.equal((await one('select private.refresh_cross_subject_patterns($1) n', [st])).n, 0);
});

test('a row that stops holding is removed; a dismissed row stays dismissed', async () => {
  const st = await student('stale');
  for (const s of ['Physics', 'Chemistry']) for (let i = 0; i < 4; i++) await paper(st, s, 8, 2, 'timed_out');
  for (let i = 0; i < 4; i++) await paper(st, 'Mathematics', 10, 0, 'timed_out');
  await one('select private.refresh_cross_subject_patterns($1) n', [st]);
  assert.equal((await rows(st)).length, 1);
  // The student says these causes were wrong: they leave analytics, so the
  // pattern no longer holds and its row goes.
  await db.query(`update public.mark_loss_event set student_rejected_at = now() where student_id = $1`, [st]);
  await one('select private.refresh_cross_subject_patterns($1) n', [st]);
  assert.equal((await rows(st)).length, 0);
  // Back again, dismissed by the student, then stops holding: stays dismissed.
  await db.query(`update public.mark_loss_event set student_rejected_at = null where student_id = $1`, [st]);
  await one('select private.refresh_cross_subject_patterns($1) n', [st]);
  await db.query(`update public.pattern_insight set dismissed_at = now() where student_id = $1`, [st]);
  await db.query(`update public.mark_loss_event set student_rejected_at = now() where student_id = $1`, [st]);
  await one('select private.refresh_cross_subject_patterns($1) n', [st]);
  const kept = await rows(st);
  assert.equal(kept.length, 1);
  assert.ok(kept[0].dismissed_at);
});

test('unsure readings never count', async () => {
  const st = await student('unsure');
  for (const s of ['Physics', 'Chemistry']) for (let i = 0; i < 4; i++) await paper(st, s, 8, 2, 'keyword_miss');
  for (let i = 0; i < 4; i++) await paper(st, 'Mathematics', 10, 0, 'keyword_miss');
  await db.query(`update public.student_attempt set extraction_confidence = 'unsure', student_confirmed_at = null
                   where student_id = $1 and paper_id in (select id from public.paper where student_id = $1 and subject = 'Chemistry')`, [st]);
  assert.equal((await one('select private.refresh_cross_subject_patterns($1) n', [st])).n, 0);
});

test('the practice refresh writes the rows too, and never fails the read if it cannot', async () => {
  const st = await student('hook');
  for (const s of ['Physics', 'Chemistry']) for (let i = 0; i < 4; i++) await paper(st, s, 8, 2, 'keyword_miss');
  for (let i = 0; i < 4; i++) await paper(st, 'Mathematics', 10, 0, 'keyword_miss');
  await db.query('select private.ensure_error_items($1)', [st]);
  assert.equal((await rows(st)).length, 1);
});
