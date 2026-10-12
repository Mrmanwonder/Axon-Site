import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Controls sit on the design system's gutter (tokens.css: clamp(14px, 4vw, 18px)),
// which is 14 px at 320 wide and 15.6 px at 390, so a fixed 16 px floor is wrong.
const gutter = async (page: Page) => (await page.evaluate(() =>
  parseFloat(getComputedStyle(document.querySelector("#obroot")!).getPropertyValue("--gutter")) || 14)) - 0.5;

for (const theme of ["dark", "light"]) {
  for (const { width, height } of [{ width: 320, height: 700 }, { width: 390, height: 700 }, { width: 768, height: 700 }, { width: 1024, height: 900 }, { width: 844, height: 390 }]) {
    test(`onboarding account controls fit in ${theme} mode at ${width}x${height} @a11y`, async ({ page }, testInfo) => {
      // Several screens and accessibility scans in one flow; WebKit needs more than the default 30 s.
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height });
      await page.goto(`/tests/browser/index.html?view=onboarding&scenario=password&styled=1&theme=${theme}`);
      await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`onboarding-welcome-${theme}-${width}.png`) });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("button", { name: "Continue with email or phone" }).click();
      await expect(page.getByRole("heading", { name: "Continue with a code" })).toBeVisible();
      await page.getByRole("button", { name: "Sign in with a password instead" }).click();
      await expect(page.getByRole("heading", { name: "Sign in with a password" })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const bounds = await page.locator(".password-access").boundingBox();
      const g = await gutter(page);
      expect(bounds!.x).toBeGreaterThanOrEqual(g);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - g);
      await page.getByLabel("Email", { exact: true }).fill("parent@example.test");
      await page.getByLabel("Password", { exact: true }).fill("wrong-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("could not complete");
      await page.screenshot({ path: testInfo.outputPath(`onboarding-password-${theme}-${width}.png`) });
      await page.getByRole("button", { name: "Forgot password", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.locator(".password-access").getByRole("status")).toContainText("If this email");
      expect(await page.locator(".obview").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`onboarding-reset-${theme}-${width}.png`) });
      await page.getByRole("button", { name: "Create an account", exact: true }).click();
      await page.getByLabel("Password", { exact: true }).fill("CorrectPassword9");
      await page.getByRole("button", { name: "Create account", exact: true }).click();
      const confirmation = page.locator(".password-access").getByRole("status");
      await expect(confirmation).toContainText("Check your email for a confirmation link");
      await confirmation.scrollIntoViewIfNeeded();
      const confirmationBounds = await confirmation.boundingBox();
      expect(confirmationBounds!.x).toBeGreaterThanOrEqual(g);
      expect(confirmationBounds!.x + confirmationBounds!.width).toBeLessThanOrEqual(width - g);
      expect(await page.locator(".obview").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`onboarding-signup-${theme}-${width}.png`) });
      await page.getByRole("button", { name: "Use a sign-in code instead" }).click();
      await expect(page.getByLabel("Your name")).toBeVisible();
      await expect(page.getByLabel("Email or phone", { exact: true })).toBeVisible();
    });
  }
}
