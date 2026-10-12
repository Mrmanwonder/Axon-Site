// AXO-244 (AXO-245 to AXO-262): error items, tagging, ranking, the spaced
// re-attempt scheduler, the practice loop and v1 analytics, run against the
// whole schema built from every migration.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fullSchema } from './helpers/full-schema.mjs';

let db;
const ids = {};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const all = async (sql, params = []) => (await db.query(sql, params)).rows;

async function as(userId, sessionId) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, session_id: sessionId, role: 'authenticated' })}', false)`);
}

// Fixture: one A Level Physics student (9702) with three marked papers, an
// exam 20 days away, topic tags on a verified syllabus, and a second guardian
// who must never see any of it.
async function seed() {
  const r = await one(`
    with u as (insert into auth.users (email) values ('parent@example.test'), ('other@example.test') returning id)
    select array_agg(id order by id) ids from u`);
  [ids.user, ids.otherUser] = r.ids;
  const prog = await one(`select p.id from public.curriculum_programme p where p.key = 'cambridge_a_level'`);
  let programmeId = prog?.id;
  ids.programme = programmeId;
  if (!programmeId) {
    const prov = await one(`insert into public.curriculum_provider (key, name) values ('cambridge', 'Cambridge') on conflict (key) do update set name = excluded.name returning id`);
    programmeId = (await one(`insert into public.curriculum_programme (provider_id, key, label) values ($1, 'cambridge_a_level', 'Cambridge International A Level') returning id`, [prov.id])).id;
    ids.programme = programmeId;
  }
  ids.guardian = (await one(`insert into public.guardian (auth_user_id, name, contact) values ($1, 'Parent', 'parent@example.test') returning id`, [ids.user])).id;
  ids.otherGuardian = (await one(`insert into public.guardian (auth_user_id, name, contact) values ($1, 'Other', 'other@example.test') returning id`, [ids.otherUser])).id;
  // Required consents first: the consent gate refuses student data without them.
  const notice = await one(`select notice_version from public.consent_notice_text order by notice_version desc limit 1`).catch(() => null);
  await db.query(`insert into public.consent_event (guardian_id, purpose, granted, notice_version, method)
                  select $1, purpose, true, $2, 'in_app_itemised' from public.consent_purpose where is_required`,
    [ids.guardian, notice?.notice_version ?? 'v1']);
  ids.student = (await one(`insert into public.student (guardian_id, first_name, age_band, programme_id) values ($1, 'Asha', 'under_18', $2) returning id`, [ids.guardian, programmeId])).id;
  await db.query(`insert into public.student_subject (student_id, subject, syllabus_code) values ($1, 'Physics', '9702')`, [ids.student]);
  await db.query(`insert into private.student_scope_session (guardian_id, auth_session_id, student_id, expires_at) values ($1, 'sess-1', $2, now() + interval '1 hour')`, [ids.guardian, ids.student]);
  await db.query(`insert into private.student_scope_session (guardian_id, auth_session_id, student_id, expires_at) values ($1, 'sess-2', $2, now() + interval '1 hour')`, [ids.otherGuardian, ids.student]).catch(() => {});

  // Exam plan: zone 4, June 2027 series, paper 2 on today + 20.
  await db.query(`insert into public.exam_zone_location (location_key, lookup_value, label, country, zone, source_url, fetched_at)
                  values ('in', 'India', 'India', 'India', 4, 'https://example.test/zones', now())`);
  const tt = await one(`insert into public.exam_timetable (provider_key, series_key, series_label, zone, status, source_url, source_sha256, fetched_at, first_date, last_date)
                        values ('cambridge', '2027-06', 'June 2027', 4, 'final', 'https://example.test/tt', repeat('a', 64), now(), current_date, current_date + 60) returning id`);
  await db.query(`insert into public.exam_sitting (timetable_id, qualification, syllabus_code, component, title, exam_date, session, duration_minutes)
                  values ($1, 'a_level', '9702', '22', 'Physics Paper 2', current_date + 20, 'AM', 75)`, [tt.id]);
  await db.query(`insert into public.student_exam_plan (student_id, location_key, series_key) values ($1, 'in', '2027-06')`, [ids.student]);

  // Verified syllabus with two topics.
  const doc = await one(`insert into public.syllabus_document (provider_key, syllabus_code, title, version_label, source_url, source_sha256, fetched_at, status, verified_at, verified_by)
                         values ('cambridge', '9702', 'Physics', '2025-2027', 'https://example.test/syl', repeat('b', 64), now(), 'verified', now(), 'owner') returning id`);
  ids.doc = doc.id;
  ids.topicKin = (await one(`insert into public.syllabus_topic (document_id, code, kind, title, sort_order, depth) values ($1, '3.1', 'objective', 'Kinematics', 1, 1) returning id`, [doc.id])).id;
  ids.topicEl = (await one(`insert into public.syllabus_topic (document_id, code, kind, title, sort_order, depth) values ($1, '9.1', 'objective', 'Electric current', 2, 1) returning id`, [doc.id])).id;

  ids.papers = [];
  for (const [i, days] of [[0, 40], [1, 25], [2, 10]].map(([i, d]) => [i, d])) {
    ids.papers.push((await one(`insert into public.paper (student_id, type, tier, date_taken, subject) values ($1, 'unit_test', 'tier_1', current_date - $2::int, 'Physics') returning id`, [ids.student, days])).id);
  }
}

