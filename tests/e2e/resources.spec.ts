import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("cold library remains loading until the delayed empty result", async ({ page }) => {
  await page.goto("/tests/browser/index.html"); await expect(page.getByText("Loading papers…")).toBeVisible();
  await expect(page.getByText("Nothing here yet")).toHaveCount(0); await expect(page.getByText("0 papers", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Nothing here yet")).toBeVisible();
});
test("Home does not confuse early analytics with paper completion", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=home"); await expect(page.getByText("Loading papers…")).toBeVisible(); await expect(page.getByText("No papers yet")).toHaveCount(0); await expect(page.getByText("No papers yet")).toBeVisible();
});
test("cached analysis is identified", async ({ page }) => { await page.goto("/tests/browser/index.html?view=insights&scenario=cached"); await expect(page.getByText("Last available analysis.")).toBeVisible(); });
test("auth read failure is a boot error", async ({ page }) => { await page.goto("/tests/browser/index.html?scenario=auth-error"); await expect(page.getByText("boot_error")).toBeVisible(); });
test("consent failure stays explicit", async ({ page }) => { await page.goto("/tests/browser/index.html?scenario=consent-error"); await expect(page.getByText("Consent failed")).toBeVisible(); });
test("resource status accessibility @a11y", async ({ page }) => { await page.goto("/tests/browser/index.html"); await expect(page.getByText("Nothing here yet")).toBeVisible(); expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); });
test("capture stops a permission result after detachment", async ({ page }) => {
  await page.goto("/tests/browser/index.html");
  const stopped = await page.evaluate(async () => {
    const { createCapture } = await import("/src/scan/capture.js");
    const video = document.createElement("video"); const overlay = document.createElement("canvas");
    const capture = createCapture({ video, overlay, onState() {}, onShot() {} });
    let resolve: (stream: any) => void = () => {}; let stops = 0;
    const pending = new Promise(resolvePromise => { resolve = resolvePromise; });
    const start = capture.start(pending); capture.stop(); resolve({ getTracks: () => [{ stop() { ++stops; } }] }); await start;
    return { stops, attached: video.srcObject !== null };
  });
  expect(stopped).toEqual({ stops: 1, attached: false });
});

test("dialog traps focus, labels input and restores trigger @a11y", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=dialog");
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByRole("dialog", { name: "Enter your answer" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).toBeFocused();
  for (let i = 0; i < 7; ++i) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open dialog" })).toBeFocused();
});
test("consequential dialog waits then preserves callback navigation", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=dialog"); await page.getByRole("button", { name: "Open dialog" }).click();
  await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("42"); await page.getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); await expect(page.getByRole("button", { name: "Working…" })).toBeDisabled();
  await expect(page.getByText("/saved", { exact: true })).toBeVisible(); await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("Reduce Motion cancels active springs without decorative frames", async ({ page }) => {
  await page.goto("/tests/browser/index.html");
  const result = await page.evaluate(async () => {
    const { spring, seed } = await import("/src/ui/lib/spring.ts");
    document.documentElement.dataset.motion = "reduce";
    let frames = 0; let position = 0; const original = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => { ++frames; return original(callback); };
    seed("test", 0); spring("test", { to: 1, onUpdate: value => { position = value; } });
    window.requestAnimationFrame = original; return { frames, position };
  });
  expect(result).toEqual({ frames: 0, position: 1 });
});

test("camera preview is configured for inline iPhone playback before attachment", async ({ page }) => {
  await page.goto("/tests/browser/index.html");

  const result = await page.evaluate(async () => {
    const { createCapture } = await import("/src/scan/capture.js");
    const video = document.createElement("video");
    const overlay = document.createElement("canvas");
    const stopped = { count: 0 };
    const stream = {
      getTracks: () => [{ stop() { ++stopped.count; } }],
      getVideoTracks: () => [],
    };
    Object.defineProperty(video, "srcObject", { value: null, writable: true });
    let stateAtPlay: Record<string, unknown> | null = null;
    video.play = async () => {
      stateAtPlay = {
        autoplay: video.autoplay,
        muted: video.muted,
        defaultMuted: video.defaultMuted,
        playsInline: video.playsInline,
        autoplayAttribute: video.hasAttribute("autoplay"),
        playsInlineAttribute: video.hasAttribute("playsinline"),
        webkitPlaysInlineAttribute: video.hasAttribute("webkit-playsinline"),
        streamAttached: video.srcObject === stream,
      };
    };

    const capture = createCapture({ video, overlay, onState() {}, onShot() {} });
    await capture.start(stream as unknown as MediaStream);
    capture.stop();
    return { stateAtPlay, stopped: stopped.count };
  });

  expect(result).toEqual({
    stateAtPlay: {
      autoplay: true,
      muted: true,
      defaultMuted: true,
      playsInline: true,
      autoplayAttribute: true,
      playsInlineAttribute: true,
      webkitPlaysInlineAttribute: true,
      streamAttached: true,
    },
    stopped: 1,
  });
});

