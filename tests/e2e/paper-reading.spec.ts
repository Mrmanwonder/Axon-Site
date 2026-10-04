import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["light", "dark"]) {
  test(`approved overview groups source parts and wraps at 360px · ${theme} @a11y`, async ({ page }, info) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/tests/browser/paper-reading.html?theme=${theme}`);
    await expect(page.getByRole("heading", { name: "Marks lost", exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByText("At least 1 mark lost", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Unassigned parts", exact: true })).toBeVisible();
    await expect(page.getByText("For this probability distribution, use the values shown on your paper.", { exact: true })).toHaveCount(1);
    await expect(page.getByText(/Test date not recorded/)).toBeVisible();
    await expect(page.getByText("Subject suggested: Mathematics", { exact: true })).toBeVisible();
    const share = page.getByRole("button", { name: "Share paper", exact: true });
    const dimensions = await share.boundingBox(); expect(dimensions!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`overview-${theme}-360.png`), fullPage: true });
  });
  test(`review separates mark save from question confirmation · ${theme} @a11y`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tests/browser/paper-reading.html?view=review&theme=${theme}`);
    const radio = page.getByRole("radio", { name: "1", exact: true });
    await expect(radio).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await radio.focus(); await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "2", exact: true })).toBeChecked();
    await expect(page.getByRole("button", { name: "Confirm all readings" })).toBeDisabled();
    await page.getByRole("button", { name: "Save teacher’s mark" }).click();
    await expect(page.getByText(/Teacher’s mark saved/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm all readings" })).toBeEnabled();
    await expect(page.getByText("Unsure", { exact: true })).toBeVisible();
    const tile = await page.getByRole("radio", { name: "2", exact: true }).locator("..").boundingBox();
    expect(tile!.height).toBeGreaterThanOrEqual(44); expect(tile!.width).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`review-mark-${theme}-390.png`) });
    await page.getByRole("button", { name: "Confirm all readings" }).click();
    await expect(page.getByText("You confirmed", { exact: true })).toBeVisible();
    await expect(page.getByText("Unsure", { exact: true })).toHaveCount(0);
  });
}

test("saved question provides full source and contained keyboard-scrollable zoom", async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/tests/browser/paper-reading.html?view=question");
  await expect(page.getByRole("heading", { name: "Question 1(a)", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Full saved page", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const frame = page.getByRole("region", { name: /Saved page 1. Use arrow keys/ });
  await frame.focus(); await page.keyboard.press("ArrowDown");
  const geometry = await frame.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, focused: document.activeElement === element }));
  expect(geometry.scroll).toBeGreaterThan(geometry.width); expect(geometry.focused).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("question-source-zoom-360.png") });
});

test("large and unread maximums remain bounded or explicitly unknown", async ({ page }) => {
  await page.goto("/tests/browser/paper-reading.html?view=review&scenario=large");
  await expect(page.getByRole("spinbutton")).toHaveAttribute("max", "40");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("spinbutton").fill("41");
  await expect(page.getByRole("button", { name: "Save teacher’s mark" })).toBeDisabled();
  await page.goto("/tests/browser/paper-reading.html?view=review&scenario=unknown");
  expect(await page.getByRole("spinbutton").getAttribute("max")).toBeNull();
  await expect(page.getByText(/No maximum has been inferred/)).toBeVisible();
});

test("failed mark save retains the chosen draft; 200% reading keeps controls in flow", async ({ page }, info) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/tests/browser/paper-reading.html?view=review&scenario=save-failed&theme=light");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await page.getByRole("radio", { name: "0", exact: true }).check();
  await page.getByRole("button", { name: "Save teacher’s mark" }).click();
  await expect(page.getByRole("alert")).toContainText("Your draft is still here");
  await expect(page.getByRole("radio", { name: "0", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Confirm all readings" })).toBeDisabled();
  const button = await page.getByRole("button", { name: "Cancel mark change" }).boundingBox();
  expect(button!.x).toBeGreaterThanOrEqual(0); expect(button!.x + button!.width).toBeLessThanOrEqual(720);
  await page.screenshot({ path: info.outputPath("failed-save-light-200-percent.png") });
});

test("missing source and completed review remain distinct", async ({ page }) => {
  await page.goto("/tests/browser/paper-reading.html?view=review&scenario=source-missing");
  await page.getByRole("button", { name: "Full saved page", exact: true }).click();
  await expect(page.getByText(/We could not show saved page 1/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try page again" })).toBeVisible();
  await page.goto("/tests/browser/paper-reading.html?view=review&scenario=completed");
  await expect(page.getByText("You confirmed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm all readings" })).toHaveCount(0);
});

for (const width of [768, 1024, 1440]) {
  test(`review reading uses source and fields at ${width}px @a11y`, async ({page}, info) => {
    await page.setViewportSize({width, height: 900});
    await page.goto("/tests/browser/paper-reading.html?view=review&theme=light");
    await expect(page.getByRole("heading", {name: "Question 1(a)", exact: true})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Source on your paper", exact: true})).toBeVisible();
    const clipped = await page.locator(".review-source").evaluate(el => el.scrollHeight > el.clientHeight + 1);
    expect(clipped).toBe(false);
    const source = await page.locator(".source-evidence").boundingBox();
    const fields = await page.locator(".review-fields").boundingBox();
    expect(source).not.toBeNull(); expect(fields).not.toBeNull();
    if (width >= 1024) expect(fields!.x).toBeGreaterThan(source!.x);
    else expect(fields!.y).toBeGreaterThan(source!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    await page.screenshot({path: info.outputPath(`review-source-${width}-light.png`), fullPage: true});
  });
}
