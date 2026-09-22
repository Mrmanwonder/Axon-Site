import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('public legal and not-found routes are intentional', () => {
  const routes = read('src/ui/app/routes.tsx');
  assert.match(routes, /path: "\/privacy"/);
  assert.match(routes, /path: "\/terms"/);
  assert.match(routes, /path: "\/cookies"/);
  assert.match(routes, /path: "\*", element: <NotFound/);
  assert.match(read('src/ui/pages/Privacy.tsx'), /support@axonstudy\.online/);
  assert.match(read('src/ui/pages/Terms.tsx'), /hallucinated/);
  assert.match(read('src/ui/pages/Cookies.tsx'), /PostHog/);
});

test('crawler files index public routes without advertising private routes', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  const html = read('index.html');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \/\s/);
  assert.match(robots, /Sitemap: https:\/\//);
  assert.match(html, /name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"/);
  assert.match(sitemap, /\/privacy<\/loc>/);
  assert.match(sitemap, /\/terms<\/loc>/);
  assert.match(sitemap, /\/cookies<\/loc>/);
  assert.doesNotMatch(sitemap, /library|scan|settings|insights/);
});

test('social preview, logo and manifest assets are wired and present', () => {
  const html = read('index.html');
  for (const marker of ['og:image', 'og:image:type', 'twitter:card', 'favicon.png', 'site.webmanifest']) {
    assert.ok(html.includes(marker), `missing ${marker}`);
  }
  assert.match(html, /https:\/\/axonstudy\.online\/axon-lockup-v2\.png/);
  for (const asset of ['public/axon-lockup-v2.png', 'public/favicon.png', 'public/site.webmanifest']) {
    assert.ok(existsSync(asset), `missing ${asset}`);
  }
});

test('production host configuration carries transport protections', () => {
  const netlify = read('netlify.toml');
  const wrangler = read('wrangler.jsonc');
  const cloudflareHeaders = read('public/_headers');
  assert.match(netlify, /Strict-Transport-Security/);
  assert.match(netlify, /Content-Security-Policy/);
  assert.match(netlify, /camera=\(self\)/);
  assert.equal(JSON.parse(wrangler).assets.not_found_handling, 'single-page-application');
  assert.match(cloudflareHeaders, /Permissions-Policy: camera=\(self\)/);
  assert.match(cloudflareHeaders, /script-src[^\n]+https:\/\/us-assets\.i\.posthog\.com/);
  assert.match(cloudflareHeaders, /connect-src[^\n]+https:\/\/us\.i\.posthog\.com/);
  assert.match(cloudflareHeaders, /\/assets\/\*\s+Cache-Control: public, max-age=31556952, immutable/);
  assert.match(read('src/index.ts'), /url\.protocol !== 'https:'/);
});

test('optional PostHog analytics is consent gated', () => {
  const main = read('src/ui/main.tsx');
  const analytics = read('src/ui/lib/analytics.ts');
  const banner = read('src/ui/components/CookieConsent.tsx');
  const settings = read('src/ui/pages/Settings.tsx');
  assert.match(main, /getAnalyticsConsent\(\) === "granted"/);
  assert.match(analytics, /getAnalyticsConsent\(\) !== "granted"/);
  assert.match(analytics, /opt_out_capturing/);
  assert.match(analytics, /state = "idle"/);
  assert.match(analytics, /state = "ready"/);
  assert.match(banner, /Necessary only/);
  assert.match(banner, /Allow analytics/);
  assert.match(settings, /Product analytics/);
});


test('Tavily live-web tools stay server-side and opt-in', () => {
  const tavily = read('supabase/functions/_shared/tavily.ts');
  const modelClient = read('supabase/functions/_shared/openrouter.ts');
  const deploy = read('supabase/DEPLOY.md');
  const envExample = read('.env.example');

  assert.match(tavily, /Deno\.env\.get\('TAVILY_API_KEY'\)/);
  assert.match(tavily, /web_search/);
  assert.match(tavily, /web_extract/);
  assert.match(modelClient, /webTools\?: boolean/);
  assert.match(modelClient, /TAVILY_TOOLS/);
  assert.match(deploy, /TAVILY_API_KEY=tvly-/);
  assert.doesNotMatch(envExample, /VITE_TAVILY|TAVILY_API_KEY/);

  for (const worker of [
    'supabase/functions/w-triage/index.ts',
    'supabase/functions/w-structure/index.ts',
    'supabase/functions/w-content/index.ts',
    'supabase/functions/w-adjudicate/index.ts',
    'supabase/functions/w-explain/index.ts',
  ]) {
    assert.doesNotMatch(read(worker), /webTools:\s*true/, `${worker} must not browse student documents`);
  }
});
