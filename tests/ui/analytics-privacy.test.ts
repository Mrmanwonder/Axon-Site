import { expect, test } from "vitest";
import { POSTHOG_PRIVACY_CONFIG, filterSensitiveAnalyticsEvent, hasSensitiveAuthCallback, captureUploadTelemetry } from "../../src/ui/lib/analytics";

const event = (name: string, url: string, extra: Record<string, unknown> = {}) => ({
  event: name,
  properties: { "$current_url": url, ...extra },
});

test("Library autocapture is rejected before PostHog ingestion", () => {
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

test("coarse Library pageviews remain allowed and public autocapture is untouched", () => {
  const pageview = event("$pageview", "https://axonstudy.online/library");
  const publicClick = event("$autocapture", "https://axonstudy.online/privacy", { "$el_text": "Privacy" });

  expect(filterSensitiveAnalyticsEvent(pageview)).toEqual(pageview);
  expect(filterSensitiveAnalyticsEvent(publicClick)).toEqual(publicClick);
});


test("analytics strips query strings and fragments from captured URLs", () => {
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
