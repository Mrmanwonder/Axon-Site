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

test("the syllabus radar shades tested units, leaves untested ones empty, and opens the syllabus in detail", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText("Syllabus map", { exact: true })).toBeVisible();
  await expect(page.getByText("3 of 5 units tested")).toBeVisible();
  // An untested unit is a button that says so; it is never drawn with a value.
  await expect(page.getByRole("button", { name: /^2 Waves: Not tested yet/ })).toBeVisible();
  // One filled shape through the three tested units; none for the two untested ones.
  await expect(page.locator(".radar .rarea")).toHaveCount(1);
  await expect(page.locator(".radar .rpoint")).toHaveCount(3);
  await page.getByRole("button", { name: /^1 Forces and motion: \d+ of \d+ marks lost/ }).click();
  await expect(page.locator(".radarpick")).toContainText("Forces and motion");
  await page.getByRole("link", { name: "In detail" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Physics" })).toBeVisible();
  const untested = page.getByRole("link", { name: /1\.4 Circular motion: not tested yet/ });
  await expect(untested).toHaveClass(/untested/);
  await expect(page.getByRole("link", { name: /1\.3 Energy transfers: \d+ of \d+ marks lost/ })).toHaveClass(/ l[0-4]/);
  await expect(page.getByText("describe example energy stores")).toBeVisible();
  await expect(page.getByText("Your questions on this topic").first()).toBeVisible();
  await expect(page.getByText("Untested is not the same as weak.", { exact: false }).first()).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/\d+\s?%/);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => [v.id, v.nodes.map((n) => n.target.join(" "))])).toEqual([]);
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

test("below four papers: one coverage card with steps and the next action, and the map of tested topics", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=insights&scenario=insights-early");
  await expect(page.getByRole("img", { name: "3 of 4 papers counted" })).toBeVisible();
  await expect(page.getByText("One more marked paper and Axon starts comparing them.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan a marked paper" })).toBeVisible();
  await expect(page.getByText("Marks lost by unit appear at 4 Physics papers (2 so far).", { exact: false })).toBeVisible();
  // Below the threshold the web marks tested units on the rim and draws no values.
  await expect(page.locator(".radar .rtested")).toHaveCount(3);
  await expect(page.locator(".radar .rpoint")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toMatch(/\d+\s?%/);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => [v.id, v.nodes.map((n) => n.target.join(" "))])).toEqual([]);
});
