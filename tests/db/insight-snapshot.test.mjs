import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration = readFileSync('supabase/migrations/20261015094822_insight_snapshot.sql', 'utf8');
const a = '00000000-0000-0000-0000-000000000001';
const b = '00000000-0000-0000-0000-000000000002';
test('snapshot preserves RLS, eligibility, explicit fields and >1000 evidence rows', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated;');
    // Narrow fixture for the nine existing invoker views/tables. Production
    // policies stay in their own migration suites; this checks RPC privilege
    // propagation rather than assuming a function called "invoker" is safe.
    const projections = [...migration.matchAll(/(\w+) as \(select ([\w,]+) from public\.(\w+) where/g)];
    for (const [, alias, columns, table] of projections) {
      const privateTable = ['attempts', 'losses', 'felt', 'difficulty', 'subjects', 'evidence'].includes(alias);
      const defs = columns.split(',').map(c => `${c} text`);
      if (privateTable) defs.push('student_id uuid');
      defs.push('eligible boolean default true', 'secret text');
      await db.exec(`create table public.${table} (${defs.join(',')}); alter table ${table} enable row level security;
        create policy scoped on ${table} for select to authenticated using (eligible ${privateTable ? "and student_id = current_setting('test.student')::uuid" : ''});
        grant select on ${table} to authenticated;`);
    }
    await db.exec(`insert into attempt_analytics(id,student_id) select 'attempt-' || n, '${a}' from generate_series(1,1005) n;
      insert into attempt_analytics(id,student_id,eligible) values ('unsure','${a}',false), ('other','${b}',true);
      insert into mark_loss_analytics(id,student_id,cause) values ('loss','${a}','conceptual_gap');
      insert into student_subject(student_id,subject_offering_id) values ('${a}','offering');
      insert into subject_offering_syllabus(subject_offering_id,document_id) values ('offering','verified'),('offering','draft');
      insert into syllabus_document(id,eligible) values ('verified',true),('draft',false);
      insert into syllabus_topic(id,document_id) values ('topic','verified'),('hidden-topic','draft');
      insert into topic_evidence(student_id,attempt_id,topic_id,document_id) values ('${a}','attempt-1','topic','verified');`);
    await db.exec(migration);
    await db.exec(`set role authenticated; set test.student = '${a}';`);
    const snapshot = (await db.query(`select insight_snapshot('${a}') as data`)).rows[0].data;
    assert.equal(snapshot.evidence.attempts.length, 1005);
    assert.equal(snapshot.evidence.losses[0].cause, 'conceptual_gap');
    assert.deepEqual(snapshot.syllabus.topics.map(r => r.id), ['topic']);
    assert.deepEqual(snapshot.syllabus.documents.map(r => r.id), ['verified']);
    assert.equal(snapshot.syllabus.evidence.length, 1);
    assert.equal('secret' in snapshot.evidence.attempts[0], false);
    const foreign = (await db.query(`select insight_snapshot('${b}') as data`)).rows[0].data;
    assert.deepEqual(foreign.evidence.attempts, []);
    assert.deepEqual(foreign.syllabus.subjects, []);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query(`select insight_snapshot('${a}')`), /permission denied/);
  } finally { await db.close(); }
});
