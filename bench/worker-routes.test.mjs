// Issue #301: unknown paths (e.g. /pricing) must not be a 200 soft 404, and
// every path the client router renders must still be served as 200.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const block = source.match(/const APP_ROUTES = \[([\s\S]*?)\n\]/)[1];
const routes = [...block.matchAll(/^\s*(\/.*\/),?$/gm)].map((m) => eval(m[1]));
const isAppRoute = (p) => (/\.[A-Za-z0-9]+$/.test(p) && p !== '/index.html') || routes.some((r) => r.test(p));

test('every client route is a known app route', () => {
  for (const p of ['/', '/index.html', '/privacy', '/terms', '/cookies', '/share', '/design-system', '/library',
    '/library/abc', '/library/abc/q1', '/scan', '/scan/review/abc', '/insights', '/insights/journal',
    '/insights/syllabus/x', '/practice/s1', '/tutor', '/settings', '/assets/index-abc.js']) {
    assert.ok(isAppRoute(p), p);
  }
});

test('unknown paths are not app routes', () => {
  for (const p of ['/pricing', '/scan/review', '/library/a/b/c', '/foo']) assert.equal(isAppRoute(p), false, p);
});

test('the CSP allows the Cloudflare Insights beacon everywhere it is declared', () => {
  for (const f of ['../src/index.ts', '../public/_headers', '../netlify.toml']) {
    const text = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(text, /script-src[^\n]+https:\/\/static\.cloudflareinsights\.com/, f);
    assert.match(text, /connect-src[^\n]+https:\/\/cloudflareinsights\.com/, f);
  }
});
