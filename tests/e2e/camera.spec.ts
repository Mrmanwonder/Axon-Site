import { expect, test } from "@playwright/test";

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

test("camera startup stays renderable until iPhone playback becomes live", async ({ page }) => {
  await page.goto("/tests/browser/index.html");

  const displays = await page.evaluate(async () => {
    for (const href of ["/src/ui/styles/system.css", "/src/ui/styles/scanner.css"]) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = href;
      const loaded = new Promise<void>((resolve, reject) => {
        stylesheet.onload = () => resolve();
        stylesheet.onerror = () => reject(new Error("scanner stylesheet did not load"));
      });
      document.head.append(stylesheet);
      await loaded;
    }

    const hero = document.createElement("div");
    hero.className = "sc";
    hero.innerHTML = '<div class="sc-vf"><video id="scanVideo"></video><canvas id="scanOverlay"></canvas></div>';
    document.body.append(hero);
    const video = hero.querySelector("video")!;
    const overlay = hero.querySelector("canvas")!;

    hero.dataset.camera = "off";
    hero.dataset.phase = "starting";
    const starting = { video: getComputedStyle(video).display, overlay: getComputedStyle(overlay).display };
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

test("mobile camera screen is a column: top bar, camera, strip, bottom bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/index.html");

  const layout = await page.evaluate(async () => {
    const viewport = document.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    document.head.append(viewport);

    for (const href of [
      "/src/ui/styles/app.css",
      "/src/ui/styles/system.css",
      "/src/ui/styles/shell.css",
      "/src/ui/styles/scanner.css",
    ]) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = href;
      const loaded = new Promise<void>((resolve, reject) => {
        stylesheet.onload = () => resolve();
        stylesheet.onerror = () => reject(new Error(`${href} did not load`));
      });
      document.head.append(stylesheet);
      await loaded;
    }

    document.documentElement.classList.add("scanner-active");
    document.body.innerHTML = `
      <main class="app">
        <section class="view on" data-screen="scan">
          <div class="sc" data-camera="on">
            <div class="sc-top"><button class="sc-circ"></button><button class="sc-auto" data-on="true"><i></i>Auto</button><span class="sc-grow"></span><button class="sc-circ"></button><button class="sc-circ"></button></div>
            <div class="sc-vf"><video id="scanVideo"></video><canvas id="scanOverlay"></canvas>
              <div class="drafttoast" style="transform: translateY(0)"><div class="dh"></div><div class="row2"><div class="ic"></div><div class="b"><div class="t1">Resume draft</div><div class="t2">2 pages added</div></div><button class="go">Resume</button></div></div>
            </div>
            <div class="sc-strip" data-tone="neutral"><span class="g"></span><span class="t">Looking for the page</span></div>
            <div class="sc-dock"><span class="sc-stack-empty"></span><button class="sc-shutter"><span></span></button><button class="sc-done" disabled>Done</button></div>
          </div>
        </section>
        <nav class="tabdock"><div class="tabbar"><div class="refractlayer"><button class="tab">Scan</button></div></div></nav>
      </main>`;

    const rect = (selector: string) => {
      const r = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const dock = document.querySelector<HTMLElement>(".tabdock")!;
    const shutterStyle = getComputedStyle(document.querySelector<HTMLElement>(".sc-shutter")!);
    return {
      dockVisibility: getComputedStyle(dock).visibility,
      dockPointerEvents: getComputedStyle(dock).pointerEvents,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      sc: rect(".sc"), top: rect(".sc-top"), vf: rect(".sc-vf"), strip: rect(".sc-strip"), bar: rect(".sc-dock"),
      shutter: rect(".sc-shutter"),
      shutterRadius: shutterStyle.borderTopLeftRadius,
      toast: rect(".drafttoast"),
      circ: rect(".sc-circ"), auto: rect(".sc-auto"), done: rect(".sc-done"),
      blur: getComputedStyle(document.querySelector<HTMLElement>(".sc-vf")!).backdropFilter,
    };
  });

  expect(layout.dockVisibility).toBe("hidden");
  expect(layout.dockPointerEvents).toBe("none");
  expect(layout.sc.top).toBeCloseTo(0, 0);
  expect(layout.sc.bottom).toBeCloseTo(layout.viewportHeight, 0);
  // Reading order, top to bottom, with the camera taking the remaining room.
  expect(layout.top.bottom).toBeLessThanOrEqual(layout.vf.top + 1);
  expect(layout.vf.bottom).toBeLessThanOrEqual(layout.strip.top + 1);
  expect(layout.strip.bottom).toBeLessThanOrEqual(layout.bar.top + 1);
  expect(layout.bar.bottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.vf.height).toBeGreaterThan(layout.viewportHeight * 0.45);
  // The shutter is the navigation bar's capsule: 100x58, 32px shell.
  expect(layout.shutter.width).toBeCloseTo(100, 0);
  expect(layout.shutter.height).toBeCloseTo(58, 0);
  expect(layout.shutterRadius).toBe("32px");
  // 44px targets.
  for (const target of [layout.circ, layout.auto, layout.done]) {
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  // The resume toast stays inside the camera and is not stretched.
  expect(layout.toast.height).toBeLessThan(120);
  expect(layout.toast.top).toBeGreaterThanOrEqual(layout.vf.top);
  expect(layout.toast.bottom).toBeLessThanOrEqual(layout.vf.bottom);
});

test("a draft alert slides away while its saved pages remain available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/index.html");

  await page.evaluate(async () => {
    const viewport = document.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    document.head.append(viewport);

    for (const href of [
      "/src/ui/styles/app.css",
      "/src/ui/styles/system.css",
      "/src/ui/styles/shell.css",
      "/src/ui/styles/scanner.css",
    ]) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = href;
      const loaded = new Promise<void>((resolve, reject) => {
        stylesheet.onload = () => resolve();
        stylesheet.onerror = () => reject(new Error(`${href} did not load`));
      });
      document.head.append(stylesheet);
      await loaded;
    }

    document.documentElement.classList.add("scanner-active");
    document.body.innerHTML = `
      <main class="app">
        <section class="view on" data-screen="scan">
          <div id="draft-root" class="sc-vf" data-camera="on" style="height: 420px"></div>
        </section>
      </main>`;

    const drafts = await import("/src/scan/drafts.js");
    const draft = await drafts.createDraft({
      id: "saved-draft-test",
      studentId: "student-draft-test",
      paperType: null,
    });
    await drafts.addPage(draft, {
      blob: new Uint8Array([115, 97, 118, 101, 100]),
      quality: { verdict: "ok", reasons: [] },
    });

    const { mountScanDraftsTest } = await import("/tests/browser/scan-drafts.tsx");
    mountScanDraftsTest(document.querySelector<HTMLElement>("#draft-root")!, {
      id: draft.id,
      pages: draft.pages.length,
    });
  });

  const alert = page.locator(".drafttoast");
  await expect(alert).toBeVisible();
  const alertBox = await alert.boundingBox();
  if (!alertBox) throw new Error("draft alert has no layout box");
  await page.mouse.move(alertBox.x + 8, alertBox.y + alertBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(alertBox.x + 8, alertBox.y + alertBox.height + 72, { steps: 4 });
  await page.mouse.up();
  await expect(alert).toHaveCount(0);

  const persisted = await page.evaluate(async () => {
    const drafts = await import("/src/scan/drafts.js");
    const draft = await drafts.readDraft("saved-draft-test");
    const list = await drafts.listDrafts("student-draft-test");
    return { pages: draft?.pages.length ?? 0, listed: list.map((item) => item.id) };
  });
  expect(persisted).toEqual({ pages: 1, listed: ["saved-draft-test"] });

  await page.evaluate(async () => {
    const state = (window as typeof window & {
      __scanDraftsTest?: { unmount: () => void };
    }).__scanDraftsTest;
    state?.unmount();
    const { mountScanDraftsTest } = await import("/tests/browser/scan-drafts.tsx");
    mountScanDraftsTest(document.querySelector<HTMLElement>("#draft-root")!, {
      id: "saved-draft-test",
      pages: 1,
    });
  });
  await expect(page.locator(".drafttoast")).toHaveCount(0);
});

