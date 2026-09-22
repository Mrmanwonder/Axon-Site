export type AnalyticsConsent = "granted" | "denied" | null;

type PostHogClient = {
  init: (key: string, options?: Record<string, unknown>) => void;
  capture?: (event: string, properties?: Record<string, unknown>) => void;
  opt_in_capturing?: () => void;
  opt_out_capturing?: () => void;
};

declare global {
  interface Window { posthog?: PostHogClient }
}

const DEFAULT_KEY = "phc_CNqB29H3LU4EQvd9yg7r3mb4pPdMAVGzjJQzPB6HZzF6";
const DEFAULT_HOST = "https://us.i.posthog.com";
const DEFAULT_ASSET_HOST = "https://us-assets.i.posthog.com";
const CONSENT_KEY = "axon.analytics-consent.v1";
export const ANALYTICS_CONSENT_EVENT = "axon:analytics-consent";

let started = false;

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  const value: Exclude<AnalyticsConsent, null> = granted ? "granted" : "denied";
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* preference still applies for this page */ }

  if (granted) {
    if (started) window.posthog?.opt_in_capturing?.();
    else initAnalytics();
  } else {
    window.posthog?.opt_out_capturing?.();
  }

  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: { granted } }));
}

/**
 * Browser-only PostHog bootstrap.
 *
 * PostHog is optional analytics, not a prerequisite for Axon. This function is
 * intentionally inert unless the user has granted the separate analytics
 * choice stored above. Student names, email addresses, paper/answer text,
 * auth tokens, raw database IDs and uploaded document data must never be added
 * to custom analytics events.
 */
export function initAnalytics() {
  if (started || typeof window === "undefined" || getAnalyticsConsent() !== "granted") return;
  started = true;

  const key = import.meta.env.VITE_POSTHOG_KEY || DEFAULT_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || DEFAULT_HOST;
  const assetHost = import.meta.env.VITE_POSTHOG_ASSET_HOST || DEFAULT_ASSET_HOST;
  if (!key) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = assetHost + "/static/array.js";
  script.onload = () => {
    // The choice may have been withdrawn while the script was in flight.
    if (getAnalyticsConsent() !== "granted") return;
    window.posthog?.init(key, {
      api_host: apiHost,
      ui_host: "https://us.posthog.com",
      autocapture: true,
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_exceptions: true,
      session_recording: {
        maskAllInputs: true,
        maskAllText: true,
      },
      persistence: "localStorage+cookie",
      loaded: () => {
        document.documentElement.dataset.analytics = "ready";
      },
    });
  };
  script.onerror = () => {
    document.documentElement.dataset.analytics = "unavailable";
  };
  document.head.appendChild(script);
}