async function attempt(paperIdx, label, text, awarded, max, { answer = 'my answer', confidence = 'confirmed' } = {}) {
  return (await one(`insert into public.student_attempt (student_id, paper_id, paper_tier, question_label, question_text, student_answer, marks_awarded, max_marks, marks_source, extraction_confidence)
                     values ($1, $2, 'tier_1', $3, $4, $5, $6, $7, 'teacher_pen', $8) returning id`,
    [ids.student, ids.papers[paperIdx], label, text, answer, awarded, max, confidence])).id;
}
async function loss(attemptId, cause, lost, cw = null) {
  return (await one(`insert into public.mark_loss_event (attempt_id, student_id, cause, marks_lost, confidence, grounding_status, ai_explanation, command_word)
                     values ($1, $2, $3, $4, 'confirmed', 'complete', 'Explanation text', $5) returning id`, [attemptId, ids.student, cause, lost, cw])).id;
}
async function tag(paperIdx, attemptId, topicId) {
  const run = await one(`insert into public.extraction_run (paper_id, student_id, pipeline_version) values ($1, $2, 'test') returning id`, [ids.papers[paperIdx], ids.student]);
  const region = await one(`insert into public.question_region (run_id, paper_id, student_id, order_index, committed_attempt_id) values ($1, $2, $3, 1, $4) returning id`, [run.id, ids.papers[paperIdx], ids.student, attemptId]);
  await db.query(`insert into public.region_topic (region_id, topic_id, student_id, confidence, is_primary) values ($1, $2, $3, 'confirmed', true)`, [region.id, topicId, ids.student]);
}

before(async () => {
  db = await fullSchema();
  await seed();
  // Paper 0: kinematics lost 2 (slip), current full marks.
  ids.a1 = await attempt(0, '1(a)', 'A car accelerates uniformly. Calculate the acceleration.', 1, 3);
  ids.l1 = await loss(ids.a1, 'procedural_slip', 2);
  await tag(0, ids.a1, ids.topicKin);
  ids.a2 = await attempt(0, '2', 'State Ohm\'s law.', 2, 2);
  await tag(0, ids.a2, ids.topicEl);
  // Paper 1: kinematics again (concept, blank answer → knowledge gap).
  ids.a3 = await attempt(1, '1(b)', 'Explain why the velocity is constant.', 0, 4, { answer: '' });
  ids.l3 = await loss(ids.a3, 'conceptual_gap', 4);
  await tag(1, ids.a3, ids.topicKin);
  // Paper 2: an unsure, unconfirmed read — must never become an item.
  ids.a4 = await attempt(2, '3', 'Describe the motion.', 0, 3, { confidence: 'unsure' });
  // Paper 2: two "Explain" parts and a misconception.
  ids.a5 = await attempt(2, '4(a)', 'Explain what is meant by drift velocity.', 1, 3);
  ids.l5 = await loss(ids.a5, 'conceptual_gap', 2);
  ids.a6 = await attempt(2, '4(b)', 'Explain the effect on the current. Calculate the new current.', 0, 2);
  ids.l6 = await loss(ids.a6, 'keyword_miss', 2, 'Explain');
  await as(ids.user, 'sess-1');
});
after(async () => { await db?.close(); });

