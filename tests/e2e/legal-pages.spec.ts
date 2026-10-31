import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const origin = "http://127.0.0.1:5175";
const pages = [
  { route: "privacy", title: "Privacy Policy" },
  { route: "terms", title: "Terms and Conditions" },
  { route: "cookies", title: "Cookie & Similar Technologies Policy" },
];
const viewports = [
  { width: 320, height: 740 },
  { width: 597, height: 751 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

for (const { route, title } of pages) {
  for (const theme of ["light", "dark"] as const) {
    test(`${route}: Sentient prose, canonical CTA and responsive legal layout (${theme}) @a11y`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const response = await page.goto(`${origin}/${route}/`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await page.evaluate(() => document.fonts.ready);
      const prose = page.locator(".legal-content section p").first();
      await expect(prose).toHaveCSS("font-family", /^Sentient, Georgia, "?Times New Roman"?, serif$/);
      await expect(prose).toHaveCSS("font-size", "16px");
      expect(await prose.evaluate(el => parseFloat(getComputedStyle(el).lineHeight))).toBeCloseTo(27.2, 2);
      expect(await page.evaluate(() => [...document.fonts].some(font => font.family === "Sentient" && font.status === "loaded"))).toBe(true);
      await expect(page.locator(".legal-content h1")).toHaveCSS("font-family", /Onest/);
      await expect(page.locator(".updated")).toHaveCSS("font-family", /Onest/);

      const cta = page.getByRole("link", { name: "Open Axon", exact: true });
      await expect(cta).toHaveClass("essential-button essential-button--primary essential-button--medium");
      await expect(cta).toHaveAttribute("href", "/");
      await expect(cta.locator(".essential-button__arrow")).toHaveAttribute("aria-hidden", "true");
      await expect(cta).toHaveCSS("min-height", "52px");
      await expect(cta).toHaveCSS("border-radius", "16px");

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        const overflow = await page.locator(".public-page").evaluate(root => {
          const width = document.documentElement.clientWidth;
          return [...root.querySelectorAll("header, main, footer, h1, h2, h3, p, li, a")]
            .filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && (rect.left < -1 || rect.right > width + 1);
            }).map(el => el.tagName + ": " + el.textContent?.slice(0, 60));
        });
        expect(overflow, `${route} at ${viewport.width}x${viewport.height}`).toEqual([]);
      }

      // CSS zoom exercises 200% reflow at an effective 320px reading width.
      await page.setViewportSize({ width: 640, height: 740 });
      const zoom = await page.addStyleTag({ content: ".public-page { zoom: 2; }" });
      await expect(cta).toBeVisible();
      expect(await page.locator(".public-page").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      await zoom.evaluate(el => el.remove());
      await page.setViewportSize({ width: 320, height: 740 });
      await cta.focus();
      await expect(cta).toBeFocused();
      await expect(cta).toHaveCSS("outline-style", "solid");
      expect((await new AxeBuilder({ page }).include(".public-page").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
      await cta.press("Enter");
      await expect(page).toHaveURL(`${origin}/`);
      expect(errors).toEqual([]);
    });
  }
}

test("legal routes remain navigable when Sentient cannot load", async ({ page }) => {
  await page.route("**/fonts/sentient-*.woff2", route => route.abort());
  await page.goto(`${origin}/privacy/`);
  for (const { route, title } of pages) {
    await page.locator(`.public-footer a[href='/${route}']`).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator(".legal-content section p").first()).toBeVisible();
    await expect(page.locator(".legal-content section p").first()).toHaveCSS("font-family", /Georgia/);
  }
});
