import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const origin = 'http://127.0.0.1:5175';
const csp = /Content-Security-Policy = "([^"]+)"/.exec(readFileSync('netlify.toml', 'utf8'))![1];
test.beforeEach(async ({ page }) => {
  await page.route(origin + '/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
});

test('public landing excludes auth and application downloads; Continue boots under CSP', async ({ page }) => {
  const requests: string[] = [];
  const violations: string[] = [];
  page.on('request', r => requests.push(r.url()));
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  await page.goto(origin);
  await expect(page.getByRole('heading', { name: /See where the marks went/ })).toBeVisible();
  expect(requests.filter(u => /Application-|supabase|\/sw\.js|scanic|ort-wasm/.test(u))).toEqual([]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Axon' })).toBeVisible();
  expect(requests.some(u => /Application-/.test(u))).toBe(true);
  expect(violations).toEqual([]);
});

// Each viewport/theme gets its own browser context, timeout and failure trace.
// Six axe audits plus screenshots can exceed one test's budget on mobile WebKit.
for (const width of [320, 768, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`public landing ${theme} at ${width}px @a11y`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin);
      await expect(page.getByRole('heading', { name: /See where the marks went/ })).toBeVisible();
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath(`landing-${theme}-${width}.png`), fullPage: true });
    });
  }
}
