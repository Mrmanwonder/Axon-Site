import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-105: the anonymous share resolver may only serialize an explicit
// allowlist of loss_reasons fields. This runs the migration's own function.
async function load() {
  const sql = await readFile(new URL('../../supabase/migrations/20261001180000_axo_105_share_loss_reasons_allowlist.sql', import.meta.url), 'utf8');
  const start = sql.indexOf('create or replace function private.share_loss_reasons');
  const end = sql.indexOf('revoke all on function private.share_loss_reasons');
  assert.ok(start > 0 && end > start, 'allowlist function present in migration');
  const db = new PGlite();
  await db.exec('create schema private;');
  await db.exec(sql.slice(start, end));
  return db;
}
const run = async (db, value) =>
  (await db.query('select private.share_loss_reasons($1::jsonb) as r', [JSON.stringify(value)])).rows[0].r;

test('only error_type, marks, cause and note cross the public boundary', async () => {
  const db = await load();
  try {
    const out = await run(db, [{
      error_type: 'method', marks: 2, cause: 'c', note: 'n',
      mark_type: 'M', internal_trace: 'x', prompt_fragment: 'y', nested: { student_id: 'z' },
    }]);
    assert.deepEqual(out, [{ error_type: 'method', marks: 2, cause: 'c', note: 'n' }]);
    assert.ok(!JSON.stringify(out).includes('mark_type'));
  } finally { await db.close(); }
});

test('a key added to reasons in future is not published', async () => {
  const db = await load();
  try {
    const out = await run(db, [{ error_type: 'other', marks: 1, brand_new_internal_key: 'SECRET' }]);
    assert.equal(JSON.stringify(out).includes('SECRET'), false);
    assert.deepEqual(Object.keys(out[0]).sort(), ['cause', 'error_type', 'marks', 'note']);
  } finally { await db.close(); }
});

test('wrong-typed allowed fields cannot smuggle structure; junk shapes become []', async () => {
  const db = await load();
  try {
    const out = await run(db, [{ error_type: { a: 1 }, marks: 'many', cause: ['x'], note: { leak: 1 } }, 'str', 7, null]);
    assert.deepEqual(out, [{ error_type: null, marks: null, cause: null, note: null }]);
    assert.deepEqual(await run(db, { not: 'an array' }), []);
    assert.deepEqual(await run(db, null), []);
    assert.deepEqual(await run(db, []), []);
  } finally { await db.close(); }
});

test('order is preserved', async () => {
  const db = await load();
  try {
    const out = await run(db, [{ error_type: 'method', marks: 1 }, { error_type: 'other', marks: 2 }, { error_type: 'presentation', marks: 3 }]);
    assert.deepEqual(out.map(r => r.marks), [1, 2, 3]);
  } finally { await db.close(); }
});

test('the newest resolver definition never passes raw loss_reasons through', async () => {
  const { readdir } = await import('node:fs/promises');
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
  let latest = null;
  for (const f of files) {
    const text = await readFile(new URL(f, dir), 'utf8');
    if (text.includes('create or replace function public.resolve_academic_share')) latest = { f, text };
  }
  assert.ok(latest, 'a resolver definition exists');
  const from = latest.text.indexOf('create or replace function public.resolve_academic_share');
  const body = latest.text.slice(from, latest.text.indexOf('revoke all on function public.resolve_academic_share', from));
  assert.equal(/loss\.loss_reasons/.test(body.replaceAll('private.share_loss_reasons(loss.loss_reasons)', '')), false,
    `${latest.f}: loss_reasons must only appear inside private.share_loss_reasons()`);
  assert.equal((body.match(/private\.share_loss_reasons\(/g) ?? []).length, 2, 'paper and question branches both use the allowlist');
});
