import { beforeEach, expect, test, vi } from "vitest";
const mock = vi.hoisted(() => ({ writes: [] as { table: string; value: Record<string, unknown> }[], writeError: null as Error | null }));
vi.mock("../../src/supabase.js", () => ({ sb: { from(table: string) {
  let writing = false;
  const response = () => Promise.resolve(writing ? { data: null, error: mock.writeError } : {
    error: null, data: table === "question_region" ? { marks_available: 3, marks_awarded_box: { page: 1, x: 1, y: 2, w: 3, h: 4 }, student_answer_box: null, page_spans: [{ page: 1, box: { x: 1, y: 2, w: 3, h: 4 } }], run_id: "run" }
      : table === "extraction_run" ? { student_id: "student", corrections_count: 0 }
      : { programme_id: null, board: "CAIE" },
  });
  const builder = {
    select() { return builder; }, eq() { return builder; }, in() { return builder; }, single: response,
    update(value: Record<string, unknown>) { writing = true; mock.writes.push({ table, value }); return builder; },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return response().then(resolve, reject); },
  };
  return builder;
} } }));
import { correctMark, correctAnswer, confirmQuestion } from "../../src/scan/review.js";
beforeEach(() => { mock.writes = []; mock.writeError = null; });

test("saving a teacher-mark correction leaves the whole question unconfirmed", async () => {
  await correctMark("region", 0);
  const update = mock.writes.find(w => w.table === "question_region")!.value;
  expect(update.marks_awarded).toBe(0);
  expect(update.student_confirmed_at).toBeNull();
  expect(update.student_corrected).toBe(true);
  expect(update).not.toHaveProperty("student_answer");
});
test("answer correction invalidates confirmation and stale structured transcription", async () => {
  await correctAnswer("region", " x + 1\n= 2 ");
  const update = mock.writes.find(w => w.table === "question_region")!.value;
  expect(update.student_answer).toBe("x + 1\n= 2");
  expect(update.answer_block).toBeNull();
  expect(update.student_confirmed_at).toBeNull();
  expect(update).not.toHaveProperty("marks_awarded");
});
test("explicit whole-question confirmation is the action that sets its timestamp", async () => {
  await confirmQuestion("region");
  expect(mock.writes[0].value.student_confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});
test("failed durable field writes reject and do not advance correction accounting", async () => {
  mock.writeError = new Error("Write refused");
  await expect(correctMark("region", 2)).rejects.toBe(mock.writeError);
  expect(mock.writes).toHaveLength(1);
});