test('AXO-247: the printed command word is read deterministically and refuses to guess', async () => {
  const cases = [
    ['A car accelerates uniformly. Calculate the acceleration.', 'Calculate'],
    ['(b) (ii) State Ohm\'s law. [1]', 'State'],
    ['3(a) Show that the speed is 4.0 m s–1.', 'Show that'],
    ['To what extent is inflation caused by demand?', 'How far / To what extent'],
    ['Hence find the value of x.', 'Find'],
    ['Hence, or otherwise, the result follows.', 'Hence'],
    ['Explain the effect. Calculate the current.', null],
    ['The student will state the answer later.', null],
    ['', null],
    [null, null],
  ];
  for (const [text, expected] of cases) {
    const r = await one('select private.printed_command_word($1) w', [text]);
    assert.equal(r.w, expected, String(text));
  }
});

test('AXO-249: causes map onto the four mistake types; a blank answer is a knowledge gap', async () => {
  const pairs = [
    ['procedural_slip', false, 'careless'], ['misread_question', false, 'careless'],
    ['presentation', false, 'technique'], ['keyword_miss', false, 'technique'],
    ['incomplete', false, 'technique'], ['timed_out', false, 'technique'],
    ['conceptual_gap', false, 'misconception'], ['conceptual_gap', true, 'knowledge_gap'],
  ];
  for (const [cause, blank, type] of pairs) {
    assert.equal((await one('select private.mistake_type($1::public.loss_cause, $2) t', [cause, blank])).t, type);
  }
});

test('AXO-246: backfill makes one item per lost-mark part from eligible data only, and is idempotent', async () => {
  const n = await one('select public.refresh_error_items($1) n', [ids.student]);
  assert.equal(n.n, 4, 'four eligible parts lost marks; the unsure read and the full-marks part make none');
  const items = await all('select * from public.error_item where student_id = $1 order by question_label', [ids.student]);
  assert.deepEqual(items.map(i => i.question_label), ['1(a)', '1(b)', '4(a)', '4(b)']);
  const byLabel = Object.fromEntries(items.map(i => [i.question_label, i]));
  assert.equal(byLabel['1(a)'].mistake_type, 'careless');
  assert.equal(byLabel['1(b)'].mistake_type, 'knowledge_gap');
  assert.equal(byLabel['4(a)'].mistake_type, 'misconception');
  assert.equal(byLabel['1(a)'].command_word, 'Calculate');
  assert.equal(byLabel['1(a)'].command_word_source, 'printed');
  assert.equal(byLabel['4(b)'].command_word, 'Explain', 'ambiguous print falls back to the explain stage tag');
  assert.equal(byLabel['4(b)'].command_word_source, 'model');
  // Kinematics lost marks in two papers, but to different mistakes (a slip,
  // then a gap), so neither is a recurrence of the same pattern.
  assert.equal(byLabel['1(a)'].recurrence_count, 1);
  // Two "Explain" parts in paper 2 lost marks to the same concept gap? No:
  // 4(a) is a concept gap, 4(b) a keyword miss. Recurrence needs both.
  assert.equal(byLabel['4(a)'].recurrence_count, 1);
  assert.equal(Number(byLabel['1(b)'].marks_lost), 4);

  // Re-running does not duplicate.
  await db.exec(`insert into private.error_item_dirty (student_id) values ('${ids.student}') on conflict do nothing`);
  await one('select public.refresh_error_items($1) n', [ids.student]);
  assert.equal((await one('select count(*)::int n from public.error_item where student_id = $1', [ids.student])).n, 4);
});

