import { expect, test } from "@playwright/test";

/* Public design reference smoke checks: no login, student or backend fixtures. */
const url = "http://127.0.0.1:5175/design-system";

test("design-system route shows production identity and live tokens", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(url);
  const root = page.locator(".ds-site");
  await expect(root).toBeVisible();
  await expect(page.getByRole("heading", { name: /One language/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Color with intention." })).toHaveCount(1);
  await expect(page.locator(".ds-swatch")).toHaveCount(10);
  await expect(page.locator(".ds-avatar-disc")).toHaveCount(15);
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  const accent = await page.locator(".ds-swatch").first().locator(".ds-swatch-meta .ds-mono").textContent();
  expect(accent?.trim().toLowerCase()).toBe("#2c74e8");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "CBSE", exact: true }).click();
  await expect(page.getByRole("button", { name: "CBSE", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("design-system reference remains usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(url);
  const input = page.getByRole("textbox", { name: "Filter navigation" });
  await input.fill("color");
  await expect(page.getByRole("button", { name: /Colors/ })).toBeVisible();
  await page.getByRole("button", { name: /Colors/ }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Color with intention." })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});


test("design-system previews match app switch and restrained semantic states", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Light", exact: true }).click();

  const confirmed = page.locator(".ds-status-confirmed");
  await expect(confirmed).toHaveCSS("color", "rgb(255, 255, 255)");

  const sw = page.getByRole("switch", { name: "Paper notifications" });
  await expect(sw).toHaveClass(/sw/);
  await expect(sw).toHaveAttribute("aria-checked", "true");
  const dimensions = await sw.boundingBox();
  expect(dimensions?.width).toBe(58);
  expect(dimensions?.height).toBe(26);
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");

  const chip = page.getByRole("button", { name: "In progress", exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  const chipFill = await chip.evaluate(el => getComputedStyle(el).backgroundColor);
  const primaryFill = await page.getByRole("button", { name: "Save changes", exact: true }).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(chipFill).not.toBe(primaryFill);
});


test("B5 Essential uses graphite on light, near-white on dark, and arrows only for navigation", async ({ page }) => {
  await page.goto(url);
  const root = page.locator(".ds-site");
  const nav = page.getByRole("link", { name: "Explore layout" });
  const action = page.getByRole("button", { name: "Save changes" });
  await expect(nav.locator(".essential-button__arrow")).toHaveCount(1);
  await expect(action.locator(".essential-button__arrow")).toHaveCount(0);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(action).toHaveCSS("background-color", "rgb(27, 27, 30)");
  await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(action).toHaveCSS("background-color", "rgb(245, 245, 247)");
  await expect(action).toHaveCSS("color", "rgb(12, 12, 16)");
  await page.getByRole("group", { name: "Essential button size" }).getByRole("button", { name: "44px" }).click();
  await expect(action).toHaveCSS("min-height", "44px");
  await page.getByRole("group", { name: "Essential button state" }).getByRole("button", { name: "loading" }).click();
  await expect(action).toBeDisabled();
  await expect(action).toHaveAttribute("aria-busy", "true");
  await page.getByRole("group", { name: "Essential button state" }).getByRole("button", { name: "disabled" }).click();
  await expect(action).toBeDisabled();
  await expect(action).not.toHaveAttribute("aria-busy", "true");
});

for (const theme of ["Light", "Dark"]) {
  test("B5 loading geometry and long labels in " + theme, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(url);
    await page.getByRole("button", { name: theme, exact: true }).click();
    const action = page.getByRole("button", { name: /Save changes/ });
    const states = page.getByRole("group", { name: "Essential button state" });
    for (const size of ["44px", "52px", "56px"]) {
      await page.getByRole("group", { name: "Essential button size" }).getByRole("button", { name: size }).click();
      await states.getByRole("button", { name: "live", exact: true }).click();
      const before = await action.boundingBox();
      await states.getByRole("button", { name: "loading", exact: true }).click();
      const after = await action.boundingBox();
      expect(after!.width).toBeCloseTo(before!.width, 1);
      expect(after!.height).toBeCloseTo(before!.height, 1);
      await expect(action).toBeDisabled();
      await expect(action).toHaveAccessibleName(/Save changes/);
    }
    await states.getByRole("button", { name: "live", exact: true }).click();
    // Simulates a longer translated label without changing the component styles.
    await action.locator(".essential-button__label").evaluate(node => {
      node.textContent = "Save changes and continue reviewing this paper";
    });
    const long = page.getByRole("button", { name: "Save changes and continue reviewing this paper" });
    expect(await long.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
