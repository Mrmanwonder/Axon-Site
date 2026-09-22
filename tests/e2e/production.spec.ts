import { test, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:5175';
const student = { id: '10000000-0000-0000-0000-000000000001', first_name: 'Sam', guardian_id: 'guardian', class_level: 11, board: 'CAIE', subjects: ['Physics'] };
const paper = { id: '20000000-0000-0000-0000-000000000001', type: 'unit_test', tier: 'tier_1', date_taken: '2026-09-12', paper_page: [{ count: 1 }], student_attempt: [{ count: 1 }] };
const detail = { ...paper, paper_page: [], page_unreadable: [], question_region: [], student_attempt: [{ id: 'q', question_label: '1', marks_awarded: 2, max_marks: 3, mark_loss_event: [], extraction_confidence: 'confirmed' }] };

test('production shell and a cached paper reopen offline', async ({ page, context, browserName }) => {
  // Playwright only exposes Service Worker control for Chromium. Mobile WebKit
  // remains covered by the rest of the interaction suite.
  test.skip(browserName !== 'chromium', 'Playwright does not support Service Worker testing outside Chromium.');

  await page.goto(origin, { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await page.evaluate(() => {
    const expires = Math.floor(Date.now() / 1000) + 86400;
    const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    localStorage.setItem('sb-dlgcqieyevoebefhcggi-auth-token', JSON.stringify({ access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'guardian', exp: expires, role: 'authenticated' })}.signature`, refresh_token: 'test-only', expires_at: expires, expires_in: 86400, token_type: 'bearer', user: { id: 'guardian', aud: 'authenticated', email: 'test@example.test', app_metadata: {}, user_metadata: {} } }));
    localStorage.setItem('axon.prefs.v1', JSON.stringify({ theme: 'dark', text_size: 'm', reduce_motion: true, always_show_reasoning: false }));
  });

  // Load through the real production readers so this verifies cache population,
  // not just an app boot against hand-inserted IndexedDB records.
  await context.route('https://*.supabase.co/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop();
    const data = table === 'guardian' ? { id: 'guardian', name: 'Parent', contact: 'test@example.test' }
      : table === 'student' ? [student]
      : table === 'student_subject' ? [{ subject: 'Physics' }]
      : table === 'paper' ? (url.searchParams.has('id') ? detail : [paper])
      : table === 'app_preference' ? { theme: 'dark', text_size: 'm', reduce_motion: true }
      : [];
    await route.fulfill({ json: data });
  });
  await page.goto(`${origin}/library`);
  await page.getByRole('button', { name: /Class test/ }).click();
  await expect(page.getByRole('heading', { name: 'Class test' })).toBeVisible();
  await expect(page.getByText(/offline copy/)).toHaveCount(0);
  await context.unrouteAll();

  // Prove the installed worker can answer from the shell cache with the
  // browser network disabled before exercising a fresh application boot.
  await context.setOffline(true);
  const shellAvailable = await page.evaluate(async () => {
    const cacheName = (await caches.keys()).find(name => name.startsWith('axon-shell-'))!;
    const cache = await caches.open(cacheName);
    const urls = (await cache.keys()).map(request => new URL(request.url).pathname);
    const entry = urls.find(path => path.endsWith('.js'))!;
    const scriptResponse = await fetch(entry);
    return { urls, document: urls.includes('/index.html'), script: scriptResponse.ok };
  });
  expect(shellAvailable.document).toBe(true);
  expect(shellAvailable.script).toBe(true);
  expect(shellAvailable.urls).toEqual(expect.arrayContaining(['/index.html', expect.stringMatching(/^\/assets\/.*\.css$/), '/fonts/onest-latin-var.woff2']));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Class test' })).toBeVisible();
  await expect(page.getByText(/offline copy/)).toBeVisible();
});
