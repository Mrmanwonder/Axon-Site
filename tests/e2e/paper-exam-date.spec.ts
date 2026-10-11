import { expect, test } from "@playwright/test";

// Browser fixture; verifies real controls in both engines, not production data.
for (const timezoneId of ["America/Los_Angeles", "Asia/Kolkata"]) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });
    test("paper date correction and clear keep their calendar day", async ({ page }) => {
      await page.goto("/tests/browser/index.html?view=paper&route=/library/paper-1");
      await expect(page.locator(".po-meta")).toContainText("Added");
      const input = page.getByLabel("Exam date", { exact: true });
      await input.fill("2026-09-30");
      await page.getByRole("button", { name: "Save date", exact: true }).click();
      await expect(page.locator(".po-meta")).toContainText("Exam 30 Sept 2026");
      await expect(page.getByRole("status").filter({ hasText: "Exam date saved." })).toBeVisible();
      await page.getByRole("button", { name: "Clear date", exact: true }).click();
      await page.getByRole("button", { name: "Save date", exact: true }).click();
      await expect(page.locator(".po-meta")).toContainText("Added");
      await expect(input).toHaveValue("");
    });
  });
}
