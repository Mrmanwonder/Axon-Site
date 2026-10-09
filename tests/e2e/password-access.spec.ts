import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = "/tests/browser/index.html?view=password&styled=1";
test("password sign-in and signup keep accessible controls and generic confirmation @a11y", async ({ page }) => {
  await page.goto(base + "&scenario=password");
  await expect(page.getByRole("heading", { name: "Account access" })).toBeVisible();
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await password.fill("secret123");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(password).toHaveAttribute("autocomplete", "new-password");
  await password.fill("secret123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("confirmation link if one is needed");
  await expect(page.getByRole("heading", { name: "Account opened" })).toHaveCount(0);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
  for (const button of await page.getByRole("button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Sign in instead" }).click();
  await password.fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not complete");
  await password.fill("secret123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account opened" })).toBeVisible();
});
test("forgot password and PASSWORD_RECOVERY route keep reset separate from ordinary sign-in @a11y", async ({ page }) => {
  await page.goto(base + "&scenario=password");
  await page.getByRole("button", { name: "Forgot password" }).click();
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If this email can receive a reset link");
  await page.goto(base + "&scenario=password-recovery");
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("secret123");
  await page.getByLabel("Confirm password", { exact: true }).fill("secret123");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("heading", { name: "Account opened" })).toBeVisible();
});
