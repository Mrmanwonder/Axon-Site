import { expect, test } from '@playwright/test';

// Canvas-stream integration exercises the real detector/worker/controller.
// It is deliberately not evidence about real Android/iPhone camera drivers.
test('synthetic held page acquires live and Auto captures verified pixels', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Canvas camera fixture; WebKit hardware-independent lifecycle tests run separately');
  await page.goto('/bench/viewfinder.html?shake=2');
  await page.waitForFunction(() => (window as any).__vf?.shots > 0, { timeout: 20000 });
  const result = await page.evaluate(() => {
    const r = (window as any).__vf;
    r.stop();
    return { live: r.live, firstLockMs: r.firstLockMs, firstShotMs: r.firstShotMs, lastShot: r.lastShot, states: r.states, errors: r.errors };
  });
  expect(result.errors).toEqual([]);
  expect(result.live).toBe(true);
  expect(result.firstLockMs).toBeGreaterThanOrEqual(0);
  expect(result.states.some((state: any) => state.hasPage)).toBe(true);
  expect(result.states.every((state: any) => !state.videoTransform || state.videoTransform === 'none')).toBe(true);
  expect(result.lastShot).toMatchObject({ auto: true, hasQuad: true, overlayPhase: 'captured-confirm' });
});

test('synthetic empty desk never earns a live lock or Auto capture', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Canvas camera fixture');
  await page.goto('/bench/viewfinder.html?scenario=blank');
  await page.waitForFunction(() => (window as any).__vf?.states.length >= 8, { timeout: 20000 });
  const result = await page.evaluate(() => {
    const r = (window as any).__vf;
    r.stop();
    return { shots: r.shots, locks: r.states.filter((s: any) => s.hasPage).length, errors: r.errors };
  });
  expect(result).toEqual({ shots: 0, locks: 0, errors: [] });
});
