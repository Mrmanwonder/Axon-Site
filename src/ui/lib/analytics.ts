type PostHogClient = {
  init: (key: string, options?: Record<string, unknown>) => void;
  capture?: (event: string, properties?: Record<string, unknown>) => void;
};

declare global {
  interface Window { posthog?: PostHogClient }
}

const DEFAULT_KEY = "phc_CNqB29H3LU4EQvd9yg7r3mb4pPdMAVGzjJQzPB6HZzF6";
const DEFAULT_HOST = "https://us.i.posthog.com";
const DEFAULT_ASSET_HOST = "https://us-assets.i.posthog.com";

let started = false;

/**
 * Browser-only PostHog bootstrap.
 *
 * The project token is intentionally public client configuration, not a secret.
 * Do not add service-role keys or backend credentials here.
 *
 * Privacy rule: custom events must never include student names, email addresses,
 * paper/answer text, auth tokens, raw database IDs, or uploaded document data.
 */
export function initAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;

  const key = import.meta.env.VITE_POSTHOG_KEY || DEFAULT_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || DEFAULT_HOST;
  const assetHost = import.meta.env.VITE_POSTHOG_ASSET_HOST || DEFAULT_ASSET_HOST;
  if (!key) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `${assetHost}/static/array.js`;
  script.onload = () => {
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