test('AXO-246: a pipeline write marks the student dirty; a re-commit of the same part updates the same item', async () => {
  const before = await one(`select id from public.error_item where question_label = '1(a)'`);
  // The pipeline replaces the attempt (delete and re-insert, same paper and label).
  await db.query('delete from public.mark_loss_event where attempt_id = $1', [ids.a1]);
  await db.query('delete from public.region_topic where region_id in (select id from public.question_region where committed_attempt_id = $1)', [ids.a1]);
  await db.query('update public.question_region set committed_attempt_id = null where committed_attempt_id = $1', [ids.a1]);
  await db.query('delete from public.student_attempt where id = $1', [ids.a1]);
  assert.ok(await one('select 1 x from private.error_item_dirty where student_id = $1', [ids.student]));
  ids.a1 = await attempt(0, '1(a)', 'A car accelerates uniformly. Calculate the acceleration.', 1, 3);
  ids.l1 = await loss(ids.a1, 'procedural_slip', 2);
  await tag(0, ids.a1, ids.topicKin);
  await one('select public.refresh_error_items($1) n', [ids.student]);
  const after = await one(`select id, attempt_id, withdrawn_at from public.error_item where question_label = '1(a)'`);
  assert.equal(after.id, before.id, 'same item, practice history kept');
  assert.equal(after.attempt_id, ids.a1);
  assert.equal(after.withdrawn_at, null);
  assert.equal((await one('select count(*)::int n from public.error_item where student_id = $1', [ids.student])).n, 4);
});

test('Student Mode scope is enforced on every entry point', async () => {
  await as(ids.otherUser, 'sess-2');
  for (const sql of [
    'select public.refresh_error_items($1)', 'select * from public.focus_areas($1)',
    'select public.next_best_action($1)', 'select * from public.due_queue($1)',
    'select * from public.error_journal($1)',
  ]) {
    await assert.rejects(db.query(sql, [ids.student]), /not in scope/, sql);
  }
  await as(ids.user, 'sess-1');
});

test('AXO-250: ranking weighs marks, recurrence and the exam date, and says why', async () => {
  const areas = await all('select * from public.focus_areas($1, null, 10)', [ids.student]);
  const top = areas.find(a => a.kind === 'topic');
  assert.equal(top.label, '3.1 Kinematics');
  assert.equal(Number(top.marks_recoverable), 6);
  assert.equal(top.papers_seen, 2);
  assert.equal(top.exam_days, 20);
  assert.match(top.reason, /6 marks recoverable across 2 papers; exam in 20 days/);
  // "Explain" now covers three lost-mark parts, so it may be named.
  const explain = areas.find(a => a.kind === 'command_word');
  assert.equal(explain.key, 'Explain');
  assert.equal(Number(explain.marks_recoverable), 8);
  assert.equal(areas[0].kind === 'subject', false, 'the subject fallback never leads');
  assert.ok(!areas.some(a => a.kind === 'mistake_type'), 'mistake types are hidden behind their flag');
  const subjectIdx = areas.findIndex(a => a.kind === 'subject');
  assert.ok(subjectIdx > 0 && areas.slice(subjectIdx).every(a => a.kind === 'subject'), 'the subject fallback comes last');
});

