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
      await expect(page.getByRole("heading", { name: "Welcome to Axon" })).toBeVisible();
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`onboarding-account-${theme}-${width}.png`) });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const g = await gutter(page);
      const fits = async (selector: string) => {
        const box = await page.locator(selector).first().boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(g);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width - g);
      };
      const noOverflow = async () => expect(await page.locator(".obview").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);

      // An existing account: welcome back and one password box.
      await page.getByLabel("Email", { exact: true }).fill("parent@example.test");
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
      await fits(".obpassword");
      await noOverflow();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByLabel("Password", { exact: true }).fill("wrong-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("didn't work");
      await page.screenshot({ path: testInfo.outputPath(`onboarding-existing-${theme}-${width}.png`) });
      await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "reset link" })).toBeVisible();
      await noOverflow();

      // A new account: requirements tick off live, the code waits for a valid password.
      await page.getByLabel("Email", { exact: true }).fill("new.parent@example.test");
      await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
      const send = page.getByRole("button", { name: "Email me a code" });
      await expect(send).toBeDisabled();
      await page.getByLabel("Password", { exact: true }).fill("abcdefgh");
      await expect(page.getByText("Your password needs")).toBeVisible();
      await expect(page.locator(".obrules li[data-met]")).toHaveCount(2);
      await expect(send).toBeDisabled();
      await fits(".obrules");
      await page.getByLabel("Password", { exact: true }).fill("CorrectPassword9");
      await expect(page.locator(".obrules li[data-met]")).toHaveCount(4);
      await expect(send).toBeEnabled();
      await noOverflow();
      await page.screenshot({ path: testInfo.outputPath(`onboarding-new-${theme}-${width}.png`) });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const button of await page.getByRole("button").all()) {
        if (!(await button.isVisible())) continue;
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
      }
    });
  }
}
