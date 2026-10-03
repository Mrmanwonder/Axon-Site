import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Fixture QA only. No production, physical-device or camera evidence.
// Chromium is browser proof; WebKit is a labelled Safari proxy.
const origin = "https://design-fixture.test";
const views = ["overview", "review", "table", "math", "unreadable", "completed", "missing", "loading", "failed", "empty"] as const;
const allowed: Record<string, { path: string; contentType: string }> = {
  "/docs/design-preview/index.html": { path: "docs/design-preview/index.html", contentType: "text/html" },
  "/src/ui/styles/tokens.css": { path: "src/ui/styles/tokens.css", contentType: "text/css" },
  "/public/fonts/onest-latin-var.woff2": { path: "public/fonts/onest-latin-var.woff2", contentType: "font/woff2" },
};
test.beforeEach(async ({ page }) => {
  await page.route(origin + "/**", async route => {
    const entry = allowed[new URL(route.request().url()).pathname];
    if (!entry) { await route.fulfill({ status: 404, body: "Fixture resource not found" }); return; }
    await route.fulfill({ body: await readFile(resolve(entry.path)), contentType: entry.contentType });
  });
});
for (const width of [360, 390, 768, 1024, 1440]) {
  for (const theme of ["dark", "light"] as const) {
    test("AXO-134 fixture " + width + "px " + theme + " · all states", async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(origin + "/docs/design-preview/index.html");
      await page.evaluate(async requestedTheme => {
        document.documentElement.dataset.theme = requestedTheme;
        await document.fonts.ready;
      }, theme);
      for (const view of views) {
        await page.locator("#view").selectOption(view);
        await expect(page.locator("#app")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), view + " overflow").toBeLessThanOrEqual(1);
        const undersized = await page.locator("button:visible,select:visible").evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height < 43.5).map(node => node.textContent?.trim()));
        expect(undersized, view + " target heights").toEqual([]);
        if (["overview", "review", "table", "math", "unreadable", "completed"].includes(view)) {
          const filename = view + "-" + width + "-" + theme + ".png";
          const screenshot = await page.screenshot({ path: info.outputPath(filename), fullPage: true });
          await info.attach(filename, { body: screenshot, contentType: "image/png" });
        }
        if ((width === 360 || width === 1440) && ["overview", "review", "table", "math", "unreadable"].includes(view)) {
          const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
test("AXO-134 confirmation, radio keyboard and failed-save draft", async ({ page }) => {
  await page.goto(origin + "/docs/design-preview/index.html#review");
  await page.getByRole("radio", { name: "3", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "2", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "2", exact: true })).toBeFocused();
  await expect(page.locator("#markstatus")).toContainText("Unsaved mark draft: 2 of 3");
  await page.getByRole("button", { name: "Confirm teacher’s mark", exact: true }).click();
  await expect(page.locator("#markstatus")).toContainText("Answer transcription still needs checking");
  await page.getByRole("button", { name: "Fix this transcription", exact: true }).click();
  await page.getByRole("textbox", { name: "Your transcribed working" }).fill("Human-corrected draft with <literal> text");
  await page.getByRole("button", { name: "Save transcription", exact: true }).click();
  await page.getByRole("button", { name: "Show failure", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your transcribed working" })).toHaveValue("Human-corrected draft with <literal> text");
  await page.getByRole("button", { name: "Save transcription", exact: true }).click();
  await page.getByRole("button", { name: "Show success", exact: true }).click();
  await expect(page.locator(".raw")).toHaveText("Human-corrected draft with <literal> text");
  await expect(page.getByText("Review remains incomplete", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Confirm teacher’s mark", exact: true })).toBeEnabled();
});
test("AXO-134 200% CSS zoom proxy · fixture reflow", async ({ page }, info) => {
  // CSS zoom is explicitly a proxy for browser zoom, never a physical device.
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + "/docs/design-preview/index.html#review");
    await page.evaluate(() => { document.body.style.zoom = "2"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), "200% CSS-zoom proxy " + width).toBeLessThanOrEqual(1);
    const image = await page.screenshot({ path: info.outputPath("zoom-proxy-" + width + ".png"), fullPage: true });
    await info.attach("zoom-proxy-" + width + ".png", { body: image, contentType: "image/png" });
  }
});
