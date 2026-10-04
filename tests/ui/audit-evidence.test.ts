import { expect, test, vi } from "vitest";
const fixture = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../../src/supabase.js", () => ({ sb: { from: (table: string) => {
  const b: any = { select: () => b, eq: () => b, single: async () => ({ data: table === "question_region" ? { student_answer_box: { page: 2, x: 30, y: 40, w: 50, h: 60 }, page_spans: [], run_id: "r" } : { corrections_count: 0 }, error: null }), update: (values: any) => { fixture.update(values); return b; }, then: (yes: any) => Promise.resolve({ error: null }).then(yes) };
  return b;
} } }));
vi.mock("../../src/papers.js", () => ({ pageAssetUrl: vi.fn() }));
import { correctAnswer, deltaFor } from "../../src/scan/review.js";
import { cropStyles } from "../../src/scan/crops.js";

test("a human answer correction invalidates the machine's old structured rendering", async () => {
  await correctAnswer("region", "8/2");
  expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({ student_answer: "8/2", answer_block: null }));
});

test("the mismatch banner follows current corrected marks rather than a previous run verdict", () => {
  const paper = { reported_total: 10, total_awarded: 8 };
  expect(deltaFor({ reconciled: false }, paper, [{ marks_awarded: 10, confidence_tier: "unsure" }])).toBeNull();
  expect(deltaFor({ reconciled: true }, paper, [{ marks_awarded: 8, confidence_tier: "unsure" }])).toMatchObject({ ours: 8, theirs: 10 });
});

test("the crop exposes the exact padded and page-clamped frame used by highlights", () => {
  const interior = cropStyles({ x: 100, y: 200, w: 400, h: 300 }, 1000, 2000)!;
  // Vertical pad is at least 1.5% of page height (30 px on 2000), so ink that runs past a region edge stays in view.
  expect(interior.box).toEqual({ x: 80, y: 170, w: 440, h: 360 });
  const edge = cropStyles({ x: 0, y: 0, w: 100, h: 100 }, 100, 100)!;
  expect(edge.box).toEqual({ x: 0, y: 0, w: 100, h: 100 });
});
