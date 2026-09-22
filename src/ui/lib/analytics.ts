export type AnalyticsConsent = "granted" | "denied" | null;

type PostHogClient = {
  init: (key: string, options?: Record<string, unknown>) => void;
  capture?: (event: string, properties?: Record<string, unknown>) => void;
  opt_in_capturing?: () => void;
  opt_out_capturing?: () => void;
};

type PostHogBootstrap = PostHogClient & {
  __SV?: number;
  _i?: unknown[][];
};

declare global {
  interface Window { posthog?: PostHogClient }
}

const DEFAULT_KEY = "phc_CNqB29H3LU4EQvd9yg7r3mb4pPdMAVGzjJQzPB6HZzF6";
const DEFAULT_HOST = "https://us.i.posthog.com";
const DEFAULT_ASSET_HOST = "https://us-assets.i.posthog.com";
const CONSENT_KEY = "axon.analytics-consent.v1";
export const ANALYTICS_CONSENT_EVENT = "axon:analytics-consent";

const STUB_METHODS = [
  "capture",
  "opt_in_capturing",
  "opt_out_capturing",
] as const;

let state: "idle" | "loading" | "ready" = "idle";

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
    if (state === "ready") window.posthog?.opt_in_capturing?.();
    else initAnalytics();
  } else {
    // This also works while the SDK is loading: our bootstrap stub queues the
    // opt-out call and PostHog processes it once array.js is ready.
    window.posthog?.opt_out_capturing?.();
  }

  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: { granted } }));
}

/**
 * Install the small queue PostHog's array.js loader expects.
 *
 * The supported PostHog snippet calls init on a stub first and only then loads
 * array.js. Loading array.js and hoping it creates window.posthog is backwards:
 * there is no init queue for the SDK to consume. We only stub methods Axon uses.
 */
function installPostHogStub(): PostHogBootstrap {
  const existing = window.posthog as PostHogBootstrap | undefined;
  if (existing?.__SV === 1 && Array.isArray(existing._i)) return existing;

  const queue = [] as unknown[] as PostHogBootstrap & unknown[];
  queue.__SV = 1;
  queue._i = [];
  queue.init = (key: string, options: Record<string, unknown> = {}) => {
    for (const method of STUB_METHODS) {
      (queue as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
        queue.push([method, ...args]);
      };
    }
    queue._i!.push([key, options]);
  };

  window.posthog = queue;
  return queue;
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
  if (state !== "idle" || typeof window === "undefined" || getAnalyticsConsent() !== "granted") return;

  const key = import.meta.env.VITE_POSTHOG_KEY || DEFAULT_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || DEFAULT_HOST;
  const assetHost = import.meta.env.VITE_POSTHOG_ASSET_HOST || DEFAULT_ASSET_HOST;
  if (!key) return;

  state = "loading";
  document.documentElement.dataset.analytics = "loading";

  const posthog = installPostHogStub();

  // Default to opted out even though this code path only starts after consent.
  // That makes a consent change while the remote script is in flight safe.
  posthog.init(key, {
    api_host: apiHost,
    ui_host: "https://us.posthog.com",
    defaults: "2026-05-30",
    autocapture: true,
    capture_pageview: "history_change",
    capture_pageleave: true,
    capture_exceptions: true,
    opt_out_capturing_by_default: true,
    session_recording: {
      maskAllInputs: true,
      maskAllText: true,
    },
    persistence: "localStorage+cookie",
    loaded: () => {
      state = "ready";
      if (getAnalyticsConsent() === "granted") {
        window.posthog?.opt_in_capturing?.();
        document.documentElement.dataset.analytics = "ready";
      } else {
        window.posthog?.opt_out_capturing?.();
        document.documentElement.dataset.analytics = "disabled";
      }
    },
  });

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.axonPosthog = "true";
  script.src = assetHost + "/static/array.js";
  script.onerror = () => {
    state = "idle";
    document.documentElement.dataset.analytics = "unavailable";
    script.remove();

    // A failed load leaves only our queue stub behind. Drop it so a later
    // consented retry starts with one clean init call rather than replaying an
    // old queue twice.
    const current = window.posthog as PostHogBootstrap | undefined;
    if (current?.__SV === 1 && Array.isArray(current._i)) delete window.posthog;
  };
  document.head.appendChild(script);
}
