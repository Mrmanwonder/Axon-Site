import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const SHOTS = process.env.SCAN_SHOTS;
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const laptop = { viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false };

const open = async (page: Page, state: string, theme = "dark") => {
  await page.goto(`/tests/browser/index.html?view=scan-screen&state=${state}&theme=${theme}`);
  await page.waitForSelector(".sc, .sc-desk");
};
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const calls = (page: Page, name: string) => page.evaluate((n) => (window as any).__scanCalls[n] ?? [], name);

test.describe("camera screen on a phone", () => {
  test.use(phone);

  test("looking: strip says one thing, Done is disabled, shutter is live", async ({ page }) => {
    await open(page, "search");
    await shot(page, "m-search");
    await expect(page.locator(".sc-strip")).toHaveAttribute("data-tone", "neutral");
    await expect(page.locator(".sc-strip .t")).toHaveText("Looking for the page");
    await expect(page.getByRole("button", { name: "Take this page" })).toBeEnabled();
    await expect(page.locator(".sc-done")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  });

  test("saved drafts: the icon is always there, the dot only when there is something to resume", async ({ page }) => {
    await open(page, "search");
    const none = page.getByRole("button", { name: "Saved drafts", exact: true });
    await expect(none).toBeVisible();
    await expect(page.locator(".sc-top .dot")).toHaveCount(0);

    await open(page, "saved");
    const some = page.getByRole("button", { name: "Saved drafts, 1" });
    await expect(some).toBeVisible();
    await expect(page.locator(".sc-top .dot")).toHaveCount(1);
  });

  test("locked: blue strip and a blue rim on the shutter", async ({ page }) => {
    await open(page, "locked");
    await shot(page, "m-locked");
    await expect(page.locator(".sc-strip")).toHaveAttribute("data-tone", "locked");
    await expect(page.locator(".sc-shutter")).toHaveAttribute("data-locked", "true");
  });

  test("pages taken: stack shows the count and Done names it", async ({ page }) => {
    await open(page, "saved");
    await shot(page, "m-saved");
    await expect(page.getByRole("button", { name: "3 pages. Review pages" })).toBeVisible();
    await expect(page.locator(".sc-sheet")).toHaveCount(3);
    await expect(page.locator(".sc-done")).toHaveText("Done");
    await page.locator(".sc-done").click();
    expect(await calls(page, "onDone")).toHaveLength(1);
  });

  test("dark: the light action appears only because the camera has a torch", async ({ page }) => {
    await open(page, "dark");
    await shot(page, "m-dark");
    await expect(page.locator(".sc-strip")).toHaveAttribute("data-tone", "attention");
    await page.getByRole("button", { name: "Turn on torch" }).click();
    expect(await calls(page, "setTorchMode")).toEqual([["on"]]);
  });

  test("small and stuck", async ({ page }) => {
    await open(page, "small");
    await shot(page, "m-small");
    await expect(page.locator(".sc-strip .t")).toHaveText("Move closer, the page is small");
    await open(page, "stuck");
    await shot(page, "m-stuck");
    await page.getByRole("button", { name: "Take photo" }).click();
    expect(await calls(page, "shoot")).toHaveLength(1);
  });

  test("a flagged page: strip names it, stack is outlined, Done becomes Review", async ({ page }) => {
    await open(page, "flag");
    await shot(page, "m-flag");
    await expect(page.locator(".sc-strip .t")).toContainText("Page 2: Blurry");
    await expect(page.locator(".sc-sheet[data-flagged=true]")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /3 pages, 1 needs a look/ })).toBeVisible();
    await expect(page.locator(".sc-done")).toHaveText("Review");
    await page.getByRole("button", { name: "Retake" }).first().click();
    expect(await calls(page, "onRetake")).toEqual([[2]]);
  });

  test("review sheet leads with the page that needs a look", async ({ page }) => {
    await open(page, "review");
    await shot(page, "m-review");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "1 page needs a look" })).toBeVisible();
    await expect(dialog.getByText("The other 2 can be read.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Retake page 2" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Adjust edges" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Read as it is" })).toBeVisible();
    // Flagged page first.
    await expect(dialog.locator(".sc-pg").first()).toContainText("Page 2");
  });

  test("adjust edges opens the editor on the original photo and returns four corners", async ({ page }) => {
    await open(page, "review");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Adjust edges" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Page 2 edges" })).toBeVisible();
    await expect(page.locator(".scanic-handle")).toHaveCount(4);
    await shot(page, "m-adjust");
    await dialog.getByRole("button", { name: "Use these edges" }).click();
    await expect.poll(async () => (await calls(page, "onAdjustApply")).length).toBe(1);
    const [[pageNumber, quad]] = await calls(page, "onAdjustApply");
    expect(pageNumber).toBe(2);
    expect(quad).toHaveLength(4);
    // Starts from the detected page (image pixels), not an arbitrary rectangle.
    expect(Math.round(quad[0].x)).toBe(210);
    expect(Math.round(quad[2].y)).toBe(1230);
  });

  test("camera blocked: three ways forward, none of them a dead end", async ({ page }) => {
    await open(page, "denied");
    await shot(page, "m-denied");
    const group = page.getByRole("group", { name: "Camera unavailable" });
    await expect(group.getByRole("button", { name: "Try the camera again" })).toBeVisible();
    await expect(group.getByRole("button", { name: "Use your camera app" })).toBeVisible();
    await expect(group.getByRole("button", { name: "Import photos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Take this page" })).toBeDisabled();
  });

  test("more menu", async ({ page }) => {
    await open(page, "dark");
    await page.getByRole("button", { name: "More" }).click();
    await shot(page, "m-more");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /Import photos/ })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Torch" })).toBeVisible();
    // No Close row: the sheet closes from outside it or with Escape.
    await expect(dialog.getByRole("button", { name: "Close" })).toHaveCount(0);
    // Safari once scrolled the dialog to reveal a focused button while the sheet
    // was still rising, stranding it mid-screen. Once landed, the sheet sits on
    // the bottom edge, the dialog is unscrolled, and no button holds focus.
    await page.waitForTimeout(600);
    const landed = await page.evaluate(() => {
      const d = document.querySelector("dialog")!;
      const sheet = d.querySelector(".sheet")!.getBoundingClientRect();
      return { bottom: sheet.bottom, height: window.innerHeight, scroll: d.scrollTop,
        focused: document.activeElement?.tagName };
    });
    expect(landed.scroll).toBe(0);
    expect(Math.abs(landed.bottom - landed.height)).toBeLessThan(1);
    expect(landed.focused).not.toBe("BUTTON");
    await dialog.getByRole("button", { name: "On", exact: true }).click();
    expect(await calls(page, "setTorchMode")).toEqual([["on"]]);
  });

  test("saved drafts with nothing saved offers one way out", async ({ page }) => {
    await open(page, "search");
    await page.getByRole("button", { name: "Saved drafts" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "OK" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the light control is absent where the camera has no torch", async ({ page }) => {
    await open(page, "search");
    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("group", { name: "Torch" })).toHaveCount(0);
  });

  test("every control is at least 44px and the page has no red", async ({ page }) => {
    await open(page, "flag");
    const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".sc button")]
      .map((b) => ({ n: b.getAttribute("aria-label") ?? b.textContent, ...b.getBoundingClientRect().toJSON() }))
      .filter((b) => b.height < 44 || b.width < 44).map((b) => `${b.n} ${b.width}x${b.height}`));
    expect(small).toEqual([]);
    const red = await page.evaluate(() => {
      const found: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(".sc, .sc *")) {
        const cs = getComputedStyle(el);
        for (const value of [cs.color, cs.backgroundColor, cs.borderTopColor, cs.outlineColor]) {
          const m = value.match(/rgba?\((\d+), (\d+), (\d+)/);
          if (m && +m[1] > 200 && +m[2] < 80 && +m[3] < 80) found.push(`${el.className} ${value}`);
        }
      }
      return found;
    });
    expect(red).toEqual([]);
  });

  test("accessibility @a11y", async ({ page }) => {
    for (const state of ["search", "flag", "review", "denied"]) {
      await open(page, state);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations.map((v) => `${state}: ${v.id}`)).toEqual([]);
    }
  });
});

