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
        notes text,
        updated_at timestamptz not null default now()
      );
    `);
    await db.exec(await readFile(new URL('../../supabase/migrations/20260923152617_add_tutor_model_route.sql', import.meta.url), 'utf8'));
    await db.exec(`
      insert into public.model_route(stage, primary_model, prompt_version, allow_training)
      values
        ('triage', 'gemini-3.1-flash-lite', 'triage.v1', true),
        ('structure', 'gemini-3.1-flash-lite', 'structure.v1', true),
        ('content', 'gemini-3.1-flash-lite', 'content.v2', true),
        ('adjudicate', 'gemini-3.1-flash-lite', 'adjudicate.v1', true),
        ('explain', 'gemini-3.1-flash-lite', 'explain_tier1.v2', true);
    `);
    await db.exec(await readFile(new URL('../../supabase/migrations/20260924111500_intelligence_v2_model_routes.sql', import.meta.url), 'utf8'));
    const result = await db.query("select stage, primary_model, thinking_level, allow_training, prompt_version from public.model_route order by stage");
    assert.equal(result.rows.length, 6);
    assert.ok(result.rows.every((row) => row.primary_model === 'gemini-3.5-flash-lite'));
    assert.ok(result.rows.every((row) => row.allow_training === false));
    assert.deepEqual(
      Object.fromEntries(result.rows.map((row) => [row.stage, row.thinking_level])),
      { adjudicate: 'high', content: 'medium', explain: 'medium', structure: 'low', triage: 'minimal', tutor: 'medium' },
    );
    assert.equal(result.rows.find((row) => row.stage === 'explain').prompt_version, 'paper_feedback.v2');
    await db.exec("insert into public.model_call(stage) values ('tutor')");
    await assert.rejects(db.exec("insert into public.model_call(stage) values ('unknown')"));
  } finally {
    await db.close();
  }
});