test("camera rendering follows video frames instead of the display refresh rate", async ({ page }) => {
  await page.goto("/tests/browser/index.html");

  const result = await page.evaluate(async () => {
    const { createCapture } = await import("/src/scan/capture.js");
    const video = document.createElement("video");
    const overlay = document.createElement("canvas");
    const stream = { getTracks: () => [], getVideoTracks: () => [] };
    Object.defineProperty(video, "srcObject", { value: null, writable: true });
    let videoRequests = 0;
    let videoCancels = 0;
    let animationRequests = 0;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    video.play = async () => {};
    video.requestVideoFrameCallback = (() => ++videoRequests) as typeof video.requestVideoFrameCallback;
    video.cancelVideoFrameCallback = (() => { ++videoCancels; }) as typeof video.cancelVideoFrameCallback;
    window.requestAnimationFrame = (() => { ++animationRequests; return 1; }) as typeof window.requestAnimationFrame;

    try {
      const capture = createCapture({ video, overlay, onState() {}, onShot() {} });
      await capture.start(stream as unknown as MediaStream);
      capture.stop();
      return { videoRequests, videoCancels, animationRequests };
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  expect(result).toEqual({ videoRequests: 1, videoCancels: 1, animationRequests: 0 });
});

test("camera video remains renderable behind the placeholder while iPhone playback starts", async ({ page }) => {
  await page.goto("/tests/browser/index.html");

  const displays = await page.evaluate(async () => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/src/ui/styles/system.css";
    const loaded = new Promise<void>((resolve, reject) => {
      stylesheet.onload = () => resolve();
      stylesheet.onerror = () => reject(new Error("scanner stylesheet did not load"));
    });
    document.head.append(stylesheet);
    await loaded;

    const hero = document.createElement("div");
    hero.className = "scanhero";
    hero.innerHTML = '<video id="scanVideo"></video><canvas id="scanOverlay"></canvas><div class="feed"></div>';
    document.body.append(hero);
    const video = hero.querySelector("video")!;
    const overlay = hero.querySelector("canvas")!;

    hero.dataset.camera = "off";
    hero.dataset.phase = "starting";
    const starting = {
      video: getComputedStyle(video).display,
      overlay: getComputedStyle(overlay).display,
    };
    hero.dataset.phase = "blocked";
    const blocked = { video: getComputedStyle(video).display };
    hero.dataset.camera = "on";
    delete hero.dataset.phase;
    const live = { video: getComputedStyle(video).display };
    return { starting, blocked, live };
  });

  expect(displays).toEqual({
    starting: { video: "block", overlay: "none" },
    blocked: { video: "none" },
    live: { video: "block" },
  });
});

test("primary navigation uses navigation semantics and one current page @a11y", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=nav&route=/library/paper-id");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Library" })).toHaveAttribute("aria-current", "page");
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await nav.getByRole("button", { name: "Insights" }).click();
  await expect(page.getByTestId("route")).toHaveText("/insights");
  await expect(nav.getByRole("button", { name: "Insights" })).toHaveAttribute("aria-current", "page");
});

test("answer content remains the accessible name of an interactive segment @a11y", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=answer");
  await expect(page.getByRole("button", { name: "x + 1", exact: true })).toBeVisible();
});

test("runtime route failures and unknown URLs have distinct recovery UI", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=route-errors&route=/boom");
  await expect(page.getByRole("heading", { name: "This page could not open" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload page" })).toBeVisible();

  await page.goto("/tests/browser/index.html?view=route-errors&route=/unknown");
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  await expect(page.getByText("This page could not open")).toHaveCount(0);
});

test("review mark radios follow native keyboard behavior and closed review is absent @a11y", async ({ page }) => {
  await page.goto("/tests/browser/index.html?view=review");
  const selected = page.getByRole("radio", { name: "1", exact: true });
  await expect(selected).toBeChecked();
  await selected.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __markChoice?: number }).__markChoice)).toBe(2);

  await page.goto("/tests/browser/index.html?view=review&scenario=closed");
  await expect(page.getByRole("region", { name: "Review paper" })).toHaveCount(0);
  await expect(page.getByText("Question 1")).toHaveCount(0);
});
