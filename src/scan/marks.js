/**
 * The mark grid.
 *
 * Pure and dependency-free on purpose: review.js talks to Supabase on every
 * other line, and the one piece of arithmetic in it that decides what a student
 * is allowed to record about their own paper should be testable without a
 * network client standing in the way.
 */

/**
 * CAIE awards whole marks only, at IGCSE, AS and A Level alike.
 *
 * This is a fact about the board, not a policy of ours, which is why it is a
 * constant and not a setting. `board` is CAIE for every new profile; if the
 * CBSE rows that predate the switch ever need different arithmetic, this is the
 * flag to key off rather than a second grid.
 */
export const WHOLE_MARKS_ONLY = true;

/**
 * The numbers the student is offered when the mark was misread.
 *
 * Neighbours on the mark grid, plus the two ends, which between them cover
 * almost every real correction in one tap. The picker is the landing state
 * because typing is slower and rescanning is slower still — the ladder goes
 * pick, then type, then rescan, and most corrections stop at the first rung.
 *
 * Whole marks only. CAIE awards integers at IGCSE, AS and A Level: no teacher
 * marking a Cambridge paper writes 0.5 against a part, so a half-mark chip
 * offers the student a mark that cannot exist. It is worse than cosmetic —
 * a paper total that only balances with half marks is the reconciler telling us
 * the *extraction* is wrong, and a half-mark option quietly papers over that
 * signal on its way into student_attempt and the analytics. This grid used to
 * step in halves, and a CHECK constraint now makes one unstorable if it ever
 * arrives by another route.
 */
export function markAlternatives(region) {
  const available = region.marks_available === null ? null : Math.round(Number(region.marks_available));
  if (!Number.isFinite(available) || available <= 0) return [];
  const raw = region.marks_available === null ? null : Number(region.marks_available);
  const awarded = region.marks_awarded === null ? null : Math.round(Number(region.marks_awarded));

  // The ends are always offered: "none of it" and "all of it" are the two most
  // common corrections and neither should need a second tap to reach.
  const candidates = new Set([0, available]);
  if (awarded !== null && Number.isFinite(awarded)) {
    for (const step of [-2, -1, 0, 1, 2]) {
      const value = awarded + step;
      if (value >= 0 && value <= available) candidates.add(value);
    }
  } else {
    // Nothing read at all: walk the whole range, widening the step on a
    // question too big to fit in the row rather than truncating it and leaving
    // the top mark unreachable.
    const step = Math.max(1, Math.ceil(available / 6));
    for (let v = 0; v <= available; v += step) candidates.add(v);
  }

  const sorted = [...candidates].sort((a, b) => a - b);
  // Seven chips is the row's budget. Trim from the middle rather than the tail:
  // slicing dropped the top of the range, so a 9-mark question offered no way
  // to say "all of them".
  while (sorted.length > 7) sorted.splice(Math.floor(sorted.length / 2), 1);

  // A non-integer allocation on the page is an extraction failure, not a mark
  // scheme we should render around. Offer the ends only and let review catch it.
  if (raw !== null && raw !== Math.round(raw)) return [0, available];

  return sorted;
}