test.describe("page drop motion", () => {
  test.use(phone);

  test("a landing page animates 220ms by default", async ({ page }) => {
    await open(page, "saved");
    const style = await page.evaluate(() => {
      document.documentElement.dataset.motion = "full";
      const el = document.querySelector<HTMLElement>(".sc-sheet")!;
      el.dataset.landing = "true";
      const cs = getComputedStyle(el);
      return { name: cs.animationName, duration: cs.animationDuration };
    });
    expect(style).toEqual({ name: "sc-land", duration: "0.22s" });
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("nothing moves", async ({ page }) => {
      await open(page, "saved");
      const name = await page.evaluate(() => {
        document.documentElement.dataset.motion = "full";
        const el = document.querySelector<HTMLElement>(".sc-sheet")!;
        el.dataset.landing = "true";
        return getComputedStyle(el).animationName;
      });
      expect(name).toBe("none");
    });
  });
});

test.describe("import screen across laptop sizes", () => {
  for (const width of [1024, 1440]) {
    for (const theme of ["dark", "light"]) {
      test(`${width}px ${theme} fits, has no sideways scroll and passes axe @a11y`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page, "desk-pages", theme);
        await shot(page, `d-${width}-${theme}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        const result = await new AxeBuilder({ page }).analyze();
        expect(result.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 80)}`)).toEqual([]);
      });
    }
  }
});

