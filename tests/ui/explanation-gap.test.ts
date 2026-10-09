import { expect, test } from "vitest";
import { explanationGap } from "../../src/ui/data/explanationGap";
const attempt = { marks_awarded: 1, max_marks: 3, extraction_confidence: "confirmed", student_confirmed_at: null, mark_loss_event: [] } as any;
test.each(["skipped", "done", "pending", "unknown", null])("an event-less positive loss is visible regardless of terminal/legacy status %s", status => {
  expect(explanationGap(attempt, status)).toBe("missing");
});
test.each(["queued", "running"])("in-flight work remains distinct: %s", status => expect(explanationGap(attempt, status)).toBe("writing"));
test("a failed explanation is distinct from unavailable evidence", () => expect(explanationGap(attempt, "failed")).toBe("failed"));
test("a non-rejected loss event resolves the gap; rejecting it restores the admitted absence", () => {
  expect(explanationGap({ ...attempt, mark_loss_event: [{ student_rejected_at: null }] })).toBeNull();
  expect(explanationGap({ ...attempt, mark_loss_event: [{ student_rejected_at: "2026-10-09" }] })).toBe("missing");
});
test.each([{ marks_awarded: null }, { max_marks: null }, { marks_awarded: 3 }, { marks_awarded: 4 }, { max_marks: "not-a-number" }])("unread, invalid and full marks cannot claim a missing loss explanation", patch => {
  expect(explanationGap({ ...attempt, ...patch })).toBeNull();
});
test("unsure unconfirmed data never asserts settled lost marks", () => {
  expect(explanationGap({ ...attempt, extraction_confidence: "unsure" })).toBeNull();
  expect(explanationGap({ ...attempt, extraction_confidence: "unsure", student_confirmed_at: "2026-10-09" })).toBe("missing");
});
