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
  expect(accent?.trim()).toBe("#2C74E8");
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
  const primaryFill = await page.locator(".ds-demo-primary").evaluate(el => getComputedStyle(el).backgroundColor);
  expect(chipFill).not.toBe(primaryFill);
});
