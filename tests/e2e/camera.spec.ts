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

test("mobile Scan keeps the navbar visible without stretching the resume draft", async ({ page }) => {
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
          <div class="scanhero" data-camera="on">
            <div class="drafttoast" style="transform: translateY(0)">
              <div class="dh"></div>
              <div class="row2">
                <div class="ic"></div>
                <div class="b"><div class="t1">Resume draft</div><div class="t2">2 pages added</div></div>
                <button class="go">Resume</button>
              </div>
            </div>
            <div class="scanctrls"><button class="sidebtn"></button><button class="shutter"></button></div>
          </div>
        </section>
        <nav class="tabdock"><div class="tabbar"><div class="refractlayer"><button class="tab">Scan</button></div></div></nav>
      </main>`;

    const hero = document.querySelector<HTMLElement>(".scanhero")!;
    const toast = document.querySelector<HTMLElement>(".drafttoast")!;
    const controls = document.querySelector<HTMLElement>(".scanctrls")!;
    const dock = document.querySelector<HTMLElement>(".tabdock")!;
    const navTop = dock.getBoundingClientRect().top;
    const withoutTray = {
      dockDisplay: getComputedStyle(dock).display,
      heroBottom: hero.getBoundingClientRect().bottom,
      controlsBottom: controls.getBoundingClientRect().bottom,
      navTop,
      toastHeight: toast.getBoundingClientRect().height,
      toastBottomGap: hero.getBoundingClientRect().bottom - toast.getBoundingClientRect().bottom,
    };

    const tray = document.createElement("section");
    tray.className = "tray";
    tray.innerHTML = '<div class="trayscroll"></div><div class="traybar"><span class="cnt">2 pages</span></div>';
    hero.style.transition = "none";
    document.querySelector('[data-screen="scan"]')!.append(tray);

    return {
      withoutTray,
      withTray: {
        heroBottom: hero.getBoundingClientRect().bottom,
        trayTop: tray.getBoundingClientRect().top,
        trayBottom: tray.getBoundingClientRect().bottom,
        navTop: dock.getBoundingClientRect().top,
      },
    };
  });

  expect(layout.withoutTray.dockDisplay).not.toBe("none");
  expect(layout.withoutTray.toastHeight).toBeLessThan(120);
  expect(layout.withoutTray.toastBottomGap).toBeCloseTo(96, 0);
  expect(layout.withoutTray.heroBottom).toBeLessThanOrEqual(layout.withoutTray.navTop + 1);
  expect(layout.withoutTray.controlsBottom).toBeLessThanOrEqual(layout.withoutTray.navTop + 1);
  expect(layout.withTray.heroBottom).toBeLessThanOrEqual(layout.withTray.trayTop + 1);
  expect(layout.withTray.trayBottom).toBeLessThanOrEqual(layout.withTray.navTop + 1);
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
