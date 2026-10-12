import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const url = "/tests/browser/index.html?view=onboarding-intro&styled=1";

test("onboarding intro keeps visual hierarchy, one CTA and readable content on real viewport sizes @a11y", async ({ page, browserName }) => {
  await page.goto(url);

  for (const [width, height] of [
    [320, 568], [360, 640], [390, 844], [414, 896], [430, 932], [768, 900], [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    const title = page.getByRole("heading", { name: /See where the marks went/i });
    const action = page.getByRole("button", { name: "Continue", exact: true });
    await expect(title).toBeVisible();
    await expect(action).toBeVisible();
    expect(await page.getByRole("button").count(), `competing action at ${width}×${height}`).toBe(1);

    const g = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        scrollWidth: document.documentElement.scrollWidth,
        brand: box(".ob-intro-brand"),
        title: box(".ob-intro-story h1"),
        copy: box(".ob-intro-story p"),
        scene: box(".ob-intro-scene"),
        paper: box(".ob-intro-paper"),
        insight: box(".ob-intro-insight"),
        action: box(".ob-intro-continue"),
        note: box(".ob-intro-footnote"),
        logoHasOpaqueAsset: document.querySelector(".ob-intro-brand img") !== null,
      };
    });

    const where = `${width}×${height}`;
    expect(g.logoHasOpaqueAsset, `opaque legacy logo at ${where}`).toBe(false);
    expect(g.scrollWidth, `horizontal overflow at ${where}`).toBeLessThanOrEqual(width + 1);
    expect(g.brand.bottom, `headline overlaps brand at ${where}`).toBeLessThan(g.title.top);
    expect(g.title.bottom, `copy overlaps headline at ${where}`).toBeLessThan(g.copy.top);
    expect(g.copy.bottom, `visual overlaps copy at ${where}`).toBeLessThanOrEqual(g.scene.top + 2);
    expect(g.scene.bottom, `visual overlaps action at ${where}`).toBeLessThan(g.action.top);
    expect(g.action.bottom, `consent note overlaps button at ${where}`).toBeLessThan(g.note.top);
    expect(g.action.height, `CTA tap size at ${where}`).toBeGreaterThanOrEqual(44);
    expect(g.action.left, `CTA outside viewport at ${where}`).toBeGreaterThanOrEqual(0);
    expect(g.action.right, `CTA outside viewport at ${where}`).toBeLessThanOrEqual(width + 1);
    expect(g.paper.left, `illustration clipped at ${where}`).toBeGreaterThanOrEqual(0);
    expect(g.insight.right, `insight clipped at ${where}`).toBeLessThanOrEqual(width + 1);
    if (width <= 430) {
      expect(g.scene.height, `oversized visual at ${where}`).toBeLessThanOrEqual(315);
      expect(g.scene.top - g.copy.bottom, `excessive whitespace at ${where}`).toBeLessThanOrEqual(82);
      expect(g.note.bottom, `consent note requires scrolling at ${where}`).toBeLessThanOrEqual(height + 2);
    }

    if (width === 320 || width === 390 || width === 1024) {
      await page.screenshot({ path: `test-results/onboarding-intro-${browserName}-${width}.png`, fullPage: true });
    }
  }

  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your account" })).toBeVisible();
});

test("motion stays optional under reduced-motion preference @a11y", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  const names = await Promise.all([
    ".ob-intro-paper", ".ob-intro-insight", "#obroot.obroot-intro .obview > .ob-intro",
  ].map(selector => page.locator(selector).evaluate(node => getComputedStyle(node).animationName)));
  expect(names).toEqual(["none", "none", "none"]);
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});
