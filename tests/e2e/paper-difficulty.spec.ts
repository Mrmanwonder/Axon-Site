import { expect, test } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test("paper difficulty answer, deliberate edit and persisted skip in " + theme, async ({ page }) => {
    await page.goto("/tests/browser/difficulty.html?theme=" + theme);
    await page.getByRole("button", { name: "Hard", exact: true }).click();
    await expect(page.getByText("How this paper felt:")).toBeVisible();
    await page.reload();
    await expect(page.getByText("How this paper felt:")).toBeVisible();
    await expect(page.getByRole("button", { name: "Very easy", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Easy", exact: true }).click();
    await expect(page.locator(".pd-inline strong")).toHaveText("Easy");
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await expect(page.getByRole("heading", { name: "How difficult did this paper feel?" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Paper difficulty test fixture" })).toBeVisible();
    await expect(page.locator(".pd-prompt")).toHaveCount(0);
  });
}
