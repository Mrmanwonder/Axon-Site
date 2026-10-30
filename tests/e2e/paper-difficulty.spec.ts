import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test("paper difficulty orb: answer, persist, change and leave in " + theme, async ({ page }) => {
    // One flow, several waits, and an axe scan: the 30 s default is too tight on a slow WebKit runner.
    test.setTimeout(90_000);
    await page.goto("/tests/browser/difficulty.html?theme=" + theme);
    const row = page.getByRole("button", { name: /^How hard was this paper\?/ });
    await row.click();
    const slider = page.getByRole("slider", { name: "How difficult the paper felt" });
    await expect(slider).toHaveAttribute("aria-valuetext", "About right");
    // Let the sheet land and the page behind it settle before axe measures any colour.
    await page.waitForTimeout(900);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    // Axe aggregates its result in a temporary page. WebKit may leave this
    // page inactive after that page closes, so explicitly restore it before
    // delivering keyboard input and waiting for the orb's animation frame.
    await page.bringToFront();
    await slider.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuetext", "Hard");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
    await expect(slider).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByRole("button", { name: /^How hard it felt/ })).toContainText("Hard");

    await page.reload();
    const answered = page.getByRole("button", { name: /^How hard it felt/ });
    await expect(answered).toContainText("Hard");
    await answered.click();
    await expect(slider).toHaveAttribute("aria-valuetext", "Hard");

    // Dragging the orb moves it off the saved step; Not now leaves the answer alone.
    // Attribute reads can succeed while the reopened sheet is still entering.
    // Let Playwright wait for a stable, actionable slider before taking raw
    // pointer coordinates, or the drag can start below the viewport.
    await slider.hover();
    const box = (await slider.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width / 2 - i * 20, y);
    await page.mouse.up();
    await expect(slider).not.toHaveAttribute("aria-valuetext", "Hard");
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await expect(slider).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^How hard it felt/ })).toContainText("Hard");
  });
}