test('AXO-251/252: next best action, due queue within budget, and the schedule after each result', async () => {
  // Make every item due.
  await db.query(`update public.error_item set next_review_at = now() - interval '1 day' where student_id = $1`, [ids.student]);
  const due = await all('select * from public.due_queue($1)', [ids.student]);
  assert.ok(due.length >= 3 && due.length <= 6);
  assert.ok(due.reduce((s, d) => s + d.minutes, 0) <= 15);
  const nba = (await one('select public.next_best_action($1) j', [ids.student])).j;
  assert.equal(nba.state, 'ready');
  assert.equal(nba.kind, 'due');

  // Ladder and exam compression.
  const step = async (s, r, d) => one('select * from private.next_interval($1::smallint, $2, $3)', [s, r, d]);
  assert.deepEqual(await step(0, 'got_it', null), { step: 1, days: 3 });
  assert.deepEqual(await step(1, 'got_it', null), { step: 2, days: 7 });
  assert.deepEqual(await step(2, 'partly', null), { step: 2, days: 7 });
  assert.deepEqual(await step(3, 'not_yet', null), { step: 0, days: 1 });
  assert.deepEqual(await step(3, 'got_it', 9), { step: 4, days: 3 }, 'nine days out: no gap longer than three');
  assert.deepEqual(await step(3, 'got_it', 0), { step: 4, days: 1 });

  // A session end to end.
  const s = (await one(`select public.start_practice_session($1, 'item', $2) j`, [ids.student, due[0].id])).j;
  assert.equal(s.state, 'started');
  const item = (await one('select public.practice_item($1) j', [due[0].id])).j;
  assert.equal(item.mistake_type, null, 'label hidden until the classifier passes');
  assert.ok(['retrieval', 'explain_then_retry', 'rewrite', 'final_check'].includes(item.remedy));
  const res1 = (await one(`select public.record_reattempt($1, $2, 'got_it', 'answer') j`, [s.session_id, due[0].id])).j;
  assert.equal(res1.status, 'retried');
  await assert.rejects(db.query(`select public.record_reattempt($1, $2, 'got_it')`, [s.session_id, due[0].id]), /duplicate|unique/);
  const fin = (await one('select public.finish_practice_session($1) j', [s.session_id])).j;
  assert.equal(fin.completed_items, 1);
  assert.equal(fin.ask_if_then, false, 'the if-then prompt is behind its flag');

  // A second pass at least three days after the first fixes the item.
  await db.query(`update public.error_item set last_pass_at = now() - interval '4 days' where id = $1`, [due[0].id]);
  const s2 = (await one(`select public.start_practice_session($1, 'item', $2) j`, [ids.student, due[0].id])).j;
  const res2 = (await one(`select public.record_reattempt($1, $2, 'got_it') j`, [s2.session_id, due[0].id])).j;
  assert.equal(res2.status, 'fixed');
  assert.equal(res2.interval_days, 35);
  const areas = await all('select * from public.focus_areas($1, null, 10)', [ids.student]);
  const fixedLabel = (await one('select question_label from public.error_item where id = $1', [due[0].id])).question_label;
  assert.ok(areas.every(a => a.kind !== 'item'), String(fixedLabel));
});

test('AXO-256: the reveal never carries a scheme that is not permitted for display', async () => {
  const item = await one(`select id from public.error_item where question_label = '1(b)'`);
  const r = (await one('select public.reattempt_reveal($1) j', [item.id])).j;
  assert.equal(r.scheme, null);
  assert.equal(r.scheme_withheld_reason, 'no_scheme');
  assert.equal(r.explanation, 'Explanation text');
  assert.equal(r.marks_source, 'teacher_pen');
});

test('AXO-249/253: the flag reveals mistake types to the ranking only when switched on', async () => {
  await db.exec(`update private.feature_flag set enabled = true where key = 'mistake_type_ui'`);
  const areas = await all('select * from public.focus_areas($1, null, 20)', [ids.student]);
  assert.ok(areas.some(a => a.kind === 'mistake_type'));
  await db.exec(`update private.feature_flag set enabled = false where key = 'mistake_type_ui'`);
});

test('AXO-259/260/261: journal, scorecard and readiness read real states', async () => {
  const journal = await all('select * from public.error_journal($1)', [ids.student]);
  assert.equal(journal.length, 4);
  assert.ok(journal.every(j => j.mistake_type === null));
  assert.ok(journal.find(j => j.question_label === '1(b)').topic_label.includes('Kinematics'));

  const card = await all(`select * from public.scorecard($1, 'Physics')`, [ids.student]);
  const calc = card.find(c => c.dimension === 'command_word' && c.key === 'Calculate');
  assert.equal(Number(calc.marks_gained), 1);
  assert.equal(Number(calc.marks_available), 3);
  const sumAvail = card.filter(c => c.dimension === 'command_word').reduce((s, c) => s + Number(c.marks_available), 0);
  assert.equal(sumAvail, 3 + 2 + 4 + 3 + 2, 'every eligible mark appears once (unsure read excluded)');
  assert.ok(card.some(c => c.dimension === 'ao' && c.key === 'untagged'), 'no AO without an identified paper');

  const ready = await all('select * from public.topic_readiness($1, $2)', [ids.student, ids.doc]);
  const kin = ready.find(t => t.title === 'Kinematics');
  const el = ready.find(t => t.title === 'Electric current');
  assert.equal(el.level, 'familiar', 'full marks once');
  assert.ok(['attempted', 'familiar'].includes(kin.level));
  assert.ok(kin.open_items >= 1);
});

