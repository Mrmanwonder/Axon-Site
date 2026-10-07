import { expect, test } from "vitest";
import { paperIdentity, paperReading } from "../../src/ui/data/paperReading";
import type { PaperDetail, StudentAttempt } from "../../src/ui/data/modules";

const attempt = (id: string, label: string, max: number | null, awarded: number | null, text = "A shared printed prompt."): StudentAttempt => ({
  id, question_label: label, question_text: text, student_answer: "x = 2", answer_block: null,
  marks_awarded: awarded, max_marks: max, marks_source: "teacher_pen", teacher_remark: null,
  extraction_confidence: "confirmed", student_confirmed_at: "2026-10-03", mark_loss_event: [],
});
const paper = (attempts: StudentAttempt[], sources = true): PaperDetail => ({
  id: "paper", type: "unit_test", tier: "tier_1", date_taken: "2026-10-03", subject: "Physics",
  reported_total: null, stated_maximum: null, total_awarded: null, total_available: null, total_basis: "added_up", total_partial: false, reconciled: null,
  paper_page: [], page_unreadable: [], student_attempt: attempts,
  question_region: sources ? attempts.map((a, i) => ({ id: `r${i}`, run_id: "run", committed_attempt_id: a.id, order_index: i, question_label: a.question_label, explain_status: null, crop_key: null, confidence_signals: null, page_spans: [{ page: 1, box: { x: 1, y: i * 40, w: 100, h: 30 } }] })) : [],
});

test("parent/child marks are not double-counted; source counts keep AXO122 semantics", () => {
  const reading = paperReading(paper([attempt("parent", "1", 6, 3), attempt("a", "1(a)", 3, 1), attempt("b", "1b", 3, 2)]));
  expect(reading.lost).toBe(3); expect(reading.maximum).toBe(6); expect(reading.scored).toHaveLength(2);
  expect(reading.counts).toEqual({ questions_total: 1, parts_total: 3, unassigned_parts: 0, raw_region_count: 3 });
  expect(reading.groups[0].sharedStem).toBe("A shared printed prompt.");
});
test("bare parts without source boundaries remain unassigned, not guessed into the preceding question", () => {
  const reading = paperReading(paper([attempt("a", "1a", 3, 2), attempt("c", "c", 2, 1)], false));
  expect(reading.unassigned[0].label).toBe("Unassigned part (c)"); expect(reading.counts).toBeNull();
});
test("a supported source-order continuation is disclosed and keeps its saved id", () => {
  const reading = paperReading(paper([attempt("a", "1a", 3, 2), attempt("c", "c", 2, 1)]));
  expect(reading.groups[0].items[1]).toMatchObject({ label: "Question 1(c)", inherited: true, attempt: { id: "c" } });
});
test("missing and unsure unconfirmed marks are excluded and make coverage partial", () => {
  const p = paper([attempt("a", "1a", 3, 2), attempt("b", "1b", 3, null), { ...attempt("c", "2a", 3, 0), extraction_confidence: "unsure", student_confirmed_at: null }]);
  const reading = paperReading(p);
  expect(reading.lost).toBe(1); expect(reading.scored).toHaveLength(1); expect(reading.partial).toBe(true);
});
test("identity distinguishes suggested subject and added date from an unrecorded test date", () => {
  const p = paper([]); const identity = paperIdentity(p, "Class test");
  expect(identity.title).toBe("Class test"); expect(identity.subject).toBe("Subject suggested: Physics");
  expect(identity.added).toContain("Added"); expect(identity.examDate).toBe("Test date not recorded");
  expect(paperIdentity({ ...p, subject_offering_id: "offering", subject_display_snapshot: "Physics", subject_verified_at: "2026-10-03" }, "Class test").title).toBe("Physics · Class test");
});
