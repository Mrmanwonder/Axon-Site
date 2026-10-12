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
