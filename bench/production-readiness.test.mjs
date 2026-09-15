import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('public legal and not-found routes are intentional', () => {
  const routes = read('src/ui/app/routes.tsx');
  assert.match(routes, /path: "\/privacy"/);
  assert.match(routes, /path: "\/terms"/);
  assert.match(routes, /path: "\*", element: <NotFound/);
  assert.match(read('src/ui/pages/Privacy.tsx'), /OWNER TO CONFIRM/);
  assert.match(read('src/ui/pages/Terms.tsx'), /OWNER\/LEGAL TO CONFIRM/);
});

test('crawler files expose only canonical public routes', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  assert.match(robots, /Disallow: \//);
  assert.match(robots, /Sitemap: https:\/\//);
  assert.match(sitemap, /\/privacy<\/loc>/);
  assert.match(sitemap, /\/terms<\/loc>/);
  assert.doesNotMatch(sitemap, /library|scan|settings|insights/);
});

test('text-based social, icon and manifest assets are wired and present', () => {
  const html = read('index.html');
  for (const marker of ['og:image', 'twitter:card', 'favicon.svg', 'site.webmanifest']) {
    assert.ok(html.includes(marker), `missing ${marker}`);
  }
  for (const asset of ['public/og-image.svg', 'public/favicon.svg', 'public/site.webmanifest']) {
    assert.ok(existsSync(asset), `missing ${asset}`);
  }
});

test('production host configuration carries transport protections', () => {
  const netlify = read('netlify.toml');
  assert.match(netlify, /Strict-Transport-Security/);
  assert.match(netlify, /Content-Security-Policy/);
  assert.match(netlify, /camera=\(self\)/);
  assert.match(read('src/index.ts'), /url\.protocol !== 'https:'/);
});
