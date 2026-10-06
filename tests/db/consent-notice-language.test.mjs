import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// AXO-210: consent_event records the language the notice was shown in. The
// table is reduced to the columns that matter here, with the real append-only
// triggers, so the migration is proven not to rewrite or update existing rows.
test('consent_event.notice_language defaults to en, accepts hi, refuses anything else, and leaves the ledger append-only', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.consent_event (
        id             uuid        primary key default gen_random_uuid(),
        seq            bigserial   not null unique,
        guardian_id    uuid        not null,
        purpose        text        not null,
        granted        boolean     not null,
        notice_version text        not null,
        created_at     timestamptz not null default clock_timestamp()
      );
      create function public.consent_event_is_append_only() returns trigger language plpgsql as $$
      begin raise exception 'consent_event is append-only: %', tg_op using errcode = '42501'; end; $$;
      create trigger consent_event_no_update before update on public.consent_event
        for each row execute function public.consent_event_is_append_only();
      create trigger consent_event_no_delete before delete on public.consent_event
        for each row execute function public.consent_event_is_append_only();
      insert into public.consent_event (guardian_id, purpose, granted, notice_version)
        values ('00000000-0000-0000-0000-000000000001', 'store_papers', true, '1.0.0');
    `);

    const migration = await readFile(
      new URL('../../supabase/migrations/20261007090000_consent_notice_language.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    // Idempotent: a second apply is a no-op rather than an error.
    await db.exec(migration);

    // A row written before the column existed was shown the English notice.
    const before = await db.query('select notice_language from public.consent_event where seq = 1');
    assert.equal(before.rows[0].notice_language, 'en');

    const insert = (lang) => db.query(
      `insert into public.consent_event (guardian_id, purpose, granted, notice_version, notice_language)
       values ('00000000-0000-0000-0000-000000000001', 'store_papers', true, '1.0.0', $1) returning notice_language`,
      [lang]);
    assert.equal((await insert('hi')).rows[0].notice_language, 'hi');
    assert.equal((await insert('en')).rows[0].notice_language, 'en');
    await assert.rejects(insert('fr'), /consent_event_notice_language_check/);
    await assert.rejects(insert(null), /null value/);

    // Still append-only after the migration.
    await assert.rejects(db.query(`update public.consent_event set notice_language = 'hi' where seq = 1`), /append-only/);
  } finally { await db.close(); }
});
