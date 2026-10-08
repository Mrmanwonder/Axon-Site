import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-217 (council D2): public.consent_notice_text holds the exact text of each
// notice version, is append-only, readable by authenticated users only, and
// writable by nobody but a migration.
const MIGRATION = new URL('../../supabase/migrations/20261007160000_consent_notice_text.sql', import.meta.url);

async function freshDb() {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists private;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    end $$;
    grant usage on schema public to anon, authenticated;
    -- The hosted project's default grants (20260826074533): the migration must
    -- take write access away again, not rely on it never having been given.
    alter default privileges in schema public
      grant select, insert, update, delete on tables to anon, authenticated;
  `);
  await db.exec(await readFile(MIGRATION, 'utf8'));
  return db;
}

test('seeds 1.1.0 in English and Hindi with a hash of the stored content, and no 1.0.0', async () => {
  const db = await freshDb();
  try {
    const { rows } = await db.query(
      `select version, language, content::text as text, sha256 from public.consent_notice_text order by version, language`);
    assert.deepEqual(rows.map((r) => `${r.version}/${r.language}`), ['1.1.0/en', '1.1.0/hi']);
    for (const r of rows) {
      assert.equal(r.sha256, createHash('sha256').update(r.text, 'utf8').digest('hex'));
    }
    const en = JSON.parse(rows[0].text);
    assert.equal(en.title, "What you're agreeing to");
    assert.deepEqual(en.sections[2].items.map((i) => i.label), [
      'Advertising of any kind', 'Behavioural tracking', 'Selling data to anyone', 'Ranking against other students',
    ]);
    const hi = JSON.parse(rows[1].text);
    assert.equal(hi.action, 'सहमति दें');
  } finally { await db.close(); }
});

test('is append-only and a re-run of the migration changes nothing', async () => {
  const db = await freshDb();
  try {
    const before = (await db.query(`select sha256, created_at from public.consent_notice_text order by language`)).rows;
    await db.exec(await readFile(MIGRATION, 'utf8'));
    const after = (await db.query(`select sha256, created_at from public.consent_notice_text order by language`)).rows;
    assert.deepEqual(after, before);

    await assert.rejects(
      db.query(`update public.consent_notice_text set content = '{}'::jsonb where language = 'en'`), /append-only/);
    await assert.rejects(db.query(`delete from public.consent_notice_text`), /append-only/);
    await assert.rejects(db.query(`truncate public.consent_notice_text`), /append-only/);
    // A caller-supplied hash is overwritten by the trigger, never trusted.
    await db.query(`insert into public.consent_notice_text (version, language, content, sha256)
                    values ('9.9.9', 'en', '{"title":"t"}', repeat('0', 64))`);
    const { rows } = await db.query(`select sha256 from public.consent_notice_text where version = '9.9.9'`);
    assert.equal(rows[0].sha256, createHash('sha256').update('{"title": "t"}', 'utf8').digest('hex'));
    await assert.rejects(db.query(`insert into public.consent_notice_text (version, language, content)
                                   values ('1.2', 'en', '{}')`), /check/);
    await assert.rejects(db.query(`insert into public.consent_notice_text (version, language, content)
                                   values ('1.2.0', 'fr', '{}')`), /check/);
  } finally { await db.close(); }
});

test('authenticated can read and cannot write; anon cannot read', async () => {
  const db = await freshDb();
  try {
    const rls = await db.query(`select relrowsecurity from pg_class where oid = 'public.consent_notice_text'::regclass`);
    assert.equal(rls.rows[0].relrowsecurity, true);

    await db.exec('set role authenticated');
    const { rows } = await db.query(`select count(*)::int as n from public.consent_notice_text`);
    assert.equal(rows[0].n, 2);
    await assert.rejects(db.query(`insert into public.consent_notice_text (version, language, content)
                                   values ('1.2.0', 'en', '{}')`), /permission denied/);
    await assert.rejects(db.query(`update public.consent_notice_text set content = '{}'`), /permission denied/);
    await assert.rejects(db.query(`delete from public.consent_notice_text`), /permission denied/);
    await db.exec('reset role');

    await db.exec('set role anon');
    await assert.rejects(db.query(`select * from public.consent_notice_text`), /permission denied/);
    await db.exec('reset role');

    // The trigger functions pin search_path and are not SECURITY DEFINER.
    const fns = await db.query(`
      select p.proname, p.prosecdef, p.proconfig
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.proname like 'consent_notice_text_%' order by 1`);
    assert.equal(fns.rows.length, 2);
    for (const f of fns.rows) {
      assert.equal(f.prosecdef, false);
      assert.ok(f.proconfig?.some((c) => c.startsWith('search_path=')), `${f.proname} pins search_path`);
    }
  } finally { await db.close(); }
});
