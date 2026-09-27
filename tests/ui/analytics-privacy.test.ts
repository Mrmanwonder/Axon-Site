import { expect, test } from "vitest";
import { filterSensitiveAnalyticsEvent } from "../../src/ui/lib/analytics";

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
