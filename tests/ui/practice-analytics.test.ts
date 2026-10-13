import { expect, test, vi } from "vitest";

vi.mock("../../src/ui/data/modules", () => ({ sb: {} }));
vi.mock("../../src/ui/data/useHomePractice", () => ({ useStartPractice: () => vi.fn() }));

import { COMMAND_WORD_MIN_LOST, outlookLines, readinessUnits, scorecardView } from "../../src/ui/components/PracticeAnalytics";
import type { ReadinessRow, ScorecardRow } from "../../src/ui/data/practice";

const row = (dimension: ScorecardRow["dimension"], key: string, gained: number, available: number, weight = 1): ScorecardRow => ({
  dimension, key, questions: 4, papers: 4, marks_gained: gained, marks_available: available,
  weighted_gained: gained * weight, weighted_available: available * weight, trend: [],
});

test("AXO-260: a command word is named only once 3 questions on it lost marks; untagged is never a named row", () => {
  const rows = [row("command_word", "Explain", 4, 12), row("command_word", "State", 5, 6), row("command_word", "untagged", 1, 3), row("ao", "AO1", 9, 10)];
  const lost = new Map([["explain", COMMAND_WORD_MIN_LOST], ["state", COMMAND_WORD_MIN_LOST - 1]]);
  const v = scorecardView(rows, "command_word", lost);
  expect(v.rows.map((r) => r.key)).toEqual(["Explain"]);
  expect(v.rows[0].lost).toBe(8);
  expect(v.hidden).toBe(1);
  expect(v.untagged?.key).toBe("untagged");
  expect(scorecardView(rows, "ao", lost).rows.map((r) => r.key)).toEqual(["AO1"]);
});

test("AXO-260: rows are ordered by weighted marks lost, so a heavier paper ranks first", () => {
  const rows = [row("ao", "AO1", 6, 10, 1), row("ao", "AO2", 8, 10, 3)];
  expect(scorecardView(rows, "ao", new Map()).rows.map((r) => r.key)).toEqual(["AO2", "AO1"]);
});

const topic = (id: string, parent: string | null, depth: number, level: ReadinessRow["level"]): ReadinessRow => ({
  topic_id: id, parent_id: parent, code: id, title: id, depth, sort_order: 0, level, questions: 0, papers: 0,
  open_items: 0, marks_recoverable: 0, last_evidence_at: null,
});

test("AXO-261: topics group under their unit and untested topics stay no_data", () => {
  const units = readinessUnits([topic("1", null, 0, "attempted"), topic("1.1", "1", 1, "familiar"), topic("1.2", "1", 1, "no_data"), topic("2", null, 0, "no_data")]);
  expect(units.map((u) => [u.unit.topic_id, u.topics.map((t) => t.topic_id)])).toEqual([["1", ["1.1", "1.2"]], ["2", []]]);
  expect(units[0].topics[1].level).toBe("no_data");
});

test("AXO-262: the outlook is always a range with its basis, never a single confident grade", () => {
  const base = {
    state: "ready" as const, syllabus_code: "0625", series_key: "2026-06", option_code: "AX", source_url: "https://example.org/t.pdf",
    papers: 4, components: [{ paper: 1, papers: 2 }, { paper: 3, papers: 2 }], routes: 3, low_grade: "C", mid_grade: "B", high_grade: "A", low_total: 110, mid_total: 130, high_total: 150,
    max_total: 200, target: "A", marks_to_target: 12, suggested: "B", stretch: "A",
  };
  const l = outlookLines(base);
  expect(l.range).toBe("C to A");
  expect(l.basis).toMatch(/^Based on 4 papers · 110 to 150 of 200/);
  expect(l.basis).toMatch(/June 2026 thresholds for 0625, papers 1, 3 \(3 variants, widest range\)$/);
  expect(l.target).toMatch(/About 12 more weighted marks .* target of A/);
  expect(outlookLines({ ...base, low_grade: "B", high_grade: "B" }).range).toBe("Around B");
  expect(outlookLines({ ...base, target: null }).target).toBeNull();
});
