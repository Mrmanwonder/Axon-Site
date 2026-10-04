import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const URL = "/tests/browser/index.html?view=insights&scenario=insights";

test("Insights renders every evidence-backed module from confirmed rows", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText("Mistakes that repeat", { exact: true })).toBeVisible();
  await expect(page.getByText("Before your next paper", { exact: true })).toBeVisible();
  // The student's own most recent fix, quoted, for each repeating cause.
  await expect(page.getByText("Name the law in your first sentence, then apply it to this situation.")).toBeVisible();
  await expect(page.getByText("Where your marks go", { exact: true })).toBeVisible();
  await expect(page.getByText("By question size")).toBeVisible();
  await expect(page.getByText("Command words")).toBeVisible();
  await expect(page.getByText("Topics that keep coming up")).toBeVisible();
  await expect(page.getByText(/2 of 6 papers ended with unanswered questions/)).toBeVisible();
  // Never a percentage on a summary surface.
  expect(await page.locator("body").innerText()).not.toMatch(/\d+\s?%/);
});

test("Insights never reports zero papers while the library is still loading", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole("status", { name: "Loading analysis…" })).toBeVisible();
  await expect(page.getByText(/0 of 4 papers/)).toHaveCount(0);
  await expect(page.getByText("Mistakes that repeat", { exact: true })).toBeVisible();
  await expect(page.getByText(/0 of 4 papers/)).toHaveCount(0);
});

test("a subject filter narrows every module", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText("Mistakes that repeat", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Filter insights by subject" }).click();
  await page.getByRole("option", { name: "Mathematics" }).click();
  await expect(page.getByText("Coverage")).toBeVisible();
  await expect(page.getByText("This filter has 2 confirmed papers.", { exact: false })).toBeVisible();
});

for (const [name, size] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1024, height: 900 }]] as const) {
  test(`Insights layout screenshot · ${name}`, async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "one engine is enough for the visual record");
    await page.setViewportSize(size);
    await page.goto(URL);
    await expect(page.getByText("Mistakes that repeat", { exact: true })).toBeVisible();
    for (const theme of ["dark", "light"]) {
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await page.screenshot({ path: `test-results/insights-${name}-${theme}.png`, fullPage: true });
    }
    // No horizontal scroll at either width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("Insights accessibility @a11y", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText("Mistakes that repeat", { exact: true })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => [v.id, v.nodes.map((n) => n.target.join(" "))])).toEqual([]);
});
