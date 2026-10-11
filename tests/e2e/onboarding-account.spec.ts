import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["dark", "light"]) {
  test(`onboarding account controls fit and remain readable in ${theme} mode @a11y`, async ({ page }, testInfo) => {
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(`/tests/browser/index.html?view=onboarding&scenario=password&styled=1&theme=${theme}`);
      await expect(page.getByRole("heading", { name: "Understand your marked paper." })).toBeVisible();
      await expect(page.getByRole("list", { name: "How Axon works" }).getByRole("listitem")).toHaveCount(3);
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
      await page.getByRole("button", { name: "Forgot password", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.locator(".password-access").getByRole("status")).toContainText("If this email");
      expect(await page.locator(".obview").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await testInfo.attach(`account-${theme}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
      await code.click();
      await expect(page.getByLabel("Your name")).toBeVisible();
      await expect(page.getByLabel("Email or phone", { exact: true })).toBeVisible();
    }
  });
}
