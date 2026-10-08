import { applyFilters, orderPapers, subjectOf } from "./insights";
import type { InsightPaper, InsightFilters } from "./insights";

/** Categorical response only. Paper content and student answers never enter this read. */
export type FeltEvidence = { paper_id: string; rating: number; responded_at: string };
export const FELT_LABELS = ["Very easy", "Easy", "About right", "Hard", "Very hard"] as const;
export type FeltRow = { paperId: string; label: string; rating: number };
export type FeltSummary = {
  rows: FeltRow[]; hardAndHeld: number; easyAndLost: number;
  rated: number; hard: number; easy: number;
};

export function summarizePerceivedDifficulty(
  papers: InsightPaper[], evidence: FeltEvidence[], filters: InsightFilters,
  now = Date.now(),
): FeltSummary | null {
  const matching = applyFilters(papers, filters, now);
  const felt = new Map(evidence.filter((r) =>
    Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5,
  ).map((r) => [r.paper_id, r.rating]));
  const rows: FeltRow[] = [];
  let hard = 0, easy = 0, hardAndHeld = 0, easyAndLost = 0;
  for (const paper of orderPapers(matching).reverse()) {
    const rating = felt.get(paper.id);
    if (rating === undefined) continue;
    const subject = subjectOf(paper) ?? "Paper";
    rows.push({ paperId: paper.id, label: subject, rating });
    if (rating >= 4) hard++;
    if (rating <= 2) easy++;
    const max = Number(paper.total_available);
    const awarded = Number(paper.total_awarded);
    if (paper.total_partial || paper.total_available == null || paper.total_awarded == null
      || !Number.isFinite(max) || !Number.isFinite(awarded) || max <= 0 || awarded < 0 || awarded > max) continue;
    // These are descriptions of teacher-marked papers, not a grade prediction.
    if (rating >= 4 && awarded / max >= .8) hardAndHeld++;
    if (rating <= 2 && awarded / max <= .75) easyAndLost++;
  }
  return rows.length ? { rows, rated: rows.length, hard, easy, hardAndHeld, easyAndLost } : null;
}