test.describe("import screen on a laptop", () => {
  test.use(laptop);

  for (const theme of ["dark", "light"]) {
    test(`empty, ${theme}`, async ({ page }) => {
      await open(page, "desk", theme);
      await shot(page, `d-empty-${theme}`);
      await expect(page.getByRole("heading", { name: "Add a paper" })).toBeVisible();
      await expect(page.getByText("Drop photos here")).toBeVisible();
      await expect(page.getByRole("button", { name: "Choose files" })).toBeVisible();
      await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
      // No webcam: no video element, no shutter.
      await expect(page.locator("video")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Take this page" })).toHaveCount(0);
      expect(await calls(page, "onScreenVisible")).toEqual([]);
    });
  }

  test("pages added show as a paper with Review when one needs a look @a11y", async ({ page }) => {
    await open(page, "desk-pages");
    await shot(page, "d-pages");
    await expect(page.getByRole("region", { name: "This paper" })).toBeVisible();
    await expect(page.locator(".sc-card-row .sc-done")).toHaveText("Review");
    await expect(page.getByRole("button", { name: "Page 2, needs a look" })).toBeVisible();
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });

  test("dropping a file lifts the pile and says so", async ({ page }) => {
    await open(page, "desk");
    const zone = page.locator(".sc-drop");
    await zone.dispatchEvent("dragenter", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
    await expect(zone).toHaveAttribute("data-over", "true");
    await expect(page.getByText("Let go to add these pages")).toBeVisible();
    await shot(page, "d-over");
  });
});

test.describe("tablets keep the camera", () => {
  test.use({ viewport: { width: 1024, height: 1366 }, hasTouch: true, isMobile: false,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" });
  test("an iPad with a trackpad (reports as a Mac with touch) gets the camera, not the import screen", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 }));
    await open(page, "search");
    await expect(page.locator(".sc")).toBeVisible();
    await expect(page.locator(".sc-desk")).toHaveCount(0);
    await shot(page, "t-ipad");
  });
});
