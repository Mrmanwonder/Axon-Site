// Replays the two syllabus migrations on PGlite over a stubbed schema and
// checks the rules they exist to enforce.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const MIG = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");

const STUDENT = "10000000-0000-0000-0000-000000000001";
const OTHER_STUDENT = "10000000-0000-0000-0000-000000000002";
const PHYS = "30000000-0000-0000-0000-000000000001";
const MATH = "30000000-0000-0000-0000-000000000002";
const FMATH = "30000000-0000-0000-0000-000000000003";

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create table private.scope(student_id uuid);
    create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('role', current_setting('test.role', true)) $$;
    create function private.student_scope_allows(s uuid) returns boolean language sql stable as $$ select exists(select 1 from private.scope where student_id = s) $$;
    create type public.confidence as enum ('confirmed','likely','unsure');
    create table public.student(id uuid primary key);
    create table public.curriculum_provider(id uuid primary key, key text);
    create table public.curriculum_programme(id uuid primary key, provider_id uuid references public.curriculum_provider);
    create table public.subject_offering(id uuid primary key, programme_id uuid references public.curriculum_programme, display_name text, external_code text);
    create table public.student_subject(student_id uuid, subject text, subject_offering_id uuid, display_name_snapshot text, external_code_snapshot text);
    create table public.assessment_identity(id uuid primary key, subject_offering_id uuid);
    create table public.paper(
      id uuid primary key, student_id uuid references public.student, date_taken date default '2026-09-01',
      assessment_identity_id uuid references public.assessment_identity, subject_offering_id uuid,
      subject_display_snapshot text, subject_external_code_snapshot text, subject_identity_source text,
      subject_identity_confidence text, subject_verified_at timestamptz,
      constraint paper_verified_subject_consistent check (true));
    create table public.extraction_run(id uuid primary key default gen_random_uuid(), paper_id uuid references public.paper, tier_routing jsonb, started_at timestamptz default now());
    create table public.student_attempt(id uuid primary key, student_id uuid, paper_id uuid, max_marks numeric, marks_awarded numeric, extraction_confidence public.confidence, student_confirmed_at timestamptz);
    create view public.attempt_analytics as select * from public.student_attempt where extraction_confidence <> 'unsure' or student_confirmed_at is not null;
    create table public.question_region(id uuid primary key, paper_id uuid references public.paper on delete cascade, student_id uuid, question_text text, committed_attempt_id uuid);
    create table public.model_route(stage text primary key, primary_model text, provider text, fallbacks text[], temperature float, max_tokens int, prompt_version text, thinking_level text, allow_training boolean, enabled boolean, notes text,
      constraint model_route_stage_check check (stage in ('explain')));
    create table public.model_call(id serial, stage text, constraint model_call_stage_check check (stage in ('explain')));
    insert into public.student values ('${STUDENT}'), ('${OTHER_STUDENT}');
    insert into public.curriculum_provider values ('40000000-0000-0000-0000-000000000001','cambridge');
    insert into public.curriculum_programme values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001');
    insert into public.subject_offering values
      ('${PHYS}','50000000-0000-0000-0000-000000000001','Physics','9702'),
      ('${MATH}','50000000-0000-0000-0000-000000000001','Mathematics','9709'),
      ('${FMATH}','50000000-0000-0000-0000-000000000001','Further Mathematics','9231');
    insert into public.student_subject values
      ('${STUDENT}','Physics','${PHYS}','Physics','9702'),
      ('${STUDENT}','Mathematics','${MATH}','Mathematics','9709'),
      ('${STUDENT}','Further Mathematics','${FMATH}','Further Mathematics','9231');
  `);
  // The original verified-subject trigger and its strict constraint, as live before these migrations.
  await db.exec(`
    create function private.sync_paper_verified_subject() returns trigger language plpgsql as $$ begin return new; end $$;
    revoke all on function private.sync_paper_verified_subject() from public; -- as in production
    create trigger paper_sync_verified_subject before insert or update of assessment_identity_id, subject_offering_id, subject_display_snapshot,
      subject_external_code_snapshot, subject_identity_source, subject_identity_confidence, subject_verified_at
      on public.paper for each row execute function private.sync_paper_verified_subject();
  `);
  // Papers and runs exist before the migration so the backfill is exercised.
  const paper = (id, suggestion, confidence) => db.exec(`
    insert into public.paper(id, student_id) values ('${id}', '${STUDENT}');
    insert into public.extraction_run(paper_id, tier_routing) values ('${id}', '{"triage":{"subject":"${suggestion}","confidence":"${confidence}"}}');`);
  await paper("20000000-0000-0000-0000-000000000001", "Physics", "high");
  await paper("20000000-0000-0000-0000-000000000002", "Physics", "low");
  await paper("20000000-0000-0000-0000-000000000003", "Chemistry", "high");
  await paper("20000000-0000-0000-0000-000000000004", "mathematics 9709", "high");
  await db.exec(await MIG("20261004100000_syllabus_topics_and_mastery.sql"));
  await db.exec(await MIG("20261004110000_paper_subject_auto_and_topic_tagging.sql"));
  return db;
}

const subjectOf = async (db, id) => (await db.query(
  `select subject_offering_id::text o, subject_identity_source s, subject_identity_confidence c from public.paper where id = $1`, [id])).rows[0];

test("triage's suggestion is assigned only when confident and matching exactly one of the student's subjects", async () => {
  const db = await setup();
  assert.deepEqual(await subjectOf(db, "20000000-0000-0000-0000-000000000001"), { o: PHYS, s: "triage", c: "auto" });
  assert.equal((await subjectOf(db, "20000000-0000-0000-0000-000000000002")).o, null, "low confidence is not assigned");
  assert.equal((await subjectOf(db, "20000000-0000-0000-0000-000000000003")).o, null, "not one of the student's subjects");
  // "mathematics 9709" names Mathematics by code; it must not also match Further Mathematics.
  assert.equal((await subjectOf(db, "20000000-0000-0000-0000-000000000004")).o, MATH);

  // A new run on an unassigned paper assigns through the trigger.
  await db.exec(`insert into public.paper(id, student_id) values ('20000000-0000-0000-0000-000000000005', '${STUDENT}');
    insert into public.extraction_run(paper_id, tier_routing) values ('20000000-0000-0000-0000-000000000005', '{"triage":{"subject":"Further Mathematics","confidence":"high"}}')`);
  assert.equal((await subjectOf(db, "20000000-0000-0000-0000-000000000005")).o, FMATH);
});

test("the student can change a subject; nobody can write the columns directly", async () => {
  const db = await setup();
  const p = "20000000-0000-0000-0000-000000000001";
  await assert.rejects(db.query(`select public.set_paper_subject($1, $2)`, [p, MATH]), /paper not found/, "outside the student's scope");
  await db.exec(`insert into private.scope values ('${STUDENT}')`);
  await db.query(`select public.set_paper_subject($1, $2)`, [p, MATH]);
  assert.deepEqual(await subjectOf(db, p), { o: MATH, s: "student", c: "student" });
  await assert.rejects(db.query(`select public.set_paper_subject($1, $2)`, [p, "30000000-0000-0000-0000-0000000000ff"]), /not one of this student's subjects/);
  // A later triage run never overwrites the student's choice.
  await db.exec(`update public.extraction_run set tier_routing = '{"triage":{"subject":"Physics","confidence":"high"}}' where paper_id = '${p}'`);
  assert.equal((await subjectOf(db, p)).o, MATH);
  await db.query(`select public.set_paper_subject($1, null)`, [p]);
  assert.equal((await subjectOf(db, p)).o, null);
  // Direct writes still go through the guarded trigger, which the real migration keeps strict.
  const consistency = await db.query(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'paper_verified_subject_consistent'`);
  assert.match(consistency.rows[0].d, /'triage'.*'auto'/s);
});

