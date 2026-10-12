import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// The email-first account step asks the database whether an address is new, has
// a password, or signs in with a code. It must answer with one word, never leak
// more, never accept a malformed address, and stop answering a caller who asks
// too often.
test('account_lookup answers new, password or code, validates input and throttles a caller', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema private;
      create table auth.users (
        id uuid primary key default gen_random_uuid(),
        email text, encrypted_password text, deleted_at timestamptz
      );
      insert into auth.users (email, encrypted_password) values
        ('has.password@example.test', '$2a$10$abcdefghijklmnopqrstuv'),
        ('google.only@example.test', ''),
        ('null.password@example.test', null);
      insert into auth.users (email, encrypted_password, deleted_at)
        values ('gone@example.test', '$2a$10$abcdefghijklmnopqrstuv', now());
    `);
    const migration = await readFile(
      new URL('../../supabase/migrations/20261012090000_account_lookup.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration); // idempotent

    const ask = async (email, client = 'caller-a') =>
      (await db.query('select public.account_lookup($1, $2) as r', [email, client])).rows[0].r;

    assert.equal(await ask('has.password@example.test'), 'password');
    assert.equal(await ask('  HAS.Password@Example.test '), 'password');
    assert.equal(await ask('google.only@example.test'), 'code');
    assert.equal(await ask('null.password@example.test'), 'code');
    assert.equal(await ask('nobody@example.test'), 'new');
    assert.equal(await ask('gone@example.test'), 'new', 'a deleted account is not an account');
    assert.equal(await ask('not an email'), 'invalid');
    assert.equal(await ask(''), 'invalid');
    assert.equal(await ask(null), 'invalid');

    // Only the service role may call it; the browser can never reach it.
    const grants = await db.query(`
      select r.rolname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      cross join pg_roles r
      where n.nspname = 'public' and p.proname = 'account_lookup'
        and r.rolname in ('anon', 'authenticated', 'service_role')
        and has_function_privilege(r.rolname, p.oid, 'execute')`);
    assert.deepEqual(grants.rows.map(r => r.rolname), ['service_role']);

    // 30 lookups per caller in ten minutes, then 'throttled'; others unaffected.
    // (Seven were spent above on valid addresses.)
    let last;
    for (let i = 0; i < 40; i++) last = await ask('nobody@example.test', 'caller-b');
    assert.equal(last, 'throttled');
    assert.equal(await ask('nobody@example.test', 'caller-c'), 'new');
    const rows = await db.query(`select count(*)::int as n from private.account_lookup_hit where client_hash = 'caller-b'`);
    assert.equal(rows.rows[0].n, 30);
  } finally { await db.close(); }
});

// The browser's one-hop path. The caller is the address the gateway saw, hashed
// with a salt the browser can never read; nothing but the one word comes back.
test('account_lookup_public answers one word, keys the throttle on the gateway address, and is callable by the browser', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema private;
      create table auth.users (
        id uuid primary key default gen_random_uuid(),
        email text, encrypted_password text, deleted_at timestamptz
      );
      insert into auth.users (email, encrypted_password) values
        ('has.password@example.test', '$2a$10$abcdefghijklmnopqrstuv'),
        ('google.only@example.test', '');
    `);
    for (const file of ['20261012090000_account_lookup.sql', '20261012160000_account_lookup_direct.sql']) {
      const sql = await readFile(new URL('../../supabase/migrations/' + file, import.meta.url), 'utf8');
      await db.exec(sql);
      await db.exec(sql); // idempotent
    }
    const ask = async (email, ip) => {
      await db.exec(`select set_config('request.headers', '${JSON.stringify(ip ? { 'cf-connecting-ip': ip } : {}).replace(/'/g, "''")}', false)`);
      return (await db.query('select public.account_lookup_public($1) as r', [email])).rows[0].r;
    };
    assert.equal(await ask('has.password@example.test', '203.0.113.1'), 'password');
    assert.equal(await ask('  GOOGLE.only@Example.test ', '203.0.113.1'), 'code');
    assert.equal(await ask('nobody@example.test', '203.0.113.1'), 'new');
    assert.equal(await ask('not an email', '203.0.113.1'), 'invalid');
    assert.equal(await ask('', '203.0.113.1'), 'invalid');

    const grants = await db.query(`
      select r.rolname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      cross join pg_roles r
      where n.nspname = 'public' and p.proname = 'account_lookup_public'
        and r.rolname in ('anon', 'authenticated', 'service_role')
        and has_function_privilege(r.rolname, p.oid, 'execute')
      order by r.rolname`);
    assert.deepEqual(grants.rows.map(r => r.rolname), ['anon', 'authenticated']);

    // 120 per address in ten minutes, then 'throttled'; another address is unaffected.
    let last;
    for (let i = 0; i < 130; i++) last = await ask('nobody@example.test', '203.0.113.9');
    assert.equal(last, 'throttled');
    assert.equal(await ask('nobody@example.test', '203.0.113.10'), 'new');

    // No raw address is ever stored, and the browser's roles cannot read the salt.
    const stored = await db.query(`select client_hash from private.account_lookup_hit where client_hash like 'ip:%' limit 5`);
    for (const row of stored.rows) assert.match(row.client_hash, /^ip:[0-9a-f]{64}$/);
    const salt = await db.query(`
      select has_table_privilege('anon', 'private.account_lookup_salt', 'select') as anon,
             has_table_privilege('authenticated', 'private.account_lookup_salt', 'select') as auth`);
    assert.deepEqual(salt.rows[0], { anon: false, auth: false });
  } finally { await db.close(); }
});
