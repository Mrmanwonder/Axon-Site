import { expect, test } from "@playwright/test";
for (const theme of ["dark", "light"]) {
  for (const view of ["home", "insights"]) {
    test(`cached ${view} notice keeps phone gutters in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/tests/browser/index.html?scenario=cached&styled=1&theme=" + theme + "&view=" + view);
      const notice = page.getByText(/^Last available analysis\./);
      await expect(notice).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const geometry = await notice.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, width: innerWidth, className: node.className };
      });
      expect(geometry.className).toContain("subnote");
      expect(geometry.left).toBeGreaterThanOrEqual(20);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width - 20);
      expect(geometry.right).toBeGreaterThan(geometry.left);
    });
  }
}
