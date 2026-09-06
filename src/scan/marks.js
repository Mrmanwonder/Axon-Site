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
 * Is the allocation we read off the page one a CAIE question could carry?
 *
 * A Cambridge part is worth a positive whole number of marks. Anything else —
 * 2.5, a negative, a zero, something that did not parse — is not a question we
 * should be rendering a correction grid around; it is an extraction failure,
 * and the honest move is to say so rather than to round it into something
 * plausible. Exported so the review screen can name the problem instead of
 * silently showing no row.
 */
export function allocationIsUsable(region) {
  if (region.marks_available === null || region.marks_available === undefined) return false;
  const raw = Number(region.marks_available);
  return Number.isFinite(raw) && raw > 0 && raw === Math.floor(raw);
}

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
 *
 * An unusable allocation renders no grid. The first version of this rounded it
 * instead, so a part read as 2.5 offered `0 · 3` — a mark above the allocation
 * itself, which `correctMark` then refused. Offering a student an option and
 * rejecting it after they tap it is the worst of both: it launders a bad read
 * into a plausible-looking choice and spends their time to tell them nothing.
 */
export function markAlternatives(region) {
  if (!allocationIsUsable(region)) return [];
  const available = Number(region.marks_available);

  const awardedRaw = region.marks_awarded === null || region.marks_awarded === undefined
    ? null
    : Number(region.marks_awarded);
  // A fractional or out-of-range awarded mark is itself a bad read, but unlike
  // the allocation it does not invalidate the grid: the whole point of the row
  // is to correct that number, so it is ignored as a centre rather than
  // rounded into one.
  const awarded = awardedRaw !== null
    && Number.isFinite(awardedRaw)
    && awardedRaw === Math.floor(awardedRaw)
    && awardedRaw >= 0
    && awardedRaw <= available
      ? awardedRaw
      : null;

  // The ends are always offered: "none of it" and "all of it" are the two most
  // common corrections and neither should need a second tap to reach.
  const candidates = new Set([0, available]);
  if (awarded !== null) {
    for (const step of [-2, -1, 0, 1, 2]) {
      const value = awarded + step;
      if (value >= 0 && value <= available) candidates.add(value);
    }
  } else {
    // Nothing usable read at all: walk the whole range, widening the step on a
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

  return sorted;
}
