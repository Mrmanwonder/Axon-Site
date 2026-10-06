// Replays the exam timetable migration on PGlite over a stubbed schema and
// checks the rules it exists to enforce: a sitting is a fixed date or a
// window, components map to papers, a student's papers must be one of the
// syllabus's published routes at their level, and Student Mode scoping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const MIG = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const AS_STUDENT = "10000000-0000-0000-0000-000000000001";
const AL_STUDENT = "10000000-0000-0000-0000-000000000002";
const SRC = "https://www.cambridgeinternational.org/Images/x.pdf";
const SHA = "a".repeat(64);

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema private;
    create table private.scope(student_id uuid);
    grant usage on schema private to authenticated;
    grant select on private.scope to authenticated;
    create function private.student_scope_allows(s uuid) returns boolean language sql stable
      as $$ select exists(select 1 from private.scope where student_id = s) $$;
    create table public.curriculum_programme(id uuid primary key, key text);
    create table public.student(id uuid primary key, programme_id uuid references public.curriculum_programme);
    create table public.student_subject(student_id uuid, subject text, syllabus_code text);
    insert into public.curriculum_programme values
      ('50000000-0000-0000-0000-000000000001','cambridge_as'),
      ('50000000-0000-0000-0000-000000000002','cambridge_a_level');
    insert into public.student values
      ('${AS_STUDENT}','50000000-0000-0000-0000-000000000001'),
      ('${AL_STUDENT}','50000000-0000-0000-0000-000000000002');
    insert into public.student_subject values
      ('${AS_STUDENT}','Mathematics','9709'), ('${AS_STUDENT}','Chemistry','9701'),
      ('${AL_STUDENT}','Mathematics','9709');
  `);
  await db.exec(await MIG("20261006100000_exam_timetables_and_plans.sql"));
  await db.exec(`
    grant select on public.student_subject, public.student, public.curriculum_programme to authenticated;
    insert into public.exam_timetable (provider_key, series_key, series_label, zone, status, source_url, source_sha256, fetched_at, first_date, last_date)
      values ('cambridge','2026-11','November 2026',4,'final','${SRC}','${SHA}',now(),'2026-09-28','2026-11-13');
    insert into public.syllabus_paper_route (provider_key, syllabus_code, programme_key, kind, papers, source_url, source_sha256) values
      ('cambridge','9709','cambridge_as','whole','{1,2}','${SRC}','${SHA}'),
      ('cambridge','9709','cambridge_as','whole','{1,4}','${SRC}','${SHA}'),
      ('cambridge','9709','cambridge_as','whole','{1,5}','${SRC}','${SHA}'),
      ('cambridge','9709','cambridge_a_level','whole','{1,3,4,5}','${SRC}','${SHA}'),
      ('cambridge','9709','cambridge_a_level','whole','{1,3,5,6}','${SRC}','${SHA}'),
      ('cambridge','9709','cambridge_a_level','complete','{3,6}','${SRC}','${SHA}');
  `);
  return db;
}

const sitting = (db, component, cols) => db.query(`
  insert into public.exam_sitting (timetable_id, qualification, syllabus_code, component, title, exam_date, session, duration_minutes, window_start, window_end)
  select id, 'as', '9709', $1, 'Mathematics', $2::date, $3, $4, $5::date, $6::date from public.exam_timetable returning paper`,
  [component, cols.date ?? null, cols.session ?? null, cols.minutes ?? null, cols.from ?? null, cols.to ?? null]);

test("a sitting is a fixed date and session, or a window, never both or neither", async () => {
  const db = await setup();
  const fixed = await sitting(db, "12", { date: "2026-09-30", session: "PM", minutes: 110 });
  assert.equal(fixed.rows[0].paper, 1);
  const win = await sitting(db, "03", { from: "2026-10-01", to: "2026-10-24" });
  assert.equal(win.rows[0].paper, 3, "component 03 is paper 3");
  await assert.rejects(sitting(db, "22", { date: "2026-10-13", session: "PM", minutes: 110, from: "2026-10-01", to: "2026-10-02" }));
  await assert.rejects(sitting(db, "32", {}));
  await assert.rejects(sitting(db, "42", { from: "2026-10-05", to: "2026-10-01" }), "a window cannot end before it starts");
});

const choose = (db, student, code, papers) => db.query(
  `insert into public.student_exam_papers (student_id, syllabus_code, papers) values ($1, $2, $3::smallint[])
   on conflict (student_id, syllabus_code) do update set papers = excluded.papers returning papers`, [student, code, papers]);

test("papers must be one of the syllabus's published routes at the student's level", async () => {
  const db = await setup();
  const ok = await choose(db, AS_STUDENT, "9709", "{5,1}");
  assert.deepEqual(ok.rows[0].papers, [1, 5], "stored sorted");
  await assert.rejects(choose(db, AS_STUDENT, "9709", "{1,3}"), /not a published route/);
  await assert.rejects(choose(db, AS_STUDENT, "9709", "{1}"), /not a published route/);
  // The second year of a staged A Level: P3 and P6 after P1 and P5 at AS.
  assert.deepEqual((await choose(db, AL_STUDENT, "9709", "{6,3}")).rows[0].papers, [3, 6]);
  await assert.rejects(choose(db, AL_STUDENT, "9709", "{1,5}"), /not a published route/);
});

test("a syllabus without published routes takes the student's own choice", async () => {
  const db = await setup();
  assert.deepEqual((await choose(db, AS_STUDENT, "9701", "{1,2,3}")).rows[0].papers, [1, 2, 3]);
});

test("only the student's own subjects", async () => {
  const db = await setup();
  await assert.rejects(choose(db, AL_STUDENT, "9701", "{1}"), /not one of this student's subjects/);
});

test("Student Mode sees and edits only its own plan; reference data is read-only", async () => {
  const db = await setup();
  await choose(db, AS_STUDENT, "9709", "{1,5}");
  await choose(db, AL_STUDENT, "9709", "{3,6}");
  await db.exec(`
    insert into public.exam_zone_location values ('India, Kolkata - India Standard Time','Kolkata','India, Kolkata - India Standard Time','India',4,'','${SRC}',now());
    insert into private.scope values ('${AS_STUDENT}');
    set role authenticated;`);
  const mine = await db.query(`select student_id::text from public.student_exam_papers`);
  assert.deepEqual(mine.rows.map((r) => r.student_id), [AS_STUDENT]);
  await db.query(`insert into public.student_exam_plan (student_id, location_key, series_key) values ($1, 'India, Kolkata - India Standard Time', '2026-11')`, [AS_STUDENT]);
  await assert.rejects(db.query(`insert into public.student_exam_plan (student_id, series_key) values ($1, '2026-11')`, [AL_STUDENT]));
  const upd = await db.query(`update public.student_exam_papers set papers = '{1,4}' where student_id = $1`, [AL_STUDENT]);
  assert.equal(upd.affectedRows, 0, "another student's papers are invisible");
  await assert.rejects(db.query(`insert into public.exam_timetable (provider_key, series_key, series_label, zone, status, source_url, source_sha256, fetched_at)
    values ('cambridge','2027-03','March 2027',4,'final','${SRC}','${SHA}',now())`));
  assert.equal((await db.query(`select count(*)::int n from public.exam_zone_location`)).rows[0].n, 1);
});
