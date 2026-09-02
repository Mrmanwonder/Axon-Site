/* Cause colour encodes kind, not severity — CLAUDE.md: "Seven distinct hues
   of equal visual weight, never a green-to-red ramp." Shared here so
   ReviewSheet (scan-time) and the post-scan screens (QuestionDetail,
   PaperOverview) can't drift against each other. */

export const CAUSE_HUE: Record<string, string> = {
  conceptual_gap: "var(--cause-conceptual-gap)",
  procedural_slip: "var(--cause-procedural-slip)",
  misread_question: "var(--cause-misread-question)",
  incomplete: "var(--cause-incomplete)",
  presentation: "var(--cause-presentation)",
  keyword_miss: "var(--cause-keyword-miss)",
  timed_out: "var(--cause-timed-out)",
};

export const CAUSE_LABEL: Record<string, string> = {
  conceptual_gap: "Concept gap",
  procedural_slip: "Slip in the working",
  misread_question: "Misread the question",
  incomplete: "Left incomplete",
  presentation: "How it was presented",
  keyword_miss: "Missing keyword",
  timed_out: "Ran out of time",
};

/** Marks are never shown above 28px, and never as a percentage. A whole
    number stays whole; a half mark keeps its half. */
export const numMark = (n: number): string => (Number.isInteger(n) ? String(n) : Number(n).toFixed(1));