test('AXO-245/262: targets are validated against the board scale; predictions are opt-in', async () => {
  await db.query(`select public.set_target_grade($1, 'Physics', 'A')`, [ids.student]);
  await assert.rejects(db.query(`select public.set_target_grade($1, 'Physics', 'Z')`, [ids.student]), /scale/);
  await assert.rejects(db.query(`select public.set_target_grade($1, 'Chemistry', 'A')`, [ids.student]), /subjects/);
  assert.equal((await one(`select public.grade_outlook($1, 'Physics') j`, [ids.student])).j.state, 'off');
  await db.query(`select public.set_practice_pref($1, 'Asia/Kolkata', true)`, [ids.student]);
  await assert.rejects(db.query(`select public.set_practice_pref($1, 'Mars/Base')`, [ids.student]), /time zone/);
  assert.equal((await one(`select public.grade_outlook($1, 'Physics') j`, [ids.student])).j.why, 'no_verified_thresholds');

  // A verified June set for papers 1, 2, 4 and three identified papers.
  const set = await one(`insert into public.grade_threshold_set (provider_key, syllabus_code, series_key, qualification, option_code, components, component_max, component_weight, max_total, source_url, source_sha256, status, verified_by, verified_at)
     values ('cambridge', '9702', '2025-06', 'a_level', 'TEST', '{2}', '{"2":60}', '{"2":1}', 60, 'https://example.test/gt', repeat('c', 64), 'verified', 'owner', now()) returning id`);
  await db.query(`insert into public.grade_threshold (set_id, grade, min_total) values ($1,'A*',54),($1,'A',45),($1,'B',38),($1,'C',30),($1,'D',22),($1,'E',15)`, [set.id]);
  const out1 = (await one(`select public.grade_outlook($1, 'Physics') j`, [ids.student])).j;
  assert.equal(out1.state, 'not_enough', 'no paper is identified as paper 2 yet');
  // Identifying a paper is server-authored (the pipeline does it), so this
  // step runs with the service role's claims.
  await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
  const ai = await one(`insert into public.assessment_identity (programme_id, title, component_code, exam_year) values ($1, 'Physics Paper 22', '22', 2025) returning id`, [ids.programme]);
  await db.query('update public.paper set assessment_identity_id = $1 where student_id = $2', [ai.id, ids.student]);
  await as(ids.user, 'sess-1');
  const out2 = (await one(`select public.grade_outlook($1, 'Physics') j`, [ids.student])).j;
  assert.equal(out2.state, 'ready');
  assert.equal(out2.papers, 3);
  assert.ok(out2.low_total <= out2.mid_total && out2.mid_total <= out2.high_total);
  assert.equal(out2.target, 'A');
  assert.ok(out2.marks_to_target > 0);
});

test('AXO-246: a part whose reading becomes unsure is withdrawn, and returns with its history when confirmed', async () => {
  await db.query(`update public.student_attempt set extraction_confidence = 'unsure', student_confirmed_at = null where id = $1`, [ids.a5]);
  await one('select public.refresh_error_items($1)', [ids.student]);
  const gone = await one(`select withdrawn_at from public.error_item where attempt_id = $1`, [ids.a5]);
  assert.ok(gone.withdrawn_at, 'withdrawn, not deleted');
  assert.ok(!(await all('select * from public.error_journal($1)', [ids.student])).some(j => j.attempt_id === ids.a5));
  await db.query(`update public.student_attempt set student_confirmed_at = now() where id = $1`, [ids.a5]);
  await one('select public.refresh_error_items($1)', [ids.student]);
  assert.equal((await one(`select withdrawn_at from public.error_item where attempt_id = $1`, [ids.a5])).withdrawn_at, null);
});

test('RLS: a client reading the tables directly sees only the scoped student', async () => {
  await db.exec('set role authenticated');
  try {
    await as(ids.user, 'sess-1');
    assert.ok((await one('select count(*)::int n from public.error_item')).n >= 4);
    await as(ids.otherUser, 'sess-2');
    assert.equal((await one('select count(*)::int n from public.error_item')).n, 0);
    assert.equal((await one('select count(*)::int n from public.reattempt')).n, 0);
    await assert.rejects(db.query(`insert into public.error_item (student_id, dedupe_key, group_key, paper_id, question_label, marks_lost, marks_available, paper_date, next_review_at) values ($1, 'x', 'x', $2, 'q', 1, 1, current_date, now())`, [ids.student, ids.papers[0]]), /permission denied/);
  } finally {
    await db.exec('reset role');
    await as(ids.user, 'sess-1');
  }
});

