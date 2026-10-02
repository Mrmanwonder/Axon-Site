import { expect, test, type Browser, type BrowserContext, type Page, type Route } from "@playwright/test";

const origin = "http://127.0.0.1:5175";
const SAMPLES = 5;
const AUTHORITY_DELAY_MS = 25;
const WARM_DATA_DELAY_MS = 750;
const WARM_PAINT_BUDGET_MS = 3000;

const student = {
  id: "10000000-0000-0000-0000-000000000001",
  first_name: "Sam",
  guardian_id: "guardian",
  class_level: 11,
  board: "CAIE",
  subjects: ["Physics"],
  programme_id: null,
  stage_id: null,
};
const paper = {
  id: "20000000-0000-0000-0000-000000000001",
  type: "unit_test",
  tier: "tier_1",
  date_taken: "2026-09-12",
  created_at: "2026-09-12T00:00:00Z",
  subject: "Physics",
  paper_page: [{ count: 1 }],
  student_attempt: [{ count: 1 }],
};
const progress = [{
  paper_id: paper.id,
  status: "committed",
  status_reason: null,
  started_at: "2026-09-12T00:00:00Z",
  pages_total: 1,
  pages_done: 1,
  questions_total: 1,
  questions_done: 1,
  questions_needing_you: 0,
}];

