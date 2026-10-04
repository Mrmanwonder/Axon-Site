import { expect, test } from '@playwright/test';

// The real page detector (scanic ML + our self-hosted model) on the repo's
// photographs, in a real browser. What this can and cannot show:
//
//   * "real" rows are real photographs/screenshots from the repo corpus.
//   * "perturbed" rows are those same photos made darker or warmer in code. They
//     are a labelled stress set: they show fragility, they certify nothing about
//     phones.
//   * None of these images has ground-truth corners, so assertions are about
//     plausibility (a page-sized quad exists) and about negatives (none found),
//     not corner accuracy. Corner accuracy needs the R-13 phone corpus.
//
// Chromium only: the harness loads the model through ONNX Runtime Web.

type Result = { status: string; source: string | null; score: number | null; degraded: boolean; error: string | null; ms: number; fill: number };

async function detect(page: import('@playwright/test').Page, name: string, variant = 'base'): Promise<Result> {
  return page.evaluate(([n, v]) => (window as any).__detect(n, v), [name, variant]);
}

test.describe('page detector on repo photographs', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'ONNX Runtime Web harness');

  test.beforeEach(async ({ page }) => {
    await page.goto('/bench/detector.html');
    await page.waitForFunction(() => (window as any).__ready === true);
  });

  for (const name of ['page-angled.jpg', 'page-skew.jpg', 'page-straight.jpg', 'page-tilted.jpg']) {
    test(`real: finds the stored page in ${name} with the ML engine`, async ({ page }) => {
      const r = await detect(page, name);
      expect(r.error).toBeNull();
      expect(r).toMatchObject({ status: 'found', source: 'ml', degraded: false });
      expect(r.score).toBeGreaterThan(0.9);
      expect(r.fill).toBeGreaterThan(0.4);
    });
  }

  for (const name of ['viewfinder-a.jpg', 'viewfinder-b.jpg']) {
    test(`real: finds the page on a phone screenshot ${name} (page small in a cluttered scene)`, async ({ page }) => {
      const r = await detect(page, name);
      expect(r.error).toBeNull();
      expect(r).toMatchObject({ status: 'found', source: 'ml' });
      expect(r.fill).toBeGreaterThan(0.08);
      expect(r.fill).toBeLessThan(0.5);
    });
  }

  test('real negative: a room corner with no page is "none", and classical is not consulted', async ({ page }) => {
    const r = await detect(page, 'page-clean.jpg');
    expect(r).toMatchObject({ status: 'none', source: 'ml', degraded: false });
    expect(r.score).toBeLessThan(0.1);
  });

  for (const variant of ['dim60', 'warm']) {
    test(`perturbed (${variant}, synthetic stress): the phone screenshots are still found`, async ({ page }) => {
      for (const name of ['viewfinder-a.jpg', 'viewfinder-b.jpg']) {
        const r = await detect(page, name, variant);
        expect(r, `${name}/${variant}`).toMatchObject({ status: 'found', source: 'ml' });
      }
    });
  }

  test('inference is fast enough for a live loop on a desktop CPU', async ({ page }) => {
    await detect(page, 'page-angled.jpg'); // warm
    const r = await detect(page, 'page-angled.jpg');
    // Desktop number only. Mid-tier Android is unmeasured until R-7 device trials.
    expect(r.ms).toBeLessThan(250);
  });
});
