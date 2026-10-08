/* ═══════════════════════════════════════════════════════════════════════════
   FLAGGED PARTS (AXO-216, council D1, 7 Oct 2026)

   A saved paper asks the student only about parts with a measured reason
   (`question_region.needs_review`). Each such part gets one card on the paper,
   with its reason in plain words, "Fix this" and "Not now". The card never
   blocks anything: the paper is already saved, and an unchecked part simply
   stays unsure, out of Insights and off shared pages.

   The reason is read from what was measured, never inferred. When nothing
   specific was recorded the card says only "Check this against your paper",
   which claims no cause (Axon.md section 7: never state a reason that was not
   measured).
   ═══════════════════════════════════════════════════════════════════════════ */

import type { PaperDetail, QuestionRegionRef } from "./modules";
import { flagReason as flagReasonJs } from "../../scan/flags.js";

/** The run whose parts are on the saved paper. */
export function savedRunId(paper: Pick<PaperDetail, "extraction_run" | "question_region">): string | null {
  const committed = (paper.extraction_run ?? [])
    .filter((run) => run.committed_at)
    .sort((a, b) => String(b.committed_at).localeCompare(String(a.committed_at)));
  if (committed.length) return committed[0].id;
  return paper.question_region.find((r) => r.committed_attempt_id)?.run_id ?? null;
}

/** The pipeline asked, and the student has not checked it yet. */
export function awaitingCheck(region: QuestionRegionRef | undefined | null): boolean {
  return !!region?.needs_review && !region.student_confirmed_at;
}

/** Asked, unchecked, and not put off with "Not now": the card shows. */
export function asksNow(region: QuestionRegionRef): boolean {
  return awaitingCheck(region) && !region.review_deferred_at;
}

/** One measured reason in plain words, or null when none was recorded. */
export const flagReason = flagReasonJs as (region: QuestionRegionRef, opts?: { unplaced?: boolean }) => string | null;

export type OpenFlag = {
  region: QuestionRegionRef;
  attemptId: string | null;
  reason: string | null;
};

/** Every part of the saved paper whose card should show, in paper order. */
export function openFlags(paper: PaperDetail, unplacedAttemptIds: Set<string> = new Set()): OpenFlag[] {
  const run = savedRunId(paper);
  if (!run) return [];
  return paper.question_region
    .filter((r) => r.run_id === run && r.id && asksNow(r))
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((region) => ({
      region,
      attemptId: region.committed_attempt_id,
      reason: flagReason(region, { unplaced: !!region.committed_attempt_id && unplacedAttemptIds.has(region.committed_attempt_id) }),
    }));
}