test("tagging queue: claim once, accept only the claimed syllabus, retag on subject change", async () => {
  const db = await setup();
  const p = "20000000-0000-0000-0000-000000000001";
  await db.exec(`
    insert into public.syllabus_document(id, provider_key, syllabus_code, title, version_label, valid_from_year, valid_to_year, source_url, source_sha256, fetched_at)
      values ('60000000-0000-0000-0000-000000000001','cambridge','9702','Physics','2025-2027',2025,2027,'https://x.test/a.pdf','${"a".repeat(64)}',now()),
             ('60000000-0000-0000-0000-000000000002','cambridge','9709','Maths','2026-2027',2026,2027,'https://x.test/b.pdf','${"b".repeat(64)}',now());
    insert into public.subject_offering_syllabus values ('${PHYS}','60000000-0000-0000-0000-000000000001'), ('${MATH}','60000000-0000-0000-0000-000000000002');
    insert into public.syllabus_topic(id, document_id, code, kind, title, sort_order, depth) values
      ('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','2.1','topic','Equations of motion',1,1),
      ('70000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002','1.1','topic','Quadratics',1,1);
    insert into public.student_attempt values ('80000000-0000-0000-0000-000000000001','${STUDENT}','${p}',4,2,'likely',null);
    insert into public.question_region values ('90000000-0000-0000-0000-000000000001','${p}','${STUDENT}','A ball is thrown upwards.','80000000-0000-0000-0000-000000000001');
  `);
  const claim = async () => (await db.query(`select region_id::text r, document_id::text d from public.claim_topic_tag_work(10)`)).rows;
  assert.deepEqual(await claim(), [{ r: "90000000-0000-0000-0000-000000000001", d: "60000000-0000-0000-0000-000000000001" }]);
  assert.deepEqual(await claim(), [], "a queued question is not claimed twice");

  const finish = (tags) => db.query(`select public.finish_topic_tags($1,$2,$3::jsonb,'m','topic_tag.v1') n`,
    ["90000000-0000-0000-0000-000000000001", "60000000-0000-0000-0000-000000000001", JSON.stringify(tags)]);
  // The Maths topic is from another syllabus and is refused.
  const n = (await finish([
    { topic_id: "70000000-0000-0000-0000-000000000001", confidence: "likely", is_primary: true },
    { topic_id: "70000000-0000-0000-0000-000000000002", confidence: "likely" },
  ])).rows[0].n;
  assert.equal(n, 1);

  // Drafts are invisible to the heatmap; verified documents count, unsure tags never do.
  const evidence = async () => (await db.query(`select count(*)::int n from public.topic_evidence`)).rows[0].n;
  assert.equal(await evidence(), 0);
  await db.exec(`update public.syllabus_document set status='verified', verified_at=now() where id='60000000-0000-0000-0000-000000000001'`);
  assert.equal(await evidence(), 1);
  await db.exec(`update public.region_topic set confidence='unsure'`);
  assert.equal(await evidence(), 0);

  // Changing the subject drops the model's tags and re-queues the question against the new syllabus.
  await db.exec(`insert into private.scope values ('${STUDENT}')`);
  await db.query(`select public.set_paper_subject($1, $2)`, [p, MATH]);
  assert.equal((await db.query(`select count(*)::int n from public.region_topic`)).rows[0].n, 0);
  assert.deepEqual(await claim(), [{ r: "90000000-0000-0000-0000-000000000001", d: "60000000-0000-0000-0000-000000000002" }]);
  // A late finish for the old syllabus is ignored.
  assert.equal((await finish([{ topic_id: "70000000-0000-0000-0000-000000000001", confidence: "likely" }])).rows[0].n, 0);
});

test("no SECURITY DEFINER function from these migrations keeps a client or PUBLIC execute grant it should not have", async () => {
  const db = await setup();
  const leaks = await db.query(`
    select n.nspname || '.' || p.proname as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef and n.nspname in ('public','private')
       and p.proname not in ('set_paper_subject','student_scope_allows')
       and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
     order by 1`);
  assert.deepEqual(leaks.rows.map((r) => r.fn), []);
});

test("the service functions are not callable by students", async () => {
  const db = await setup();
  const grants = await db.query(`
    select p.proname, has_function_privilege('authenticated', p.oid, 'execute') auth_exec, has_function_privilege('service_role', p.oid, 'execute') svc_exec
      from pg_proc p where p.proname in ('claim_topic_tag_work','finish_topic_tags','set_paper_subject') order by 1`);
  assert.deepEqual(grants.rows.map((r) => [r.proname, r.auth_exec, r.svc_exec]), [
    ["claim_topic_tag_work", false, true],
    ["finish_topic_tags", false, true],
    ["set_paper_subject", true, false],
  ]);
});
