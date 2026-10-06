import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('Library stays outside crawler-visible surfaces', () => {
  const sitemap = read('public/sitemap.xml');
  const worker = read('src/index.ts');

  assert.doesNotMatch(sitemap, /\/library(?:<|\/)/i);
  assert.match(
    worker,
    /Content-Type[^\n]+text\/html[\s\S]*?pathname !== '\/'[\s\S]*?X-Robots-Tag', 'noindex, nofollow'/,
  );
});

test('private Library search returns only non-content metadata', () => {
  const migration = read('supabase/migrations/20260927062924_library_search_semantics.sql');
  const start = migration.indexOf('create or replace function public.search_library(');
  assert.ok(start >= 0, 'search_library definition missing');

  const returnsStart = migration.indexOf('returns table (', start);
  const returnsEnd = migration.indexOf(')\nlanguage sql', returnsStart);
  assert.ok(returnsStart >= 0 && returnsEnd > returnsStart, 'search_library return table signature missing');

  const signature = migration.slice(returnsStart, returnsEnd);
  for (const column of [
    'paper_id uuid',
    'rank real',
    'match_kind text',
    'subject_state text',
    'suggested_subject text',
    'suggested_confidence text',
  ]) {
    assert.ok(signature.includes(column), `missing safe return field: ${column}`);
  }

  for (const forbidden of [
    'student_answer',
    'question_text',
    'answer_text',
    'raw_text',
    'search_vector',
  ]) {
    assert.doesNotMatch(signature, new RegExp(forbidden, 'i'));
  }
});

test('Library search UI carries explicit PostHog no-capture boundary', () => {
  const library = read('src/ui/pages/Library.tsx');
  const analytics = read('src/ui/lib/analytics.ts');

  assert.match(library, /searchwrap ph-no-capture/);
  assert.match(library, /data-private-academic-search="true"/);
  assert.match(analytics, /before_send:\s*filterSensitiveAnalyticsEvent/);
  assert.match(analytics, /PRIVATE_LIBRARY_AUTOCAPTURE_EVENTS/);
  assert.match(analytics, /path === "\/library"/);
});
