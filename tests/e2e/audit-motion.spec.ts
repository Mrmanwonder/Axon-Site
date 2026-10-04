import { expect, test } from "@playwright/test";
test("open reasoning remains fully visible after narrow reflow and text enlargement", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.goto("/tests/browser/index.html?view=audit-motion");
  await page.getByRole("button", { name: "Show reasoning" }).click();
  const heightFits = () => page.locator(".disclose").evaluate(el => {
    const panel = el.querySelector(".panel") as HTMLElement;
    const inner = el.querySelector(".inner") as HTMLElement;
    return Math.abs(panel.getBoundingClientRect().height - inner.getBoundingClientRect().height) <= 1;
  });
  await expect.poll(heightFits).toBe(true);
  const initial = await page.locator(".disclose .inner").evaluate(el => el.getBoundingClientRect().height);
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.locator(".disclose .inner").evaluate(el => { (el as HTMLElement).style.fontSize = "200%"; });
  await expect.poll(heightFits).toBe(true);
  expect(await page.locator(".disclose .inner").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(initial);
  await page.getByRole("button", { name: "Show reasoning" }).click();
  await expect.poll(() => page.locator(".disclose .panel").evaluate(el => el.getBoundingClientRect().height)).toBe(0);
});
