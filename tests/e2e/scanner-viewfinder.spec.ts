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
  // The still was searched afresh and the page found on it with evidence, so
  // geometry is applied; the overlay was a locked page when the shot fired.
  expect(result.lastShot).toMatchObject({ auto: true, hasQuad: true, overlayPhase: 'locked' });
});

test('synthetic empty desk never earns a live lock or Auto capture', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Canvas camera fixture');
  await page.goto('/bench/viewfinder.html?scenario=blank');
  // States publish on change, not per frame: wait for the page finder to be
  // running, then watch the empty desk for several seconds.
  await page.waitForFunction(() => (window as any).__vf?.states.some((s: any) => s.engine === 'ready'), { timeout: 30000 });
  await page.waitForTimeout(5000);
  const result = await page.evaluate(() => {
    const r = (window as any).__vf;
    r.stop();
    return { shots: r.shots, locks: r.states.filter((s: any) => s.hasPage).length, errors: r.errors };
  });
  expect(result).toEqual({ shots: 0, locks: 0, errors: [] });
});

test('the shutter works when nothing can be detected, and the page is kept for adjusting', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Canvas camera fixture');
  await page.goto('/bench/viewfinder.html?scenario=blank&auto=0');
  await page.waitForFunction(() => (window as any).__vf?.live, { timeout: 20000 });
  const shot = await page.evaluate(async () => {
    const r = (window as any).__vf;
    const taken = await r.shoot();
    r.stop();
    return { taken: !!taken, shots: r.shots, hasQuad: r.lastShot?.hasQuad, errors: r.errors };
  });
  // Capture never depends on detection: a photo is taken and stored with no
  // geometry applied (flagged downstream), rather than refused.
  expect(shot).toEqual({ taken: true, shots: 1, hasQuad: false, errors: [] });
});
