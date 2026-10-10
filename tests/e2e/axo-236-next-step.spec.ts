import { expect, test } from "@playwright/test";

test("Next step quotes the student's supported fix and links its source question", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=home&scenario=insights&styled=1");
  const card = page.locator(".nextstep");
  await expect(card).toContainText("Next step");
  await expect(card).toContainText("Make one point per mark: six marks means six separate, linked statements.");
  await expect(card).toContainText("papers");
  const source = card.getByRole("link", { name: /^Open / });
  await expect(source).toHaveAttribute("href", "/library/ip6/ip6-a3");
  await expect(card).not.toContainText(/ready to save|confirmation|Add your next|still being processed/);
});

test("Home has no invented next step when it lacks repeated academic evidence", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=home&scenario=insights-early&styled=1");
  await expect(page.getByText("Recent scans", { exact: true })).toBeVisible();
  await expect(page.locator(".nextstep")).toHaveCount(0);
});
