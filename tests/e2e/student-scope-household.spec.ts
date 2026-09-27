import { test, expect } from "@playwright/test";

const url = "/tests/browser/index.html?scenario=student-scope-household&view=student-scope";

test("multi-student household never mixes sibling authority across switch, cache, sign-out or offline boot", async ({ page }) => {
  await page.goto(url);

  // Multi-profile household + no live server scope must not trust a remembered
  // local profile. The only route forward is an explicitly parent-guarded choice.
  await expect(page.getByRole("status", { name: "choose-profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Alpha" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Beta" })).toBeVisible();

  await page.getByRole("button", { name: "Alpha" }).click();
  await expect(page.getByTestId("active-student")).toHaveText("student-a");
  await expect(page.getByTestId("paper-state")).toHaveText("ready:paper-a");

  // Retain private A state deliberately. AXO-62 must purge this before B can
  // appear, and late A reads are rejected by the browser fixture's server gate.
  await page.evaluate(async () => {
    const cache = await import("/src/cache.js");
    const drafts = await import("/src/scan/drafts.js");
    await cache.putCached("paper:student-a:secret", { answer: "A-only schoolwork" });
    const draft = await drafts.createDraft({
      id: crypto.randomUUID(),
      studentId: "student-a",
      paperType: null,
    });
    draft.pages.push({
      page_number: 1,
      blob: new Uint8Array([1, 2, 3]).buffer,
    });
    await drafts.saveDraft(draft);
  });

  await page.getByRole("button", { name: "Beta" }).click();
  await expect(page.getByTestId("active-student")).toHaveText("student-b");
  await expect(page.getByTestId("paper-state")).toHaveText("ready:paper-b");
  await expect(page.getByText("paper-a", { exact: true })).toHaveCount(0);

  const localAfterSwitch = await page.evaluate(async () => {
    const cache = await import("/src/cache.js");
    const drafts = await import("/src/scan/drafts.js");
    return {
      cached: await cache.getCached("paper:student-a:secret"),
      drafts: (await drafts.listDrafts("student-a")).length,
    };
  });
  expect(localAfterSwitch).toEqual({ cached: null, drafts: 0 });

  // Repeated switches exercise serialized authority changes. The fake server
  // throws if any paper read uses a student different from the current scope.
  await page.getByRole("button", { name: "Alpha" }).click();
  await expect(page.getByTestId("active-student")).toHaveText("student-a");
  await expect(page.getByTestId("paper-state")).toHaveText("ready:paper-a");

  await page.getByRole("button", { name: "Beta" }).click();
  await expect(page.getByTestId("active-student")).toHaveText("student-b");
  await expect(page.getByTestId("paper-state")).toHaveText("ready:paper-b");

  const trace = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("axon.e2e.student-scope.trace") ?? "[]") as string[]
  );
  expect(trace.filter(event => event === "parent-mode:fresh").length).toBeGreaterThanOrEqual(3);
  expect(trace).toContain("scope-set:student-a");
  expect(trace).toContain("scope-set:student-b");
  expect(trace).not.toContain("paper-read:student-a:scope=student-b");
  expect(trace).not.toContain("paper-read:student-b:scope=student-a");

  // Sign-out must clear the server scope. Signing back into the same browser
  // cannot revive the remembered B profile; the household returns to choice.
  await page.getByRole("button", { name: "Sign out test" }).click();
  await expect(page.getByRole("status", { name: "signed-out" })).toBeVisible();

  await page.getByRole("button", { name: "Sign in again" }).click();
  await expect(page.getByRole("status", { name: "choose-profile" })).toBeVisible();
  await expect(page.getByTestId("active-student")).toHaveCount(0);

  await page.getByRole("button", { name: "Beta" }).click();
  await expect(page.getByTestId("active-student")).toHaveText("student-b");
  await expect(page.getByTestId("paper-state")).toHaveText("ready:paper-b");

  // A shared-device offline reload must fail closed for multi-profile accounts,
  // even though localStorage remembers B and the test server previously scoped B.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "onLine", {
      configurable: true,
      get: () => false,
    });
  });
  await page.reload();
  await expect(page.getByRole("status", { name: "choose-profile" })).toBeVisible();
  await expect(page.getByTestId("active-student")).toHaveCount(0);
});
