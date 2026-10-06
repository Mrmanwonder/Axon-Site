import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The paper overview and question detail as merged with main's 6 Oct design:
// grouped questions, an honest "Added" date, the part a label cannot place
// listed as unassigned, and the full saved page one tap away from the crops.
// Review's mark picker is covered by tests/ui/review-accessibility.test.tsx and
// tests/e2e/resources.spec.ts.

for (const theme of ["light", "dark"]) {
  test(`overview groups parts, keeps unplaced parts honest and fits 360px · ${theme} @a11y`, async ({ page }, info) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/tests/browser/paper-reading.html?theme=${theme}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("heading", { level: 2, name: "Question 1" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Unassigned parts" })).toBeVisible();
    await expect(page.getByText(/marks? lost/).first()).toBeVisible();
    // date_taken is the day the paper was added; it is never shown bare or as an exam date.
    await expect(page.getByText(/^Added \d/)).toBeVisible();
    await expect(page.getByText(/^Dated /)).toHaveCount(0);
    const share = page.getByRole("button", { name: "Share paper", exact: true });
    expect((await share.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`overview-${theme}-360.png`), fullPage: true });
  });
}

test("question detail keeps its crops and opens the full saved page with contained, keyboard-scrollable zoom @a11y", async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/tests/browser/paper-reading.html?view=question");
  await expect(page.getByRole("heading", { name: "Question 1(a)", exact: true })).toBeVisible();
  await expect(page.locator(".qcrop")).toBeVisible();
  await page.getByRole("button", { name: "Inspect the full saved page" }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const frame = page.getByRole("region", { name: /Saved page 1. Use arrow keys/ });
  await frame.focus(); await page.keyboard.press("ArrowDown");
  const geometry = await frame.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, focused: document.activeElement === element }));
  expect(geometry.scroll).toBeGreaterThan(geometry.width); expect(geometry.focused).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("question-source-zoom-360.png") });
  await page.getByRole("button", { name: "Hide the saved page" }).click();
  await expect(frame).toHaveCount(0);
});

test("a saved page that cannot be shown says so and offers a retry, never a substitute", async ({ page }) => {
  await page.goto("/tests/browser/paper-reading.html?view=question&scenario=source-missing");
  await page.getByRole("button", { name: "Inspect the full saved page" }).click();
  await expect(page.getByText(/We could not show saved page 1/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try page again" })).toBeVisible();
});

for (const width of [768, 1024]) {
  test(`question detail fits ${width}px without horizontal scroll @a11y`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/browser/paper-reading.html?view=question&theme=light");
    await expect(page.getByRole("heading", { name: "Question 1(a)", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`question-${width}-light.png`), fullPage: true });
  });
}
