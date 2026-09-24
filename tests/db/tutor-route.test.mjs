import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('tutor model routing is explicit and training stays disabled', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table public.model_call (
        id bigserial primary key,
        stage text not null constraint model_call_stage_check
          check (stage in ('triage','structure','content','adjudicate','explain')),
        ok boolean not null default true,
        error_code text,
        attempt integer not null default 1 constraint model_call_attempt_check check (attempt >= 1),
        constraint failed_calls_carry_a_code check (ok or error_code is not null)
      );
      create table public.model_route (
        stage text primary key constraint model_route_stage_check
          check (stage in ('triage','structure','content','adjudicate','explain')),
        primary_model text not null,
        fallbacks text[] not null default '{}',
        temperature real not null default 0 constraint model_route_temperature_check check (temperature between 0 and 2),
        max_tokens integer not null default 4096 constraint model_route_max_tokens_check check (max_tokens > 0),
        prompt_version text not null,
        allow_training boolean not null default false,
        enabled boolean not null default true,
        notes text
      );
    `);
    await db.exec(await readFile(new URL('../../supabase/migrations/20260923152617_add_tutor_model_route.sql', import.meta.url), 'utf8'));
    const result = await db.query("select primary_model, allow_training, enabled from public.model_route where stage = 'tutor'");
    assert.deepEqual(result.rows, [{ primary_model: 'gemini-3.5-flash-lite', allow_training: false, enabled: true }]);
    await db.exec("insert into public.model_call(stage) values ('tutor')");
    await assert.rejects(db.exec("insert into public.model_call(stage) values ('unknown')"));
  } finally {
    await db.close();
  }
});
