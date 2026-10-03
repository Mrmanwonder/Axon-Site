import { describe, expect, test } from "vitest";
import { homeAttention } from "../../src/ui/data/homeAttention";
import type { Paper, ProgressRow } from "../../src/ui/data/modules";

const paper: Paper = { id: "paper", type: "unit_test", tier: "tier_1", date_taken: "2026-10-01",
  student_attempt: [{ count: 12 }] };
function run(status: string, needing = 0): ProgressRow {
  return { paper_id: "paper", status, status_reason: null, started_at: "2026-10-01",
    pages_total: 14, pages_done: 8, questions_total: 5, questions_done: 12,
    questions_needing_you: needing, parts_total: 12, unassigned_parts: 3, raw_region_count: 12 };
}
function attention(overrides: Partial<Parameters<typeof homeAttention>[0]> = {}) {
  return homeAttention({ papers: [paper], progress: new Map(), live: true,
    needsCheckCount: 0, unreadable: [], enoughData: false, ...overrides });
}

describe("Home truthful action state", () => {
  test("six historical unreadable pages do not become six mark confirmation tasks", () => {
    const result = attention({ unreadable: Array.from({ length: 6 }, (_, i) => ({ paper_id: "paper", page_number: i + 1 })) });
    expect(result.copy).toContain("6 saved pages could not be read");
    expect(result.copy).not.toContain("analysis can move on");
    expect(result.title).toBe("Unreadable source pages");
    expect(result.actionLabel).toBe("Open affected paper");
    expect(result.destination).toBe("/library/paper");
  });
  test("review count uses parts and opens that actual paper", () => {
    const result = attention({ progress: new Map([["paper", run("needs_review", 3)]]) });
    expect(result.copy).toContain("3 parts need confirmation");
    expect(result.detail).toBe("1 paper ready to open");
    expect(result.destination).toBe("/scan/review/paper");
  });
  test("fully confirmed ready run offers save without resurrecting a warning", () => {
    const result = attention({ progress: new Map([["paper", run("ready")]]) });
    expect(result.copy).toBe("Your paper is ready to save.");
    expect(result.actionLabel).toBe("Open ready paper");
  });
  test("explaining is system processing, not ready for review", () => {
    const result = attention({ progress: new Map([["paper", run("explaining")]]) });
    expect(result.copy).toContain("still being processed");
    expect(result.title).toBeNull();
    expect(result.actionLabel).toBe("View processing");
  });
  test("saved uncertain readings are described as excluded evidence, not an available confirmation flow", () => {
    const result = attention({ needsCheckCount: 2 });
    expect(result.copy).toContain("2 saved readings remain uncertain and excluded from Insights");
    expect(result.actionLabel).toBe("Open Library");
  });
  test("stale state never advertises current action eligibility", () => {
    const result = attention({ live: false, progress: new Map([["paper", run("needs_review", 12)]]) });
    expect(result.destination).toBeNull();
    expect(result.copy).toContain("Checking");
  });
  test("deleted or other profile paper rows cannot create attention", () => {
    const result = attention({ papers: [], progress: new Map([["paper", run("needs_review", 12)]]),
      unreadable: [{ paper_id: "paper", page_number: 1 }] });
    expect(result.title).toBeNull();
  });
  test("technical failure gets its own destination and no confirmation demand", () => {
    const result = attention({ progress: new Map([["paper", run("failed")]]) });
    expect(result.title).toBe("Reading stopped");
    expect(result.destination).toBe("/library");
    expect(result.copy).not.toContain("needs your eyes");
  });
});
