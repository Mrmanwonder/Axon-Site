import { beforeEach, expect, test, vi } from "vitest";

const mock = vi.hoisted(() => ({ responses: {} as Record<string, { data: unknown; error: Error | null }> }));
vi.mock("../../src/supabase.js", () => ({
  sb: {
    from(table: string) {
      const response = () => Promise.resolve(mock.responses[table]);
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        single: response,
        order: response,
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return response().then(resolve, reject);
        },
      };
      return builder;
    },
  },
}));
import { loadReview } from "../../src/scan/review.js";

beforeEach(() => {
  mock.responses = {
    extraction_run: { data: { id: "run", paper_id: "paper", student_id: "student", status: "needs_review", reconciled: true }, error: null },
    student: { data: { programme_id: null, board: "CAIE" }, error: null },
    paper: { data: { id: "paper", reported_total: null }, error: null },
    question_region: { data: [], error: null },
    paper_page: { data: [], error: null },
    region_explanation: { data: [], error: null },
    page_unreadable: { data: [], error: null },
  };
});

test.each(["paper", "question_region", "paper_page", "region_explanation", "page_unreadable"])(
  "%s read failure cannot masquerade as completed empty review", async table => {
    const error = new Error(table + " unavailable");
    mock.responses[table] = { data: null, error };
    await expect(loadReview("run")).rejects.toBe(error);
  },
);

test("a confirmed unreadable region retains its source state without pending review", async () => {
  mock.responses.question_region.data = [{
    id: "region", order_index: 0, question_label: "1a", question_text: null,
    student_answer: null, teacher_remark: null, region_type: "unknown",
    marks_awarded: null, marks_available: null, confidence_tier: "unreadable",
    confidence_signals: { unreadable_reason: "Source unclear" },
    student_confirmed_at: "2026-10-01", student_corrected: false, page_spans: [],
  }];
  const result = await loadReview("run");
  expect(result.outstanding).toBe(0);
  expect(result.questions[0].unreadableReason).toBe("Source unclear");
  expect(result.lead).toContain("1 question (1 part)");
  expect(result.lead).toContain("all confirmed");
});
