import { afterEach, beforeEach, expect, test } from "vitest";
import {
  POSTHOG_PRIVACY_CONFIG, filterSensitiveAnalyticsEvent, hasSensitiveAuthCallback, captureUploadTelemetry,
  setAnalyticsAudience, getAnalyticsAudience, setAnalyticsConsent, initAnalytics,
  audienceForGate, audienceForOnboardingStep,
} from "../../src/ui/lib/analytics";

// Library and URL filtering is exercised as a parent surface, the only audience
// that still sends pageviews. Every test starts and ends with the default.
beforeEach(() => setAnalyticsAudience("unknown"));
afterEach(() => setAnalyticsAudience("unknown"));

const event = (name: string, url: string, extra: Record<string, unknown> = {}) => ({
  event: name,
  properties: { "$current_url": url, ...extra },
});

test("Library autocapture is rejected before PostHog ingestion", () => {
  setAnalyticsAudience("parent");
  const rawQuery = "private-answer-token-that-must-never-leave";
  expect(filterSensitiveAnalyticsEvent(
    event("$autocapture", "https://axonstudy.online/library", { "$el_text": rawQuery }),
  )).toBeNull();
  expect(filterSensitiveAnalyticsEvent(
    event("$copy_autocapture", "https://axonstudy.online/library/paper-1", { "$selected_content": rawQuery }),
  )).toBeNull();
  expect(filterSensitiveAnalyticsEvent(
    event("$rageclick", "https://axonstudy.online/library", { "$el_text": rawQuery }),
  )).toBeNull();
  expect(filterSensitiveAnalyticsEvent(
    event("$dead_click", "https://axonstudy.online/library", { "$el_text": rawQuery }),
  )).toBeNull();
});

test("on a parent surface coarse pageviews remain allowed and autocapture is dropped everywhere", () => {
  setAnalyticsAudience("parent");
  const pageview = event("$pageview", "https://axonstudy.online/library");
  const publicClick = event("$autocapture", "https://axonstudy.online/privacy", { "$el_text": "Privacy" });

  expect(filterSensitiveAnalyticsEvent(pageview)).toEqual(pageview);
  expect(filterSensitiveAnalyticsEvent(publicClick)).toBeNull();
});


test("analytics strips query strings and fragments from captured URLs", () => {
  setAnalyticsAudience("parent");
  const filtered = filterSensitiveAnalyticsEvent(event(
    "$pageview",
    "https://axonstudy.online/#access_token=secret&refresh_token=secret",
    { "$referrer": "https://accounts.example.test/callback?code=secret" },
  ));
  expect(filtered?.properties?.["$current_url"]).toBe("https://axonstudy.online/");
  expect(filtered?.properties?.["$referrer"]).toBe("https://accounts.example.test/callback");
  expect(JSON.stringify(filtered)).not.toContain("secret");
});

test("analytics bootstrap fails closed on OAuth credential fragments", () => {
  expect(hasSensitiveAuthCallback("", "#access_token=a&refresh_token=b&provider_token=c")).toBe(true);
  expect(hasSensitiveAuthCallback("", "#token_hash=a&type=magiclink")).toBe(true);
  expect(hasSensitiveAuthCallback("?code=pkce-secret", "")).toBe(true);
  expect(hasSensitiveAuthCallback("?billing=success", "#section=privacy")).toBe(false);
  expect(hasSensitiveAuthCallback("", "")).toBe(false);
});

test("replay masking uses options PostHog actually honours (maskAllText is not one)", () => {
  const rec = POSTHOG_PRIVACY_CONFIG.session_recording as Record<string, unknown>;
  expect(rec.maskAllInputs).toBe(true);
  expect(rec.maskTextSelector).toBe("*");
  expect(String(rec.blockSelector)).toMatch(/\bimg\b/);
  expect(String(rec.blockSelector)).toMatch(/\bcanvas\b/);
  expect("maskAllText" in rec).toBe(false);
  expect(POSTHOG_PRIVACY_CONFIG.mask_all_text).toBe(true);
  expect(POSTHOG_PRIVACY_CONFIG.mask_all_element_attributes).toBe(true);
  expect(POSTHOG_PRIVACY_CONFIG.opt_out_capturing_by_default).toBe(true);
});

test("paper send telemetry checks consent at emission and strips private properties", () => {
  const consentKey = "axon.analytics-consent.v1";
  const oldConsent = localStorage.getItem(consentKey);
  const oldPosthog = window.posthog;
  const calls: unknown[] = [];
  window.posthog = { init() {}, capture: (event, properties) => { calls.push({ event, properties }); } };
  try {
    localStorage.removeItem(consentKey);
    captureUploadTelemetry("paper_send_completed", { page_count: 10 });
    localStorage.setItem(consentKey, "denied");
    captureUploadTelemetry("paper_send_failed", { failure_stage: "intent" });
    expect(calls).toHaveLength(0);
    localStorage.setItem(consentKey, "granted");
    // Granted, but the audience is not yet known: fail closed.
    captureUploadTelemetry("paper_send_completed", { page_count: 10 });
    expect(calls).toHaveLength(0);
    // Declare the audience while the choice is denied, so this unit test does
    // not bootstrap the real SDK loader; emission re-checks consent anyway.
    localStorage.setItem(consentKey, "denied");
    setAnalyticsAudience("student");
    localStorage.setItem(consentKey, "granted");
    captureUploadTelemetry("private-event", { page_count: 10 });
    captureUploadTelemetry("paper_send_completed", {
      page_count: 10, total_bytes: 42, mode: "legacy",
      student_id: "private", key: "private", url: "private", answer: "private",
      object_count: Number.POSITIVE_INFINITY,
    });
    expect(calls).toEqual([{ event: "paper_send_completed", properties: { page_count: 10, total_bytes: 42, mode: "legacy" } }]);
    localStorage.setItem(consentKey, "denied");
    captureUploadTelemetry("paper_send_failed", { failure_stage: "transfer" });
    expect(calls).toHaveLength(1);
  } finally {
    window.posthog = oldPosthog;
    if (oldConsent === null) localStorage.removeItem(consentKey);
    else localStorage.setItem(consentKey, oldConsent);
  }
});

