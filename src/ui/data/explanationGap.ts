import type { StudentAttempt } from "./modules";
export type ExplanationGap = "writing" | "failed" | "missing" | null;

/** A missing cause is a visible state, never a diagnosis invented from marks.
    Unchecked unsure readings and unread marks cannot assert a settled loss. */
export function explanationGap(attempt: StudentAttempt, status?: string | null): ExplanationGap {
  if (attempt.extraction_confidence === "unsure" && !attempt.student_confirmed_at) return null;
  if (attempt.marks_awarded == null || attempt.max_marks == null) return null;
  const awarded = Number(attempt.marks_awarded), available = Number(attempt.max_marks);
  if (!Number.isFinite(awarded) || !Number.isFinite(available) || available <= awarded) return null;
  if ((attempt.mark_loss_event ?? []).some(event => !event.student_rejected_at)) return null;
  if (status === "queued" || status === "running") return "writing";
  if (status === "failed") return "failed";
  return "missing";
}
export const EXPLANATION_GAP_LABEL = {
  writing: "Explanation being written",
  failed: "Explanation could not be written",
  missing: "Not explained yet",
} as const;
