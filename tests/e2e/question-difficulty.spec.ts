import { expect, test } from "@playwright/test";
test("question difficulty distinguishes failed retrieval from a low confidence estimate", async ({ page }) => {
  await page.goto("/tests/browser/difficulty.html");
  await expect(page.getByRole("status")).toHaveText("Question difficulty is unavailable right now.");
  await page.getByRole("button", { name: "Try difficulty again" }).click();
  await expect(page.getByText("Low confidence", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByText("Hard · estimated", { exact: false })).toBeVisible();
  await expect(page.getByText(/This describes the question, not your ability/)).toBeVisible();
});
