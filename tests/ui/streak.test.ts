import { describe, expect, it } from "vitest";
import { computeStreak, MAX_FREEZES } from "../../src/ui/data/streak";

// 2026-10-05 is a Monday.
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});

describe("practice streak (AXO-254)", () => {
  it("is zero with no sessions, and app opens are not sessions", () => {
    expect(computeStreak([], "2026-10-13")).toEqual({ current: 0, longest: 0, freezes: 0, frozen: [], todayDone: false });
  });

  it("counts consecutive days and does not break on today before it is over", () => {
    const s = computeStreak(["2026-10-12", "2026-10-13"], "2026-10-13");
    expect(s.current).toBe(2);
    expect(s.todayDone).toBe(true);
    const t = computeStreak(["2026-10-12"], "2026-10-13");
    expect(t.current).toBe(1);
    expect(t.todayDone).toBe(false);
  });

  it("gives weekend grace: a missed Saturday and Sunday neither add nor break", () => {
    const s = computeStreak(["2026-10-09", "2026-10-12"], "2026-10-12"); // Fri, then Mon
    expect(s.current).toBe(2);
    expect(s.frozen).toEqual([]);
  });

  it("breaks on a missed weekday with no freeze held", () => {
    const s = computeStreak(["2026-10-05", "2026-10-07"], "2026-10-07"); // Mon, (Tue missed), Wed
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
  });

  it("earns a freeze every 7 counted days, holds at most two, and spends one on a missed weekday", () => {
    const run = days("2026-09-07", 21); // 21 straight days → 3 earned, 2 held
    const held = computeStreak(run, "2026-09-27");
    expect(held.current).toBe(21);
    expect(held.freezes).toBe(MAX_FREEZES);
    // Monday 28 Sep missed, Tuesday 29 done.
    const s = computeStreak([...run, "2026-09-29"], "2026-09-29");
    expect(s.current).toBe(22);
    expect(s.freezes).toBe(1);
    expect(s.frozen).toEqual(["2026-09-28"]);
  });

  it("loses held freezes when a run ends", () => {
    const run = days("2026-09-07", 7); // one freeze
    const s = computeStreak([...run, "2026-09-17"], "2026-09-17"); // Mon 14 frozen, Tue 15 breaks
    expect(s.current).toBe(1);
    expect(s.freezes).toBe(0);
    expect(s.longest).toBe(7);
  });

  it("ignores malformed and future dates", () => {
    const s = computeStreak(["2026-10-13", "not-a-date", "2026-12-01"], "2026-10-13");
    expect(s.current).toBe(1);
  });
});