test('AXO-252: missed days do not pile up — the queue stays inside 6 items and 15 minutes', async () => {
  for (let i = 0; i < 12; i++) {
    const a = await attempt(2, `9(${i})`, 'State the unit of charge.', 0, 2);
    await loss(a, 'keyword_miss', 2);
  }
  await one('select public.refresh_error_items($1)', [ids.student]);
  await db.query(`update public.error_item set next_review_at = now() - interval '10 days' where student_id = $1 and status <> 'fixed'`, [ids.student]);
  const due = await all('select * from public.due_queue($1)', [ids.student]);
  assert.ok(due.length <= 6);
  assert.ok(due.reduce((s, d) => s + d.minutes, 0) <= 15);
  assert.ok(due.every(d => d.overdue_days >= 9));
});

test('AXO-258: with the flag on, the first session of the week is assigned a fixed arm', async () => {
  await db.exec(`update private.feature_flag set enabled = true where key = 'if_then_prompt'`);
  try {
    await db.query(`delete from public.practice_session where student_id = $1`, [ids.student]);
    const item = await one(`select id from public.error_item where student_id = $1 and status <> 'fixed' and withdrawn_at is null limit 1`, [ids.student]);
    const s = (await one(`select public.start_practice_session($1, 'item', $2) j`, [ids.student, item.id])).j;
    await one(`select public.record_reattempt($1, $2, 'partly') j`, [s.session_id, item.id]);
    const fin = (await one('select public.finish_practice_session($1) j', [s.session_id])).j;
    assert.equal(fin.first_of_week, true);
    const cohort = (await one('select if_then_cohort c from public.student_practice_pref where student_id = $1', [ids.student])).c;
    assert.ok(['prompt', 'control'].includes(cohort));
    assert.equal(fin.ask_if_then, cohort === 'prompt');
    if (cohort === 'prompt') {
      await one(`select public.record_intention($1, $2, now() + interval '1 day', 'Kitchen table') id`, [ids.student, s.session_id]);
    }
    await assert.rejects(db.query(`select public.record_intention($1, null, now() - interval '1 hour')`, [ids.student]), /next two weeks/);
  } finally {
    await db.exec(`update private.feature_flag set enabled = false where key = 'if_then_prompt'`);
  }
});

test('AXO-246: a second scan of the same assessment joins the existing item, history intact', async () => {
  const before = await one(`select id, attempts from public.error_item where student_id = $1 and question_label = '1(b)'`, [ids.student]);
  const countBefore = (await one('select count(*)::int n from public.error_item where student_id = $1 and withdrawn_at is null', [ids.student])).n;
  // The same paper scanned again as a new paper row with the same identity.
  await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
  const ai = await one('select assessment_identity_id id from public.paper where id = $1', [ids.papers[1]]);
  const rescan = await one(`insert into public.paper (student_id, type, tier, date_taken, subject, assessment_identity_id) values ($1, 'unit_test', 'tier_1', current_date, 'Physics', $2) returning id`, [ids.student, ai.id]);
  await as(ids.user, 'sess-1');
  ids.papers.push(rescan.id);
  const a = await attempt(ids.papers.length - 1, '1(b)', 'Explain why the velocity is constant.', 1, 4);
  await loss(a, 'conceptual_gap', 3);
  await one('select public.refresh_error_items($1)', [ids.student]);
  const after = await one(`select id, attempts, paper_id, marks_lost from public.error_item where student_id = $1 and question_label = '1(b)' and withdrawn_at is null`, [ids.student]);
  assert.equal(after.id, before.id);
  assert.equal(after.attempts, before.attempts);
  assert.equal(after.paper_id, rescan.id, 'the latest scan is the reading that counts');
  assert.equal(Number(after.marks_lost), 3);
  assert.equal((await one('select count(*)::int n from public.error_item where student_id = $1 and withdrawn_at is null', [ids.student])).n, countBefore);
});
