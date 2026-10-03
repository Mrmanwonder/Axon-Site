import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// AXO-135 rendering checks on the browser harness fixture (the pictured Class test).
// Browser rendering only: no production data and no physical-device evidence.
const url = "/tests/browser/index.html?view=paper&route=/library/paper-1";

for (const width of [360, 390, 768, 1024, 1440]) {
  for (const theme of ["dark", "light"] as const) {
    test(`paper overview ${width}px ${theme} @a11y`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      // The app cross-fades colours when the theme changes. axe measures whatever colour is on screen at
      // that instant, so wait for the fade to finish or it reads white-on-white halfway through (seen in WebKit).
      await page.evaluate(async (t) => {
        document.documentElement.dataset.theme = t;
        await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
      }, theme);

      await expect(page.getByRole("heading", { level: 1, name: "Test paper" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Question 1" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Unassigned parts" })).toBeVisible();
      await expect(page.getByText("2 questions · 7 parts · 3 parts not placed under a question")).toBeVisible();

      // No horizontal document overflow, and every full part path stays on screen.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      for (const label of ["1(a)(i)", "1(a)(ii)", "1(a)(iii)", "2(a)", "Part c", "Part d", "Part b"]) {
        const box = await page.getByText(label, { exact: true }).first().boundingBox();
        expect(box, label).not.toBeNull();
        expect(box!.x + box!.width, `${label} fits the viewport`).toBeLessThanOrEqual(width + 1);
      }
      // Each part row is a bounded, 44px-or-taller target.
      const rows = await page.locator(".po-part").evaluateAll((n) => n.map((x) => x.getBoundingClientRect().height));
      expect(rows.length).toBe(7);
      for (const h of rows) expect(h).toBeGreaterThanOrEqual(44);

      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      expect(errors).toEqual([]);

      await page.screenshot({ path: info.outputPath(`paper-overview-${width}-${theme}.png`), fullPage: true });
    });
  }
}
