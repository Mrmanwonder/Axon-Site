import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Real rows from Cambridge's November 2026 zone 4 timetable (tests/browser/exam-fixture.json).
// The clock is fixed so the card reads the same on any day the suite runs.
test.use({ timezoneId: "Asia/Kolkata" });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-06T10:00:00+05:30"));
});

test("Home: the next paper from the timetable, and the one question still open", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=home&scenario=exams");
  const card = page.locator(".examcard");
  await expect(card.getByText("In 7 days")).toBeVisible();
  await expect(card.getByText("Mathematics · Paper 6")).toBeVisible();
  await expect(card.getByText("Mathematics · Paper 3")).toBeVisible();
  await expect(card.getByText("Which Computer Science and Physics papers do you sit?")).toBeVisible();
  await expect(card.getByRole("link", { name: "Choose papers" })).toHaveAttribute("href", "/settings#exams");
  await expect(card.getByRole("link", { name: "Source" })).toHaveAttribute("href", /757649-november-2026-zone-4-timetable\.pdf$/);
  expect(await card.innerText()).not.toMatch(/\d+\s?%/);
  const { violations } = await new AxeBuilder({ page }).include(".examcard").analyze();
  expect(violations.map((v) => [v.id, v.nodes.map((n) => n.target.join(" "))])).toEqual([]);
});

test("Home: asks once where the student sits, then reads that zone's timetable", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=home&scenario=exams-setup");
  const card = page.locator(".examcard");
  await expect(card.getByText("Where do you sit your exams?")).toBeVisible();
  await expect(card.getByRole("button", { name: "Country where you sit your exams" })).toContainText("India");
  await expect(card.getByText("Cambridge zone 4.")).toBeVisible();
  // The empty Home's one primary action stays "Add your first paper".
  await expect(card.getByRole("button", { name: "Save" })).not.toHaveClass(/primary/);
  const { violations } = await new AxeBuilder({ page }).include(".examcard").analyze();
  expect(violations.map((v) => [v.id, v.nodes.map((n) => n.target.join(" "))])).toEqual([]);
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Which Computer Science, Mathematics and Physics papers do you sit?")).toBeVisible();
});

test("Settings: papers come from the syllabus routes; nothing is chosen for the student", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=exam-settings&scenario=exams");
  await page.getByRole("button", { name: /^Physics/ }).click();
  await expect(page.getByText("Everyone at your level sits Papers 4 and 5.", { exact: false })).toBeVisible();
  const radios = page.getByRole("radio");
  await expect(radios).toHaveCount(2);
  for (const r of await radios.all()) await expect(r).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("radio", { name: /Papers 4 and 5 · completing after AS/ }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /^Physics/ })).toContainText("Papers 4 and 5");
  const { violations } = await new AxeBuilder({ page }).include(".examsettings").analyze();
  expect(violations.map((v) => [v.id, v.nodes.map((n) => n.target.join(" "))])).toEqual([]);
});
