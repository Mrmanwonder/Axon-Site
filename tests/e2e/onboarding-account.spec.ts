import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["dark", "light"]) {
  for (const { width, height } of [{ width: 320, height: 700 }, { width: 390, height: 700 }, { width: 768, height: 700 }, { width: 1024, height: 900 }, { width: 844, height: 390 }]) {
    test(`onboarding account controls fit in ${theme} mode at ${width}x${height} @a11y`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.goto(`/tests/browser/index.html?view=onboarding&scenario=password&styled=1&theme=${theme}`);
      await expect(page.getByRole("heading", { name: "Understand your marked paper." })).toBeVisible();
      await expect(page.getByRole("list", { name: "How Axon works" }).getByRole("listitem")).toHaveCount(3);
      await page.screenshot({ path: testInfo.outputPath(`onboarding-welcome-${theme}-${width}.png`) });
      await page.getByRole("button", { name: /a parent/ }).click();
      const methods = page.getByRole("group", { name: "Account sign-in method" });
      const code = methods.getByRole("button", { name: "Email or phone code" });
      const password = methods.getByRole("button", { name: "Email and password" });
      await expect(code).toHaveAttribute("aria-pressed", "true");
      await password.click();
      await expect(password).toHaveAttribute("aria-pressed", "true");
      await expect(code).toHaveAttribute("aria-pressed", "false");
      const bounds = await page.locator(".password-access").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(16);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 16);
      for (const control of await methods.getByRole("button").all()) {
        const box = await control.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(16);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - 16);
      }
      const colors = await methods.evaluate(node => [...node.querySelectorAll("button")].map(button => getComputedStyle(button).backgroundColor));
      expect(colors[0]).not.toEqual(colors[1]);
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
      expect(confirmationBounds!.x).toBeGreaterThanOrEqual(16);
      expect(confirmationBounds!.x + confirmationBounds!.width).toBeLessThanOrEqual(width - 16);
      expect(await page.locator(".obview").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`onboarding-signup-${theme}-${width}.png`) });
      await code.click();
      await expect(page.getByLabel("Your name")).toBeVisible();
      await expect(page.getByLabel("Email or phone", { exact: true })).toBeVisible();
    });
  }
}
