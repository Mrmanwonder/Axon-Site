import { expect, test } from "vitest";
import { flagReason } from "../../src/scan/flags.js";
import { openFlags, savedRunId } from "../../src/ui/data/flaggedParts";
import { placedLabels, saveFailureMessage } from "../../src/scan/review.js";
import type { PaperDetail } from "../../src/ui/data/modules";

// AXO-216: the card states only a reason that was measured.
test("a flagged part's reason comes from what was measured, and none is invented", () => {
  expect(flagReason({ confidence_tier: "unreadable", confidence_signals: { unreadable_reason: "Torn corner" } })).toBe("Torn corner");
  expect(flagReason({ confidence_tier: "unsure", confidence_signals: { recognition: false }, marks_awarded: 1, marks_available: 2 })).toBe("The writing here was hard to read.");
  expect(flagReason({ confidence_tier: "unsure", confidence_signals: {}, marks_awarded: null, marks_available: 2 })).toBe("The teacher's mark was not found.");
  expect(flagReason({ confidence_tier: "unsure", confidence_signals: {}, marks_awarded: 3, marks_available: 2 })).toBe("The mark read is more than this part is worth.");
  expect(flagReason({ confidence_tier: "confident", confidence_signals: {}, marks_awarded: 1, marks_available: 2 }, { unplaced: true }))
    .toBe("Axon could not tell which question this part belongs to.");
  // Flagged with nothing specific recorded: no cause is claimed.
  expect(flagReason({ confidence_tier: "confident", confidence_signals: { recognition: true }, marks_awarded: 1, marks_available: 2 })).toBeNull();
});

const region = (over: Record<string, unknown>) => ({
  run_id: "run-2", explain_status: null, committed_attempt_id: null, page_spans: null, crop_key: null,
  confidence_signals: null, marks_awarded: 1, marks_available: 2, ...over,
});

test("only flagged, unchecked parts of the saved run ask, and Not now stops them asking", () => {
  const paper = {
    extraction_run: [
      { id: "run-1", status: "committed", committed_at: "2026-10-01T00:00:00Z" },
      { id: "run-2", status: "committed", committed_at: "2026-10-07T00:00:00Z" },
    ],
    question_region: [
      region({ id: "old", run_id: "run-1", needs_review: true, committed_attempt_id: "x" }),
      region({ id: "clean", needs_review: false, committed_attempt_id: "a1", order_index: 0 }),
      region({ id: "asks", needs_review: true, committed_attempt_id: "a2", order_index: 1 }),
      region({ id: "checked", needs_review: true, student_confirmed_at: "2026-10-07T01:00:00Z", committed_attempt_id: "a3", order_index: 2 }),
      region({ id: "later", needs_review: true, review_deferred_at: "2026-10-07T01:00:00Z", committed_attempt_id: "a4", order_index: 3 }),
      region({ id: "unsaved", needs_review: true, marks_awarded: null, order_index: 4 }),
    ],
  } as unknown as PaperDetail;
  expect(savedRunId(paper)).toBe("run-2");
  const flags = openFlags(paper);
  expect(flags.map((f) => f.region.id)).toEqual(["asks", "unsaved"]);
  expect(flags[1]).toMatchObject({ attemptId: null, reason: "The teacher's mark was not found." });
});

test("placed labels come from the shared placement walk: bare parts take their question", () => {
  const span = (page: number, y: number) => [{ page, box: { x: 0, y, w: 1, h: 1 } }];
  const labels = placedLabels([
    { id: "a", order_index: 0, question_label: "3(a)", page_spans: span(1, 10), marks_awarded: 1 },
    { id: "c", order_index: 1, question_label: "(c)", page_spans: span(1, 50), marks_awarded: 1 },
    { id: "q5", order_index: 2, question_label: "5", page_spans: span(2, 10), marks_awarded: 1 },
    { id: "c5", order_index: 3, question_label: "(c)", page_spans: span(2, 40), marks_awarded: 1 },
    { id: "lost", order_index: 4, question_label: "(a)", page_spans: span(9, 10), marks_awarded: 1 },
  ]);
  expect(Object.fromEntries(labels)).toEqual({ a: "3(a)", c: "3(c)", q5: "5", c5: "5(c)", lost: null });
});

test("a failed save says why, not a generic message", () => {
  expect(saveFailureMessage(new Error("Two parts of this paper are both read as 3(c), so Axon cannot tell which mark belongs to which.")))
    .toMatch(/both read as 3\(c\)/);
  expect(saveFailureMessage(new TypeError("Failed to fetch"))).toMatch(/connection dropped/);
});
