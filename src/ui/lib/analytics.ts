import { sanitizeUploadTelemetry } from '../../scan/upload-telemetry.js';
export type AnalyticsConsent = "granted" | "denied" | null;

/**
 * Who is using the page right now, as far as analytics is concerned.
 *
 * - `unknown`: not yet established (boot, profile choice, boot error, the
 *   public landing step a student may be reading, legal pages outside the app
 *   shell). Analytics does not start, and nothing is sent.
 * - `student`: a student profile is active (Student Mode). Only the explicitly
 *   consented, allowlisted reliability events are sent: no pageviews, no
 *   page-leave, no autocapture, no replay, no exceptions.
 * - `parent`: a guardian-only step (account, verification, consent, plan,
 *   creating the student profile). Coarse pageviews, exceptions and the
 *   allowlisted events only; still no autocapture, page-leave or replay.
 *
 * The default is `unknown`, so analytics fails closed until the app declares
 * the audience (AXO-217, council D2: "Never: behavioural tracking").
 */
export type AnalyticsAudience = "unknown" | "student" | "parent";

export type AnalyticsEvent = {
  event?: string;
  properties?: Record<string, unknown>;
};

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
let audience: AnalyticsAudience = "unknown";

/** Reliability events the app sends on purpose, with a property allowlist. */
const RELIABILITY_EVENTS: ReadonlySet<string> = new Set(["paper_send_completed", "paper_send_failed"]);

/**
 * Everything PostHog may ingest, per audience. An allowlist rather than a
 * blocklist: an SDK upgrade that adds a new automatic event ($web_vitals,
 * $heatmap, $dead_click, a future one) is dropped by default instead of
 * reaching PostHog from a minor's session.
 */
const ALLOWED_EVENTS: Record<AnalyticsAudience, ReadonlySet<string>> = {
  unknown: new Set(),
  student: RELIABILITY_EVENTS,
  parent: new Set(["$pageview", "$exception", ...RELIABILITY_EVENTS]),
};

/** Onboarding steps only a guardian completes. Everything else in onboarding
    (the public landing, the "ask a parent" dead end, the student's first-run
    screens) is either unknown or the student's own. */
const GUARDIAN_ONBOARDING_STEPS: ReadonlySet<string> = new Set([
  "account", "otp", "nameOnly", "consent", "plan", "student",
]);
const STUDENT_ONBOARDING_STEPS: ReadonlySet<string> = new Set(["firstRun", "firstUpload"]);

/**
 * The audience for an app-shell gate. `null` means onboarding is showing and
 * owns the decision. Any active student profile makes it a student session,
 * whatever else is true; every other state is unknown.
 */
export function audienceForGate(gate: string, hasStudent: boolean): AnalyticsAudience | null {
  if (gate === "onboarding") return null;
  return gate === "ready" && hasStudent ? "student" : "unknown";
}

/** The audience for one onboarding step. */
export function audienceForOnboardingStep(step: string): AnalyticsAudience {
  if (STUDENT_ONBOARDING_STEPS.has(step)) return "student";
  if (GUARDIAN_ONBOARDING_STEPS.has(step)) return "parent";
  return "unknown";
}

export function getAnalyticsAudience(): AnalyticsAudience {
  return audience;
}

/**
 * Declare who is using the page. Called by the app shell (a student profile
 * is active) and by onboarding (a guardian-only step), and reset to `unknown`
 * when either unmounts. Analytics starts only once the audience is known and
 * the separate analytics choice is granted.
 */
export function setAnalyticsAudience(next: AnalyticsAudience): void {
  audience = next;
  if (next !== "unknown" && getAnalyticsConsent() === "granted") initAnalytics();
}

const PRIVATE_LIBRARY_AUTOCAPTURE_EVENTS = new Set([
  "$autocapture",
  "$copy_autocapture",
  "$rageclick",
  "$dead_click",
]);

function coarseAnalyticsUrl(value: string): string {
  try {
    const url = new URL(value, "https://axonstudy.online");
    if (url.protocol !== "http:" && url.protocol !== "https:") return value;
    return value.startsWith("/") ? url.pathname : url.origin + url.pathname;
  } catch {
    return value;
  }
}

function sanitizeAnalyticsEventUrls(event: AnalyticsEvent): AnalyticsEvent {
  if (!event.properties) return event;
  let changed = false;
  const properties = { ...event.properties };
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== "string" || !/(?:url|referrer)$/i.test(key)) continue;
    const coarse = coarseAnalyticsUrl(value);
    if (coarse !== value) {
      properties[key] = coarse;
      changed = true;
    }
  }
  return changed ? { ...event, properties } : event;
}

