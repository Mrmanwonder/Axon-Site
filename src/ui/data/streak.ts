/* ═══════════════════════════════════════════════════════════════════════════
   PRACTICE STREAK (AXO-254)

   Owner decision, 13 Oct 2026: a streak, with freezes and a weekend grace
   rule. It counts days with a completed re-attempt session — never app opens
   — and it compares the student only with their own past.

   The rules, in the order a day is judged:
   - A day with a completed session adds one.
   - Today without one yet is not a miss: the day is not over.
   - A Saturday or Sunday without one is grace: it neither adds nor breaks.
   - A missed weekday uses a freeze if one is held, otherwise the streak ends.
   - Every 7 counted days earns a freeze; at most 2 are held.

   Pure and deterministic over the session dates, so the server keeps no
   streak state that could drift from the sessions it is computed from.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MAX_FREEZES = 2;
export const DAYS_PER_FREEZE = 7;

export type Streak = {
  current: number;
  longest: number;
  freezes: number;
  /** Weekdays a freeze covered, most recent last. */
  frozen: string[];
  todayDone: boolean;
};

const DAY = 86_400_000;
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function computeStreak(sessionDates: readonly string[], today: string): Streak {
  const done = new Set(sessionDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today));
  const empty: Streak = { current: 0, longest: 0, freezes: 0, frozen: [], todayDone: false };
  if (done.size === 0) return empty;

  const first = [...done].sort()[0];
  let current = 0;
  let longest = 0;
  let freezes = 0;
  let counted = 0; // days counted in the current run, for earning freezes
  const frozen: string[] = [];

  for (let ms = toUtc(first), end = toUtc(today); ms <= end; ms += DAY) {
    const iso = toIso(ms);
    if (done.has(iso)) {
      current += 1;
      counted += 1;
      if (counted % DAYS_PER_FREEZE === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      longest = Math.max(longest, current);
      continue;
    }
    if (iso === today) continue;
    const weekday = new Date(ms).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (current > 0 && freezes > 0) {
      freezes -= 1;
      frozen.push(iso);
      continue;
    }
    current = 0;
    counted = 0;
    // Freezes belong to a run: a broken streak keeps none.
    freezes = 0;
  }

  return { current, longest, freezes, frozen: frozen.slice(-5), todayDone: done.has(today) };
}
