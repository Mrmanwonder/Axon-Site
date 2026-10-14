import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

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
        sheets: [...document.querySelectorAll<HTMLElement>(".ob-loop-sheet")].map((el) => {
          const r = el.getBoundingClientRect(); return { left: r.left, right: r.right };
        }),
        read: box(".ob-loop-read"),
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
    if (width < 800) {
      expect(g.copy.bottom, `visual overlaps copy at ${where}`).toBeLessThanOrEqual(g.scene.top + 2);
      expect(g.scene.bottom, `visual overlaps action at ${where}`).toBeLessThan(g.action.top);
    } else {
      expect(g.copy.right, `desktop visual overlaps text at ${where}`).toBeLessThan(g.scene.left + 4);
      expect(g.action.right, `desktop CTA overlaps visual at ${where}`).toBeLessThan(g.scene.left + 4);
    }
    expect(g.action.bottom, `consent note overlaps button at ${where}`).toBeLessThan(g.note.top);
    expect(g.action.height, `CTA tap size at ${where}`).toBeGreaterThanOrEqual(44);
    expect(g.action.left, `CTA outside viewport at ${where}`).toBeGreaterThanOrEqual(0);
    expect(g.action.right, `CTA outside viewport at ${where}`).toBeLessThanOrEqual(width + 1);
    expect(g.sheets.length, `paper stack at ${where}`).toBe(5);
    for (const sheet of g.sheets) {
      expect(sheet.left, `paper clipped at ${where}`).toBeGreaterThanOrEqual(0);
      expect(sheet.right, `paper clipped at ${where}`).toBeLessThanOrEqual(width + 1);
    }
    const overlapsAction = g.read.left < g.action.right && g.read.right > g.action.left
      && g.read.top < g.action.bottom && g.read.bottom > g.action.top;
    expect(overlapsAction, `read mark overlaps action at ${where}`).toBe(false);
    if (width <= 430) {
      expect(g.scene.height, `oversized visual at ${where}`).toBeLessThanOrEqual(315);
      expect(g.scene.top - g.copy.bottom, `excessive whitespace at ${where}`).toBeLessThanOrEqual(120);
      expect(g.note.bottom, `consent note requires scrolling at ${where}`).toBeLessThanOrEqual(height + 2);
    }

    if (width === 320 || width === 390 || width === 1024) {
      /* WebKit once captured an entirely blank intro at the first frame while
         the DOM was visible. Assert real pixels, not just DOM geometry. */
      await page.evaluate(() => new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      const pixels = await page.screenshot({
        path: `test-results/onboarding-intro-${browserName}-${width}.png`,
        fullPage: true, animations: "disabled",
      });
      const { channels } = await sharp(pixels).stats();
      expect(
        Math.max(...channels.slice(0, 3).map(channel => channel.stdev)),
        `blank rendered screenshot at ${where} on ${browserName}`,
      ).toBeGreaterThan(5);
    }
  }

  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your account" })).toBeVisible();
});

test("the paper stack loops with transform and opacity only", async ({ page }) => {
  await page.goto(url);
  const sheets = page.locator(".ob-loop-sheet");
  await expect(sheets).toHaveCount(5);
  // Every sheet and the read mark run the shared loop, on one infinite cycle.
  const running = await page.evaluate(() => [...document.querySelectorAll(".ob-loop-sheet, .ob-loop-read")]
    .map((el) => { const cs = getComputedStyle(el); return [cs.animationName, cs.animationIterationCount, cs.animationDuration].join(" "); }));
  expect(new Set(running.map((r) => r.split(" ").slice(1).join(" ")))).toEqual(new Set(["infinite 7s"]));
  // Only compositor properties are keyframed (no layout, no filters).
  const animated = await page.evaluate(() => {
    const props = new Set<string>();
    for (const el of document.querySelectorAll(".ob-loop-sheet, .ob-loop-read")) {
      for (const a of el.getAnimations()) for (const k of (a.effect as KeyframeEffect).getKeyframes()) {
        for (const p of Object.keys(k)) if (!["offset", "computedOffset", "easing", "composite"].includes(p)) props.add(p);
      }
    }
    return [...props].sort();
  });
  expect(animated).toEqual(["opacity", "transform"]);
  // The stack changes over the cycle: it is not a still image.
  const at = async () => sheets.first().evaluate((el) => getComputedStyle(el).opacity);
  const first = await at();
  await page.waitForTimeout(3600);
  expect(await at()).not.toBe(first);
});

test("motion stays optional under reduced-motion preference @a11y", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  await expect(page.locator(".ob-loop-sheet")).toHaveCount(5);
  const names = await page.evaluate(() => [...document.querySelectorAll(
    ".ob-loop-sheet, .ob-loop-read, #obroot.obroot-intro .obview > .ob-intro",
  )].map((node) => getComputedStyle(node).animationName));
  expect(names).toHaveLength(7);
  expect(new Set(names)).toEqual(new Set(["none"]));
  // The still frame is the settled stack, fully visible, with the read mark.
  const opacities = await page.locator(".ob-loop-sheet, .ob-loop-read")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  expect(new Set(opacities)).toEqual(new Set(["1"]));
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});
