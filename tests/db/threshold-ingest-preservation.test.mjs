import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';

function sql(status, sha) {
  return execFileSync('python3', ['-c', `
import sys
sys.path.insert(0, 'scripts/exams')
import thresholds_ingest as i
from test_thresholds import TABLE, WEIGHTS
table = i.ct.parse_threshold_lines(TABLE)
routes = i.ct.routes_for_db(table, i.ct.parse_weighting_lines(WEIGHTS))
for r in routes: r['status'] = '${status}'
print('\\n'.join(i.table_sql('https://example.test/source', '${sha}', table, routes, 'https://example.test/weights', 'weights')))
`], { encoding: 'utf8' });
}

test('threshold refresh keeps verified routes/components on a draft downgrade, but accepts the next verified source', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table grade_threshold_set (
        id uuid primary key default gen_random_uuid(), provider_key text, syllabus_code text, series_key text,
        qualification text, option_code text, components smallint[], component_max jsonb, component_weight jsonb,
        max_total numeric, source_url text, source_sha256 text, status text, verified_by text, verified_at timestamptz,
        assessment text, weights_source_url text, weights_source_sha256 text, checks jsonb,
        unique(provider_key, syllabus_code, series_key, qualification, option_code)
      );
      create table grade_threshold (set_id uuid references grade_threshold_set on delete cascade, grade text, min_total numeric);
      create table grade_threshold_component (
        provider_key text, syllabus_code text, series_key text, component smallint, max_raw numeric, grades jsonb,
        source_url text, source_sha256 text, status text, verified_by text, verified_at timestamptz,
        unique(provider_key, syllabus_code, series_key, component)
      );
    `);
    await db.exec(sql('verified', 'first'));
    const before = await db.query('select * from grade_threshold_set order by id');
    assert.ok(before.rows.length > 0);
    await db.exec(sql('draft', 'unverified'));
    assert.deepEqual((await db.query('select * from grade_threshold_set order by id')).rows, before.rows);
    assert.equal((await db.query("select count(*)::int n from grade_threshold_component where status = 'verified' and source_sha256 <> 'first'")).rows[0].n, 0);
    await db.exec(sql('verified', 'second'));
    assert.equal((await db.query("select count(*)::int n from grade_threshold_set where source_sha256 <> 'second'")).rows[0].n, 0);
    assert.ok((await db.query('select count(*)::int n from grade_threshold')).rows[0].n > 0);
  } finally { await db.close(); }
});
