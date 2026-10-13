import { expect, test } from "@playwright/test";

// AXO-251 replaced AXO-236's insight-quoted "Next step" with the practice next
// best action. The insight sentence itself is still covered in Insights.

const shots = process.env.AXO244_SHOTS;

for (const width of [380, 768, 1024]) {
  test(`AXO-255 home at ${width}px: one primary action, cards in order, no horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/browser/index.html?view=home&scenario=insights&styled=1");
    const card = page.locator(".nbacard");
    await expect(card).toContainText("Re-attempt 4 questions on Momentum");
    await expect(card).toContainText("+9 marks recoverable");
    await expect(page.locator(".btn.primary")).toHaveCount(1);
    const order = await page.locator(".sectitle").allTextContents();
    expect(order.slice(0, 3).map((t) => t.replace(/\s+\d.*$/, ""))).toEqual(["Today’s re-attempts", "Where the most marks are", "Your progress"]);
    await expect(page.locator(".leakcard")).not.toContainText("Slips");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const b of await page.locator(".nbacard button, .leakcard button, .duelist button").all()) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    if (shots) await page.screenshot({ path: `${shots}/home-${width}.png`, fullPage: true });
  });
}

test("AXO-251: papers with nothing due offer a scan, once", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=home&scenario=insights-early&styled=1");
  await expect(page.locator(".nbacard")).toContainText("Nothing is due today.");
  await expect(page.locator(".btn.primary")).toHaveCount(1);
  await expect(page.getByText("Got a marked paper back?")).toHaveCount(0);
});

for (const width of [380, 1024]) {
  test(`AXO-260/261/262 insights at ${width}px: scorecard, readiness and an outlook that is off by default`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/browser/index.html?view=insights&scenario=insights&styled=1");
    await page.getByLabel("Subject for practice analytics").selectOption("Physics");
    const score = page.locator(".sectitle", { hasText: "Practice by command word and AO" }).locator("..");
    await expect(score).toContainText("12 of 24 lost");
    await expect(score).toContainText("4 questions had no printed command word");
    // "Explain" lost marks on fewer than 3 questions, so it is not named yet (owner, 5 Oct).
    await expect(score).not.toContainText("“Explain”");
    await expect(score).toContainText("1 command word with fewer than 3 questions");
    const ready = page.locator(".sectitle", { hasText: "Topic readiness" }).locator("..");
    await expect(ready).toContainText("syllabus points have evidence");
    await ready.getByText(/^1 Forces and motion/).click();
    await expect(ready).toContainText("Not enough data");
    await expect(ready.locator(".ladder.nodata").first()).toBeVisible();
    await expect(page.locator(".outlookcard")).toContainText("only shown if you turn it on");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (shots) await page.screenshot({ path: `${shots}/insights-${width}.png`, fullPage: true });
  });
}

test("AXO-256/257/258: a session runs end to end — answer from memory, reveal, own check, remedy, finish, plan", async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 900 });
  await page.goto("/tests/browser/index.html?view=practice&scenario=insights&styled=1&route=/practice/sess");
  await expect(page.getByRole("heading", { name: "Physics · 3(b)" })).toBeVisible();
  await expect(page.getByText("1 of 2 · ")).toBeVisible();
  // Closed book: nothing about the answer shows before an attempt.
  await expect(page.getByText("Where the marks went")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check my answer" })).toBeDisabled();
  await page.getByLabel("Your answer, from memory").fill("Total momentum is conserved because no external force acts.");
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(page.getByText("6 of 8")).toBeVisible();
  // Cambridge scheme text is never shown; the page says why.
  await expect(page.getByText(/mark scheme for this paper cannot be shown here/)).toBeVisible();
  await expect(page.getByText(/never changes your teacher/)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/practice-reveal-380.png`, fullPage: true });
  await page.getByRole("button", { name: /Partly/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  // Misconception remedy: explain why, then retry.
  await expect(page.getByLabel("Why was your first answer wrong?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save and next" })).toBeDisabled();
  await page.getByLabel("Why was your first answer wrong?").fill("I thought momentum could be lost like kinetic energy.");
  await page.getByRole("button", { name: "Save and next" }).click();
  // Second item: technique → rewrite.
  await expect(page.getByRole("heading", { name: "Physics · 3(a)" })).toBeVisible();
  await page.getByRole("button", { name: /can.t recall it/ }).click();
  await page.getByRole("button", { name: /Not yet/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your rewritten answer").fill("Gravitational store to kinetic store as it falls; to thermal and sound on impact.");
  await page.getByRole("button", { name: "Save and finish" }).click();
  await expect(page.getByRole("heading", { name: "Session done" })).toBeVisible();
  await expect(page.getByText("2 of 2 parts re-attempted · 1 partly, 1 to come back to")).toBeVisible();
  await expect(page.getByText(/\b0 /)).toHaveCount(0);
  await expect(page.getByText("When will you do the next one?")).toBeVisible();
  await page.getByRole("button", { name: "Plan it" }).click();
  await expect(page.getByRole("link", { name: /Add it to your calendar/ })).toHaveAttribute("href", /^data:text\/calendar/);
  if (shots) await page.screenshot({ path: `${shots}/practice-done-380.png`, fullPage: true });
});
