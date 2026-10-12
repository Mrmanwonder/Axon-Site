import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
// Actual shared renderers, synthetic layout fixtures; no OCR/device fidelity claim.
for (const width of [320, 390, 768, 1440]) for (const theme of ["light", "dark"]) {
  test("academic overflow " + width + "px " + theme, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/tests/browser/academic.html?theme=" + theme);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".katex").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("region", { name: "Short expression", exact: true }).locator(".math-rendered")).not.toHaveAttribute("tabindex", "0");
    const table = page.getByRole("region", { name: "Probability distribution", exact: true }).getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByRole("rowheader", { name: "P", exact: true })).toBeVisible();
    await expect(table.locator("tbody tr").nth(1).locator("td")).toHaveCount(4);
    for (const name of ["Inline working", "Display working", "Wide inline fraction"]) {
      const formula = page.getByRole("region", { name, exact: true }).locator(".math-rendered");
      const overflowing = await formula.evaluate(node => node.scrollWidth > node.clientWidth + 1);
      if (name === "Wide inline fraction" && width <= 390) expect(overflowing).toBe(true);
      if (overflowing) {
        await expect(formula).toHaveAttribute("tabindex", "0");
        await formula.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => formula.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
      }
      expect(await formula.locator("annotation").textContent()).toContain("32460");
    }
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: info.outputPath("math-academic-" + width + "-" + theme + ".png"), fullPage: true });
    // Resizing must remove keyboard stops from expressions that now fit.
    await page.setViewportSize({ width: 1800, height: 1000 });
    const inline = page.getByRole("region", { name: "Inline working", exact: true }).locator(".math-rendered");
    if (await inline.evaluate(node => node.scrollWidth <= node.clientWidth + 1)) await expect(inline).not.toHaveAttribute("tabindex", "0");
  });
}
