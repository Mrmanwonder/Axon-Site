import { expect, test } from "@playwright/test";

test("Home subject pills open real filtered papers", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=home&scenario=insights&styled=1");
  await expect(page.getByText("6 papers", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Library", exact: false })).toBeVisible();
  const chip = page.getByRole("link", { name: "Open physics papers", exact: true });
  await expect(chip).toBeVisible();
  expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await chip.click();
  await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
  await expect(page.getByText("4 papers", { exact: true })).toBeVisible();
  await expect(page.locator(".list .row").filter({ hasText: "Mathematics" })).toHaveCount(0);
});

for (const width of [360, 390, 768, 1024]) {
  for (const view of ["paper", "question"]) {
    test(`long ${view} title stays clear of actions at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/tests/browser/paper-reading.html?view=${view}&scenario=long-subject`);
      const title = page.locator(view === "paper" ? ".detailcopy h1" : ".detailhead .rvtitle");
      await expect(title).toHaveText(/Mathematics - Further/);
      const titleBox = (await title.boundingBox())!;
      for (const name of [`Share ${view}`, `Delete ${view}`]) {
        const action = page.getByRole("button", { name, exact: true });
        const box = (await action.boundingBox())!;
        const overlaps = titleBox.x < box.x + box.width && titleBox.x + titleBox.width > box.x
          && titleBox.y < box.y + box.height && titleBox.y + titleBox.height > box.y;
        expect(overlaps, `${name} must not cover the title`).toBe(false);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`detail-${view}-${width}.png`), fullPage: true });
    });
  }
}

test("animated sheet remains docked through Tab and repeated opening", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/index.html?view=scan-screen&state=dark&theme=dark");
  for (let pass = 0; pass < 2; pass++) {
    await page.getByRole("button", { name: "More", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate(d => {
      const sheet = d.querySelector(".sheet")!.getBoundingClientRect();
      return Math.abs(sheet.bottom - innerHeight);
    })).toBeLessThan(1);
    expect(await dialog.evaluate(d => d.scrollTop)).toBe(0);
    const heading = (await dialog.getByRole("heading").boundingBox())!;
    expect(heading.y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});
