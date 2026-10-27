// AXO-291: the daily ingests must write nothing when nothing changed. Every
// unchanged row they rewrote was disk IO on the Nano instance (302k updates to
// 12.5k syllabus topics, 170k sitting inserts for 4.8k rows) and part of what
// stalled it on 13 and 26 Oct. A row that was not rewritten keeps its xmin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fullSchema } from "./helpers/full-schema.mjs";
import { sqlFor } from "../../scripts/syllabus/ingest.mjs";

const xmins = async (db, sql) => (await db.query(sql)).rows.map((r) => Object.values(r).join(" "));

/** Runs a snippet with scripts/exams on the path and returns the SQL it prints. */
function examSql(body) {
  return execFileSync("python3", ["-c", `
import json, sys
sys.path.insert(0, 'scripts/exams')
import ingest as i
${body}
`], { encoding: "utf8" });
}

const TIMETABLE = `
t = {'provider_key': 'cambridge', 'series_key': '2026-11', 'series_label': 'November 2026', 'zone': 4,
     'timetable_variant': '', 'status': 'final', 'source_url': 'https://example.test/tt.pdf'}
rows = [{'qualification': 'as', 'syllabus_code': '9709', 'component': '12', 'title': 'Pure 1',
         'date': '2026-10-08', 'session': 'PM', 'duration_minutes': 110}]
windows = [{'qualification': 'as', 'syllabus_code': '9701', 'component': '33', 'title': 'Practical',
            'window_start': '2026-09-28', 'window_end': '2026-10-09'}]
`;

test("exam ingest: an unchanged timetable, zone or paper route writes nothing", async () => {
  const db = await fullSchema();
  const load = examSql(`
zones = json.load(open('curriculum/exams/cambridge-zones.json'))
manifest = json.load(open('curriculum/exams/sources.json'))
${TIMETABLE}
print('\\n'.join(i.zone_sql(zones) + i.timetable_sql(t, 'a' * 64, rows, windows, [], 'Version 1', '2026-10-27T00:00:00Z') + i.route_sql(manifest['routes'])))
`);
  await db.exec(load);
  const q = {
    zones: "select location_key, xmin::text from public.exam_zone_location order by 1",
    timetable: "select id, xmin::text from public.exam_timetable order by 1",
    sittings: "select id, xmin::text from public.exam_sitting order by 1",
    routes: "select id, xmin::text from public.syllabus_paper_route order by 1",
  };
  const before = Object.fromEntries(await Promise.all(Object.entries(q).map(async ([k, s]) => [k, await xmins(db, s)])));
  assert.ok(before.zones.length > 100 && before.routes.length > 10, "the real manifests loaded");
  assert.equal(before.sittings.length, 2);

  // The next day: same files, a later run time. Nothing is rewritten.
  await db.exec(load.replace("2026-10-27T00:00:00Z", "2026-10-28T00:00:00Z"));
  for (const [k, s] of Object.entries(q)) assert.deepEqual(await xmins(db, s), before[k], `${k} were rewritten`);

  // A new file for the same series and zone replaces that timetable.
  await db.exec(examSql(`${TIMETABLE}
rows[0]['date'] = '2026-10-09'
print('\\n'.join(i.timetable_sql(t, 'b' * 64, rows, windows, [], 'Version 2', '2026-10-29T00:00:00Z')))`));
  const tt = (await db.query("select source_sha256, version_label from public.exam_timetable")).rows;
  assert.deepEqual(tt, [{ source_sha256: "b".repeat(64), version_label: "Version 2" }]);
  assert.equal((await db.query("select exam_date::text d from public.exam_sitting where component = '12'")).rows[0].d, "2026-10-09");

  // --rewrite (a parser change) loads it again even though the file is the same.
  await db.exec(examSql(`${TIMETABLE}
print('\\n'.join(i.timetable_sql(t, 'b' * 64, rows, windows, [], 'Version 2', '2026-10-30T00:00:00Z', rewrite=True)))`));
  assert.notDeepEqual(await xmins(db, q.timetable), before.timetable);

  // A route dropped from the manifest is removed; the others stay untouched.
  const routesBefore = await xmins(db, q.routes);
  await db.exec(examSql(`
manifest = json.load(open('curriculum/exams/sources.json'))
print('\\n'.join(i.route_sql(manifest['routes'][1:])))`));
  const routesAfter = await xmins(db, q.routes);
  assert.equal(routesAfter.length, routesBefore.length - 1);
  assert.ok(routesAfter.every((r) => routesBefore.includes(r)));
});

const DOC = {
  provider_key: "cambridge", syllabus_code: "9709", version_label: "2026-2027", title: "Mathematics",
  source_url: "https://example.test/9709.pdf", source_sha256: "c".repeat(64), parser: "cambridge",
};
const parsed = (text) => ({
  style: "table",
  units: [{ code: "1", title: "Pure Mathematics 1", scope: "AS", topics: [{
    code: "1.1", title: "Quadratics", page: 9, objectives: [
      { code: "1.1.1", text: text, notes: null, group: null, page: 9 },
      { code: "1.1.2", text: "find the discriminant of a quadratic polynomial", notes: null, group: null, page: 9 },
    ] }] }],
});

test("syllabus ingest: an unchanged document writes nothing; a changed objective rewrites only that row", async () => {
  const db = await fullSchema();
  const topics = "select code, xmin::text from public.syllabus_topic order by code";
  const doc = "select fetched_at::text, xmin::text from public.syllabus_document";
  await db.exec(sqlFor(DOC, parsed("carry out the process of completing the square"), "2026-10-27T00:00:00Z"));
  const t0 = await xmins(db, topics);
  const d0 = await xmins(db, doc);
  assert.equal(t0.length, 4);

  await db.exec(sqlFor(DOC, parsed("carry out the process of completing the square"), "2026-10-28T00:00:00Z"));
  assert.deepEqual(await xmins(db, topics), t0, "unchanged topics were rewritten");
  assert.deepEqual(await xmins(db, doc), d0, "an unchanged document was rewritten");

  await db.exec(sqlFor(DOC, parsed("carry out the process of completing the square for a quadratic"), "2026-10-29T00:00:00Z"));
  const t2 = await xmins(db, topics);
  const changed = t2.filter((r) => !t0.includes(r)).map((r) => r.split(" ")[0]);
  assert.deepEqual(changed, ["1.1.1"]);
  assert.match((await xmins(db, doc))[0], /^2026-10-29/);
});

test("threshold ingest reads both kinds of known line", () => {
  const out = execFileSync("python3", ["-c", `
import sys, tempfile, json
sys.path.insert(0, 'scripts/exams')
import thresholds_ingest as t
f = tempfile.NamedTemporaryFile('w', delete=False, suffix='.txt')
f.write('verified\\thttps://a.test/1.pdf\\nloaded\\thttps://a.test/2.pdf\\tsha2\\twsha\\nhttps://a.test/old.pdf\\n\\n')
f.close()
v, l = t.read_known(f.name)
print(json.dumps([sorted(v), l]))
`], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(out), [["https://a.test/1.pdf", "https://a.test/old.pdf"], { "https://a.test/2.pdf": ["sha2", "wsha"] }]);
});
