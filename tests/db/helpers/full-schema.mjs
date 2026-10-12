// The whole database, built from the migrations, in an in-memory Postgres.
//
// Most suites here load one migration against a hand-made shim. The practice
// loop reads across the pipeline's own tables and views (attempt_analytics,
// mark_loss_analytics, topic_evidence, the exam timetable), so its tests run
// against every migration in order instead, on top of supabase/local/shim.sql.
// PGlite lacks two platform pieces the migrations touch: pgcrypto's
// gen_random_bytes (an avatar seed default) and pg_cron's schema. Both are
// stood in for here and nowhere else.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

export async function fullSchema() {
  const db = new PGlite();
  await db.exec(readFileSync(root + 'supabase/local/shim.sql', 'utf8'));
  await db.exec(`
    create or replace function public.gen_random_bytes(n integer) returns bytea language sql volatile as $$
      select decode(substr(repeat(md5(random()::text), (n / 16) + 1), 1, n * 2), 'hex');
    $$;
    create schema if not exists cron;
    create or replace function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
    create or replace function cron.unschedule(a text) returns boolean language sql as $$ select true $$;
  `);
  const files = readdirSync(root + 'supabase/migrations').filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    try {
      await db.exec(readFileSync(root + 'supabase/migrations/' + f, 'utf8'));
    } catch (e) {
      throw new Error(`${f}: ${e.message}`);
    }
  }
  return db;
}
