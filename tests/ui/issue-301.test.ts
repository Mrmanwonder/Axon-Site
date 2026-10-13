import { describe, expect, it, vi } from "vitest";
import { paperPresentation } from "../../src/ui/data/paperPresentation";
import { importSummary } from "../../src/ui/data/useIngestion";
import { withDeadline } from "../../src/ui/lib/deadline";

const ready = (rows: [string, { status: string }][]) =>
  ({ state: "ready", data: new Map(rows), source: "live", fetchedAt: Date.now() }) as never;

describe("issue #301", () => {
  it("a paper with no run (an added link) opens its own page, not Review", () => {
    const paper = { id: "p1", student_attempt: [{ count: 0 }] } as never;
    expect(paperPresentation(paper, ready([])).destination).toBe("/library/p1");
  });

  it("a paper with a live run still opens Review", () => {
    const paper = { id: "p1", student_attempt: [{ count: 0 }] } as never;
    expect(paperPresentation(paper, ready([["p1", { status: "needs_review" }]])).destination).toBe("/scan/review/p1");
  });

  it("an import summary names why a file was refused", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const text = importSummary({ accepted: [], rejected: [{ name: "a.png", reason: "This image is 800px on its longest side." }] });
    expect(text).toContain("800px");
    expect(importSummary({ accepted: [{}], rejected: [] })).toMatch(/^1 page\(s\) added/);
  });

  it("a hung read becomes an error at its deadline", async () => {
    vi.useFakeTimers();
    const p = withDeadline(new Promise(() => {}), 1000, "slow");
    vi.advanceTimersByTime(1001);
    await expect(p).rejects.toThrow("slow");
    vi.useRealTimers();
  });
});