type TraceRow = { at: number; key: string; doneAt?: number };
type BackendOptions = {
  startedAt: number;
  trace: TraceRow[];
  authorityDelayMs?: number;
  dataDelayMs?: number;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function summary(values: number[]) {
  return {
    p50: Math.round(percentile(values, 0.50)),
    p95: Math.round(percentile(values, 0.95)),
    min: Math.round(Math.min(...values)),
    max: Math.round(Math.max(...values)),
  };
}

// This fixture deliberately uses an unsigned JWT while REST is mocked. A unique
// per-run subject makes any stray Realtime connection attributable in the live
// logs (AXO-113), instead of an anonymous "guardian".
const runMarker = process.env.GITHUB_RUN_ID
  ? `performance-e2e-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`
  : `performance-e2e-local-${Date.now()}`;

function authToken() {
  const expires = Math.floor(Date.now() / 1000) + 86400;
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
      sub: runMarker,
      exp: expires,
      role: "authenticated",
      session_id: runMarker,
    })}.signature`,
    refresh_token: "test-only",
    expires_at: expires,
    expires_in: 86400,
    token_type: "bearer",
    user: {
      id: runMarker,
      aud: "authenticated",
      email: "perf@example.test",
      app_metadata: {},
      user_metadata: {},
    },
  };
}

async function seedAuthenticatedContext(context: BrowserContext) {
  const token = authToken();
  // Mark the page before application boot so watchLibrary never opens Realtime
  // with the unsigned fixture token (the same boundary as production.spec.ts).
  await context.addInitScript(() => {
    Object.defineProperty(globalThis, "__AXON_E2E_DISABLE_REALTIME__", {
      value: "production-fixture",
      configurable: false,
      writable: false,
    });
  });
  await context.addInitScript(({ token }) => {
    localStorage.setItem("sb-dlgcqieyevoebefhcggi-auth-token", JSON.stringify(token));
    localStorage.setItem("axon.prefs.v1", JSON.stringify({
      theme: "dark",
      text_size: "m",
      reduce_motion: true,
      always_show_reasoning: false,
    }));
  }, { token });
}

function endpointKey(url: URL) {
  const marker = "/rest/v1/";
  const start = url.pathname.indexOf(marker);
  return start >= 0 ? url.pathname.slice(start + marker.length) : url.pathname;
}

function payloadFor(url: URL) {
  const key = endpointKey(url);
  if (key === "rpc/student_scope_state") {
    return { active: true, student_id: student.id, remaining_seconds: 1800 };
  }
  if (key === "rpc/set_student_scope") {
    return { active: true, student_id: student.id, remaining_seconds: 1800 };
  }
  if (key === "rpc/clear_student_scope") return true;

  if (key === "guardian") {
    return { id: "guardian", auth_user_id: runMarker, name: "Parent", contact: "perf@example.test" };
  }
  if (key === "student") return [student];
  if (key === "student_subject") {
    return [{
      student_id: student.id,
      subject: "Physics",
      subject_offering_id: null,
      selected_level: null,
      display_name_snapshot: "Physics",
      external_code_snapshot: null,
    }];
  }
  if (key === "paper") return [paper];
  if (key === "paper_progress") return progress;
  if (key === "app_preference") {
    return { theme: "dark", text_size: "m", reduce_motion: true, always_show_reasoning: false };
  }
  if (key === "consent_current") return [];
  if (key === "student_analytics_readiness") {
    return { papers_counted: 1, questions_counted: 1, has_enough_data: false };
  }
  if (key === "mark_loss_analytics") return [];
  if (key === "student_attempt") return [];
  if (key === "page_unreadable") return [];
  return [];
}

function isDataRead(key: string) {
  return [
    "paper", "paper_progress", "student_analytics_readiness",
    "mark_loss_analytics", "student_attempt", "page_unreadable",
  ].includes(key);
}

async function installBackend(context: BrowserContext, options: BackendOptions) {
  await context.route("https://*.supabase.co/rest/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const key = endpointKey(url);
    // Snapshot mutable measurement options at request start. Warm-cache samples
    // update the controller between navigations while earlier delayed reads may
    // still be settling.
    const startedAt = options.startedAt;
    const trace = options.trace;
    const authorityDelayMs = options.authorityDelayMs ?? 0;
    const dataDelayMs = options.dataDelayMs ?? authorityDelayMs;
    const row: TraceRow = { at: Date.now() - startedAt, key };
    trace.push(row);
    const delay = isDataRead(key) ? dataDelayMs : authorityDelayMs;
    if (delay) await sleep(delay);
    row.doneAt = Date.now() - startedAt;
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payloadFor(url)),
      });
    } catch (error) {
      // Warm-cache assertions intentionally navigate while delayed background
      // reads are still pending. Chromium may cancel one of those requests
      // before the synthetic backend resumes; that cancellation is not a
      // backend or rendering failure.
      if (error instanceof Error && error.message.includes("Route is already handled")) return;
      throw error;
    }
  });
}

async function resourceSnapshot(page: Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const initial = resources.filter(entry =>
      /\/assets\/.*\.(js|css)$|\/fonts\/.*\.woff2$/.test(new URL(entry.name, location.href).pathname)
    );
    return {
      readyAt: Math.round(performance.now()),
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      initialTransferBytes: Math.round(initial.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
      initialDecodedBytes: Math.round(initial.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0)),
      initialResources: initial.map(entry => ({
        path: new URL(entry.name, location.href).pathname,
        start: Math.round(entry.startTime),
        duration: Math.round(entry.duration),
        transfer: entry.transferSize,
      })),
    };
  });
}

async function coldSignedOut(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const started = Date.now();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /See exactly where the marks went/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "I’m a parent — set this up" })).toBeVisible();
  const snapshot = await resourceSnapshot(page);
  const wallMs = Date.now() - started;
  await context.close();
  return { wallMs, ...snapshot };
}

async function coldAuthenticated(browser: Browser) {
  const context = await browser.newContext();
  await seedAuthenticatedContext(context);
  const trace: TraceRow[] = [];
  const started = Date.now();
  await installBackend(context, {
    startedAt: started,
    trace,
    authorityDelayMs: AUTHORITY_DELAY_MS,
  });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Recent scans", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Physics · Class test/ })).toBeVisible();
  const snapshot = await resourceSnapshot(page);
  const wallMs = Date.now() - started;
  await context.close();
  return { wallMs, trace, ...snapshot };
}

async function populateWarmCache(page: Page, backend: BackendOptions) {
  backend.startedAt = Date.now();
  backend.trace = [];
  backend.authorityDelayMs = 0;
  backend.dataDelayMs = 0;
  await page.goto(`${origin}/library`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  // readThrough awaits its IndexedDB write before exposing the live result, so
  // this actual paper row is also the cache-population barrier for warm samples.
  await expect(page.getByRole("button", { name: /Physics · Class test/ })).toBeVisible();
}

test.describe("production startup performance @performance", () => {
  test.describe.configure({ mode: "serial" });

  test("records cold signed-out and returning-authenticated p50/p95", async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "Production performance baseline is pinned to Chromium.");

    const signedOut = [];
    const authenticated = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      signedOut.push(await coldSignedOut(browser));
      authenticated.push(await coldAuthenticated(browser));
    }

    const signedOutSummary = summary(signedOut.map(row => row.wallMs));
    const authSummary = summary(authenticated.map(row => row.wallMs));
    const authWaterfall = authenticated[authenticated.length - 1].trace;

    console.log("[AXO-66] cold-signed-out", JSON.stringify({
      samples: signedOut.map(row => row.wallMs),
      wall: signedOutSummary,
      browserReady: summary(signedOut.map(row => row.readyAt)),
      initialTransferBytes: signedOut.at(-1)?.initialTransferBytes,
      initialDecodedBytes: signedOut.at(-1)?.initialDecodedBytes,
      resources: signedOut.at(-1)?.initialResources,
    }));
    console.log("[AXO-66] cold-authenticated", JSON.stringify({
      simulatedAuthorityRttMs: AUTHORITY_DELAY_MS,
      samples: authenticated.map(row => row.wallMs),
      wall: authSummary,
      browserReady: summary(authenticated.map(row => row.readyAt)),
      waterfall: authWaterfall,
    }));

    expect(signedOutSummary.p95).toBeLessThan(5000);
    expect(authSummary.p95).toBeLessThan(5000);
    expect(authWaterfall.some(row => row.key === "guardian")).toBe(true);
    expect(authWaterfall.some(row => row.key === "student")).toBe(true);
    expect(authWaterfall.some(row => row.key === "student_subject")).toBe(true);
    expect(authWaterfall.some(row => row.key === "rpc/student_scope_state")).toBe(true);
  });

  test("records warm Home/Library cached paint and lazy Library route latency", async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "Production performance baseline is pinned to Chromium.");
    // Five Home and five Library samples intentionally hold data reads open to
    // prove cached paint precedes live reconciliation. Keep the per-sample
    // latency budgets strict while allowing the complete benchmark matrix to run.
    test.setTimeout(120_000);

    const context = await browser.newContext();
    await seedAuthenticatedContext(context);
    const page = await context.newPage();
    const backend: BackendOptions = {
      startedAt: Date.now(),
      trace: [],
      authorityDelayMs: 0,
      dataDelayMs: 0,
    };
    await installBackend(context, backend);
    await populateWarmCache(page, backend);

    const homeSamples: number[] = [];
    const librarySamples: number[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const homeTrace: TraceRow[] = [];
      let started = Date.now();
      backend.startedAt = started;
      backend.trace = homeTrace;
      backend.authorityDelayMs = AUTHORITY_DELAY_MS;
      backend.dataDelayMs = WARM_DATA_DELAY_MS;
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("link", { name: /Physics · Class test/ })).toBeVisible();
      homeSamples.push(Date.now() - started);
      expect(homeTrace.some(row => isDataRead(row.key) && row.doneAt === undefined)).toBe(true);

      const libraryTrace: TraceRow[] = [];
      started = Date.now();
      backend.startedAt = started;
      backend.trace = libraryTrace;
      backend.authorityDelayMs = AUTHORITY_DELAY_MS;
      backend.dataDelayMs = WARM_DATA_DELAY_MS;
      await page.goto(`${origin}/library`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Physics · Class test/ })).toBeVisible();
      librarySamples.push(Date.now() - started);
      expect(libraryTrace.some(row => isDataRead(row.key) && row.doneAt === undefined)).toBe(true);
    }

    // Route latency is measured after the application is already warm and
    // authorized. The route component itself is lazy, so the first visit is the
    // meaningful upper-bound; subsequent navigation should only get cheaper.
    const routeTrace: TraceRow[] = [];
    backend.startedAt = Date.now();
    backend.trace = routeTrace;
    backend.authorityDelayMs = 0;
    backend.dataDelayMs = 0;
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Recent scans", { exact: true })).toBeVisible();
    const before = await page.evaluate(() => performance.now());
    await page.getByRole("button", { name: /^Library/ }).click();
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    const after = await page.evaluate(() => performance.now());
    const routeMs = Math.round(after - before);
    const routeResources = await page.evaluate((startedAt) =>
      (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
        .filter(entry => entry.startTime >= startedAt && new URL(entry.name, location.href).pathname.endsWith(".js"))
        .map(entry => ({
          path: new URL(entry.name, location.href).pathname,
          start: Math.round(entry.startTime),
          duration: Math.round(entry.duration),
          transfer: entry.transferSize,
        })), before);

    console.log("[AXO-66] warm-cache", JSON.stringify({
      liveDataDelayMs: WARM_DATA_DELAY_MS,
      home: { samples: homeSamples, wall: summary(homeSamples) },
      library: { samples: librarySamples, wall: summary(librarySamples) },
      lazyLibraryRoute: { ms: routeMs, resources: routeResources },
    }));

    // The per-sample pending-read assertions above prove cache-first paint.
    // Whole-page timing also includes document/JS boot on a shared CI runner,
    // so gate that user-visible latency independently from synthetic network RTT.
    expect(summary(homeSamples).p95).toBeLessThan(WARM_PAINT_BUDGET_MS);
    expect(summary(librarySamples).p95).toBeLessThan(WARM_PAINT_BUDGET_MS);
    expect(routeMs).toBeLessThan(2000);
    await context.close();
  });
});