// ── AXO-217 (council D2): no behavioural tracking, fail closed ──────────────

test("behavioural capture is off in the PostHog config for every audience", () => {
  expect(POSTHOG_PRIVACY_CONFIG.autocapture).toBe(false);
  expect(POSTHOG_PRIVACY_CONFIG.capture_pageleave).toBe(false);
  expect(POSTHOG_PRIVACY_CONFIG.disable_session_recording).toBe(true);
  expect(POSTHOG_PRIVACY_CONFIG.capture_dead_clicks).toBe(false);
  expect(POSTHOG_PRIVACY_CONFIG.rageclick).toBe(false);
  expect(POSTHOG_PRIVACY_CONFIG.capture_heatmaps).toBe(false);
  expect(POSTHOG_PRIVACY_CONFIG.capture_performance).toBe(false);
  expect(POSTHOG_PRIVACY_CONFIG.disable_surveys).toBe(true);
  expect(POSTHOG_PRIVACY_CONFIG.before_send).toBe(filterSensitiveAnalyticsEvent);
});

const BEHAVIOURAL = [
  "$autocapture", "$rageclick", "$dead_click", "$copy_autocapture", "$pageleave",
  "$snapshot", "$heatmap", "$web_vitals", "$opt_in", "$identify", "$set", "survey shown",
];

test("in a student session only the allowlisted reliability events are sent", () => {
  setAnalyticsAudience("student");
  const url = "https://axonstudy.online/scan";
  for (const name of [...BEHAVIOURAL, "$pageview", "$exception"]) {
    expect(filterSensitiveAnalyticsEvent(event(name, url)), name).toBeNull();
  }
  const send = event("paper_send_completed", url, { page_count: 3 });
  expect(filterSensitiveAnalyticsEvent(send)).toEqual(send);
  expect(filterSensitiveAnalyticsEvent({ properties: {} })).toBeNull();
});

test("on a parent surface pageviews and exceptions pass and behavioural events do not", () => {
  setAnalyticsAudience("parent");
  const url = "https://axonstudy.online/";
  for (const name of BEHAVIOURAL) expect(filterSensitiveAnalyticsEvent(event(name, url)), name).toBeNull();
  expect(filterSensitiveAnalyticsEvent(event("$pageview", url))).not.toBeNull();
  expect(filterSensitiveAnalyticsEvent(event("$exception", url))).not.toBeNull();
});

test("before the audience is known nothing is sent at all", () => {
  expect(getAnalyticsAudience()).toBe("unknown");
  for (const name of [...BEHAVIOURAL, "$pageview", "$exception", "paper_send_completed"]) {
    expect(filterSensitiveAnalyticsEvent(event(name, "https://axonstudy.online/")), name).toBeNull();
  }
});

test("app gates and onboarding steps map to the conservative audience", () => {
  expect(audienceForGate("loading", false)).toBe("unknown");
  expect(audienceForGate("boot_error", true)).toBe("unknown");
  expect(audienceForGate("choose_profile", false)).toBe("unknown");
  expect(audienceForGate("ready", false)).toBe("unknown");
  expect(audienceForGate("ready", true)).toBe("student");
  expect(audienceForGate("onboarding", false)).toBeNull();
  for (const step of ["account", "otp", "nameOnly", "consent", "plan", "student"]) {
    expect(audienceForOnboardingStep(step), step).toBe("parent");
  }
  expect(audienceForOnboardingStep("landing")).toBe("unknown");
  expect(audienceForOnboardingStep("studentDead")).toBe("unknown");
  expect(audienceForOnboardingStep("firstRun")).toBe("student");
  expect(audienceForOnboardingStep("firstUpload")).toBe("student");
  expect(audienceForOnboardingStep("someFutureStep")).toBe("unknown");
});

test("PostHog does not load until the audience is known, even with analytics allowed", () => {
  const consentKey = "axon.analytics-consent.v1";
  const oldConsent = localStorage.getItem(consentKey);
  const oldPosthog = window.posthog;
  const scripts = () => document.head.querySelectorAll("script[data-axon-posthog]");
  try {
    delete window.posthog;
    setAnalyticsConsent(true);
    initAnalytics();
    expect(scripts()).toHaveLength(0);
    expect(window.posthog).toBeUndefined();

    setAnalyticsAudience("student");
    expect(scripts()).toHaveLength(1);
    const stub = window.posthog as unknown as { _i: [string, Record<string, unknown>][] };
    const [, options] = stub._i[0];
    expect(options.autocapture).toBe(false);
    expect(options.capture_pageleave).toBe(false);
    expect(options.disable_session_recording).toBe(true);
    expect(options.opt_out_capturing_by_default).toBe(true);
  } finally {
    scripts().forEach((s) => (s as HTMLScriptElement).onerror?.(new Event("error")));
    window.posthog = oldPosthog;
    if (oldConsent === null) localStorage.removeItem(consentKey);
    else localStorage.setItem(consentKey, oldConsent);
  }
});