export function hasSensitiveAuthCallback(
  search = typeof window === "undefined" ? "" : window.location.search,
  fragment = typeof window === "undefined" ? "" : window.location.hash,
): boolean {
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  const hash = new URLSearchParams(fragment.replace(/^#/, ""));
  const fragmentKeys = ["access_token", "refresh_token", "provider_token", "token_hash"];
  return query.has("code") || fragmentKeys.some((key) => hash.has(key));
}

function eventPath(event: AnalyticsEvent): string | null {
  const currentUrl = event.properties?.["$current_url"];
  const candidate = typeof currentUrl === "string"
    ? currentUrl
    : (typeof window !== "undefined" ? window.location.href : null);
  if (!candidate) return null;
  try { return new URL(candidate, "https://axonstudy.online").pathname; }
  catch { return null; }
}

/**
 * Raw academic search terms and DOM-derived Library content are never product
 * analytics. Pageviews remain useful/coarse, but all interaction/copy/dead-click
 * autocapture for /library and its detail routes is dropped before ingestion.
 */
export function filterSensitiveAnalyticsEvent(event: AnalyticsEvent | null): AnalyticsEvent | null {
  if (!event) return null;
  // Audience gate first. Read at send time, not at init, so a page that moves
  // from a parent step into a student session in one load is covered.
  if (!event.event || !ALLOWED_EVENTS[audience].has(event.event)) return null;
  const sanitized = sanitizeAnalyticsEventUrls(event);
  const path = eventPath(sanitized);
  const privateLibrary = path === "/library" || Boolean(path?.startsWith("/library/"));
  if (privateLibrary && sanitized.event && PRIVATE_LIBRARY_AUTOCAPTURE_EVENTS.has(sanitized.event)) {
    return null;
  }
  return sanitized;
}

/**
 * Privacy-critical PostHog options, kept as one exported object so a test can
 * pin them. `maskAllText` is NOT a `session_recording` option (it is an
 * autocapture internal) and was silently ignored in an earlier revision, which
 * left replay text and scanned-paper images unmasked. The real controls are:
 * - `maskAllInputs`: masks input values in replay.
 * - `maskTextSelector: "*"`: masks all DOM text in replay (names, marks, remarks).
 * - `blockSelector`: replaces images/canvas/video with placeholders; masking
 *   text does not hide an image whose `src` is recorded.
 * - `mask_all_text` / `mask_all_element_attributes`: strip text and attributes
 *   from `$autocapture` events.
 */
export const POSTHOG_PRIVACY_CONFIG = {
  // Behavioural capture is off for everyone. Students are minors and parent
  // surfaces need none of it; the consent notice says "Never: behavioural
  // tracking" (AXO-217, council D2). The audience gate in before_send is the
  // second line: it drops anything these switches miss.
  autocapture: false,
  capture_pageview: "history_change",
  capture_pageleave: false,
  capture_exceptions: true,
  capture_dead_clicks: false,
  rageclick: false,
  capture_heatmaps: false,
  capture_performance: false,
  disable_session_recording: true,
  disable_surveys: true,
  mask_all_text: true,
  mask_all_element_attributes: true,
  before_send: filterSensitiveAnalyticsEvent,
  opt_out_capturing_by_default: true,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: "*",
    blockSelector: "img, picture, canvas, video",
  },
} as const;

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
    else initAnalytics(); // still waits for a known audience
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
  // Fail closed: nothing loads until the app has said who is using it.
  if (audience === "unknown") return;
  // Supabase OAuth returns credentials in the fragment. PostHog derives replay
  // start_url before before_send can sanitize it, so do not bootstrap analytics
  // at all on that page load. The next clean navigation or reload can opt in.
  if (hasSensitiveAuthCallback()) {
    document.documentElement.dataset.analytics = "deferred";
    return;
  }

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
    ...POSTHOG_PRIVACY_CONFIG,
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

/** Explicitly consented aggregate send timings, with a property allowlist. */
export function captureUploadTelemetry(event: string, properties: Record<string, unknown>) {
  if (getAnalyticsConsent() !== 'granted' || audience === 'unknown' || !RELIABILITY_EVENTS.has(event)) return;
  window.posthog?.capture?.(event, sanitizeUploadTelemetry(properties));
}
