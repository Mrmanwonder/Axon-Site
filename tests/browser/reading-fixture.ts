import type { PaperDetail, StudentAttempt } from "../../src/ui/data/modules";
const item = (id: string, label: string, max: number | null, mark: number | null, prompt: string): StudentAttempt => ({
  id, question_label: label, question_text: prompt, student_answer: "X | 0 | 1 | 2 | 3\nP | 1/4 | 3/8 | 1/4 | 1/8", answer_block: null,
  marks_awarded: mark, max_marks: max, marks_source: "teacher_pen", teacher_remark: "Check the final value.",
  extraction_confidence: "confirmed", student_confirmed_at: "2026-10-03", mark_loss_event: [],
});
export function readingFixture(): PaperDetail {
  const scenario = new URLSearchParams(location.search).get("scenario");
  const attempts = scenario === "empty" ? [] : [item("a", "1a", 3, 2, "For this probability distribution, use the values shown on your paper."), item("b", "1(b)", 3, 3, "For this probability distribution, use the values shown on your paper."), item("c", "c", 2, null, "Find the value using your earlier working.")];
  return { id: "fixture", type: "unit_test", tier: "tier_1", date_taken: "2026-10-03", subject: scenario === "identity-missing" ? null : "Mathematics",
    reported_total: null, stated_maximum: null, total_awarded: 5, total_available: 6, total_basis: "added_up", total_partial: true, reconciled: null,
    paper_page: [], page_unreadable: scenario === "unreadable" ? [{ page_number: 4, reason: "The handwriting could not be read.", storage_path: null }] : [], student_attempt: attempts,
    question_region: attempts.map((a, i) => ({ id: `r${i}`, run_id: "run", committed_attempt_id: a.id, order_index: i, question_label: a.question_label, question_text: a.question_text, explain_status: null, crop_key: null, confidence_signals: null, page_spans: [{ page: i === 2 ? 4 : 1, box: { x: 30, y: 90, w: 720, h: 260 } }] })),
  };
}