test("camera rendering follows video frames instead of a 120Hz display", async ({ page }) => {
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

test("leaving Scan releases the old surface and re-entry attaches the new video", async ({ page }) => {
  await page.goto("/tests/browser/index.html");

  const result = await page.evaluate(async () => {
    const scan = await import("/src/scan/ui.js");
    await scan.initScanUI({ student: { id: "camera-test" }, guardian: { id: "guardian-test" } });

    const makeVideo = () => {
      const video = document.createElement("video");
      Object.defineProperty(video, "srcObject", { value: null, writable: true });
      video.play = async () => {};
      video.requestVideoFrameCallback = (() => 1) as typeof video.requestVideoFrameCallback;
      video.cancelVideoFrameCallback = (() => {}) as typeof video.cancelVideoFrameCallback;
      return video;
    };
    const makeStream = () => ({ getTracks: () => [{ stop() {} }], getVideoTracks: () => [] });

    const firstVideo = makeVideo();
    const firstStream = makeStream();
    scan.attachSurface(firstVideo, document.createElement("canvas"));
    await scan.setScanVisible(true, firstStream as unknown as MediaStream);
    const firstAttached = firstVideo.srcObject === firstStream;

    scan.setScanVisible(false);
    scan.detachSurface();
    const firstDetached = firstVideo.srcObject === null;

    const secondVideo = makeVideo();
    const secondStream = makeStream();
    scan.attachSurface(secondVideo, document.createElement("canvas"));
    await scan.setScanVisible(true, secondStream as unknown as MediaStream);
    const secondAttached = secondVideo.srcObject === secondStream;
    scan.setScanVisible(false);
    scan.detachSurface();

    return { firstAttached, firstDetached, secondAttached };
  });

  expect(result).toEqual({ firstAttached: true, firstDetached: true, secondAttached: true });
});
