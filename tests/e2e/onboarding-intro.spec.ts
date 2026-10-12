import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const url = "/tests/browser/index.html?view=onboarding-intro&styled=1";

test("intro remains readable and its only action stays in bounds from phones to desktop @a11y", async ({ page, browserName }) => {
  await page.goto(url);
  for (const [width, height] of [
    [320, 568], [360, 720], [390, 844], [414, 896], [768, 900], [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    const title = page.getByRole("heading", { name: /See where the marks went/i });
    const continueButton = page.getByRole("button", { name: "Continue", exact: true });
    await expect(title).toBeVisible();
    await expect(continueButton).toBeVisible();
    expect(await page.getByRole("button").count(), `extra action at ${width}px`).toBe(1);
    const g = await page.evaluate(() => {
      const button = document.querySelector(".ob-intro-continue")!.getBoundingClientRect();
      const title = document.querySelector(".ob-intro-story h1")!.getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        button: { left: button.left, right: button.right, height: button.height },
        title: { left: title.left, right: title.right },
      };
    });
    expect(g.pageWidth, `document overflow at ${width}px`).toBeLessThanOrEqual(g.viewport);
    expect(g.button.left, `button left at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(g.button.right, `button right at ${width}px`).toBeLessThanOrEqual(g.viewport + 1);
    expect(g.button.height).toBeGreaterThanOrEqual(44);
    expect(g.title.left).toBeGreaterThanOrEqual(0);
    expect(g.title.right).toBeLessThanOrEqual(g.viewport + 1);
    if (width === 390 || width === 1024) {
      await page.screenshot({ path: `test-results/onboarding-intro-${browserName}-${width}.png`, fullPage: true });
    }
  }

  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your account" })).toBeVisible();
});

test("intro uses a still horizon when the OS requests reduced motion @a11y", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  const names = await Promise.all([".ob-intro-atmosphere", ".ob-intro-horizon", ".ob-intro-light"].map(selector =>
    page.locator(selector).evaluate(element => getComputedStyle(element).animationName)));
  expect(names).toEqual(["none", "none", "none"]);
});
