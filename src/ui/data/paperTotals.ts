/* ═══════════════════════════════════════════════════════════════════════════
   PAPER TOTALS — what a total means

   A total is one of three things, and the app says which:
     · printed   — the paper carries it; we read it.
     · added up  — the paper printed no total; this is the sum of the teacher marks Axon read,
                   and it is labelled that way. It is Axon's addition, never a teacher's figure.
     · partial   — at least one question's mark could not be read, so the sum is a lower bound
                   ("at least"), and it must not be treated as a complete total.

   A paper with nothing printed to check against is "unchecked", not wrong. We never say our
   reading "does not match" a total that does not exist.
   ═══════════════════════════════════════════════════════════════════════════ */

export type TotalsFacts = {
  total_basis?: string | null;
  total_partial?: boolean | null;
  reported_total?: number | string | null;
};

export const isPartialTotal = (p: TotalsFacts | null | undefined): boolean => p?.total_partial === true;

export const isAddedUp = (p: TotalsFacts | null | undefined): boolean =>
  p?.total_basis === "added_up" || (p?.total_basis == null && p?.reported_total == null && p?.total_partial === true);

/** A total that can stand in a comparison or a trend: every mark read. */
export const isCompleteTotal = (p: TotalsFacts | null | undefined): boolean => !isPartialTotal(p);

/**
 * The sentence under a paper's marks, or null when the total is the paper's own and complete.
 * "Marks lost" and "at least" are the only framings; never "score" and never a verdict.
 */
export function totalNote(p: TotalsFacts | null | undefined): string | null {
  const partial = isPartialTotal(p);
  const addedUp = p?.total_basis === "added_up";
  if (partial && addedUp) {
    return "No total was printed on this paper, and some marks could not be read, so this is at least what was awarded.";
  }
  if (partial) return "Some marks on this paper could not be read, so this is at least what was awarded.";
  if (addedUp) return "No total was printed on this paper. Axon added up the marks it could read.";
  return null;
}
