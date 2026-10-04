import { expect, test } from "@playwright/test";

const URL = "/tests/browser/index.html?view=student-scope-household&scenario=student-scope-household";

test("multi-student household switches and sign-out never leak sibling local state", async ({ page }) => {
  await page.goto(URL);

  await expect(page.getByTestId("household-gate")).toHaveText("ready");
  await expect(page.getByTestId("household-student")).toHaveText("student-a");

  await page.evaluate(async () => {
    const cache = await import("/src/cache.js");
    const drafts = await import("/src/scan/drafts.js");

    await cache.putCached("paper:student-a:private", { owner: "student-a", answer: "A private answer" });
    await cache.putCached("paper:student-b:private", { owner: "student-b", answer: "B private answer" });

    const a = await drafts.createDraft({ id: crypto.randomUUID(), studentId: "student-a", paperType: null });
    await drafts.addPage(a, { page_number: 1, blob: new Uint8Array([1]).buffer });

    const b = await drafts.createDraft({ id: crypto.randomUUID(), studentId: "student-b", paperType: null });
    await drafts.addPage(b, { page_number: 1, blob: new Uint8Array([2]).buffer });
  });

  await page.getByRole("button", { name: "Switch B" }).click();

  await expect(page.getByTestId("household-student")).toHaveText("student-b");
  await expect(page.getByTestId("household-gate")).toHaveText("ready");

  const afterB = await page.evaluate(async () => {
    const cache = await import("/src/cache.js");
    const drafts = await import("/src/scan/drafts.js");
    return {
      aCache: await cache.getCached("paper:student-a:private"),
      bCache: await cache.getCached("paper:student-b:private"),
      aDrafts: (await drafts.listDrafts("student-a")).length,
      bDrafts: (await drafts.listDrafts("student-b")).length,
      remembered: localStorage.getItem("axon.active_student_id:guardian"),
      serverScope: sessionStorage.getItem("axon.test.household.scope"),
    };
  });

  // clearStudentLocalData deliberately invalidates the shared read cache while
  // deleting only the outgoing student's drafts. The now-authorized B draft may
  // remain, but no cached A/B read result can survive the authority transition.
  expect(afterB).toEqual({
    aCache: null,
    bCache: null,
    aDrafts: 0,
    bDrafts: 1,
    remembered: "student-b",
    serverScope: "student-b",
  });

  await page.getByRole("button", { name: "Switch A" }).click();

  await expect(page.getByTestId("household-student")).toHaveText("student-a");
  await expect(page.getByTestId("household-gate")).toHaveText("ready");

  const afterA = await page.evaluate(async () => {
    const drafts = await import("/src/scan/drafts.js");
    return {
      bDrafts: (await drafts.listDrafts("student-b")).length,
      remembered: localStorage.getItem("axon.active_student_id:guardian"),
      serverScope: sessionStorage.getItem("axon.test.household.scope"),
    };
  });
  expect(afterA).toEqual({
    bDrafts: 0,
    remembered: "student-a",
    serverScope: "student-a",
  });

  // Seed fresh A schoolwork so sign-out must prove a full-device purge, not
  // merely inherit the earlier switch cleanup.
  await page.evaluate(async () => {
    const cache = await import("/src/cache.js");
    const drafts = await import("/src/scan/drafts.js");
    await cache.putCached("paper:student-a:after-switch", { private: true });
    const draft = await drafts.createDraft({ id: crypto.randomUUID(), studentId: "student-a", paperType: null });
    await drafts.addPage(draft, { page_number: 1, blob: new Uint8Array([3]).buffer });
  });

  await page.getByRole("button", { name: "Sign out household" }).click();

  // signOutNow reloads. The browser fixture then reports no auth session, which
  // mirrors the production sign-out unit's verified scope -> local -> auth order.
  await expect(page.getByTestId("household-gate")).toHaveText("onboarding");
  await expect(page.getByTestId("household-student")).toHaveText("none");

  const signedOut = await page.evaluate(async () => {
    const cache = await import("/src/cache.js");
    const drafts = await import("/src/scan/drafts.js");
    return {
      cache: await cache.getCached("paper:student-a:after-switch"),
      aDrafts: (await drafts.listDrafts("student-a")).length,
      bDrafts: (await drafts.listDrafts("student-b")).length,
      serverScope: sessionStorage.getItem("axon.test.household.scope"),
      signedOut: sessionStorage.getItem("axon.test.household.signed-out"),
    };
  });

  expect(signedOut).toEqual({
    cache: null,
    aDrafts: 0,
    bDrafts: 0,
    serverScope: null,
    signedOut: "1",
  });
});
