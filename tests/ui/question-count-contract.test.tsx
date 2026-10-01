import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { countQuestions, parseQuestionLabel } from "../../src/questionCount.js";

type Region = { order_index: number; label: string | null; page: number | null; y: number | null; evidence: boolean };
type Case = { name: string; regions: Region[]; expected: Record<string, number> };

// The same file the SQL suite reads, so the two implementations cannot drift.
const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/question-count-contract.json"), "utf8"),
) as { cases: Case[] };

describe("AXO-122 question counting contract", () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      expect(countQuestions(c.regions)).toEqual(c.expected);
    });
  }

  it("reads the label shapes seen in production", () => {
    expect(parseQuestionLabel("5(a)")).toEqual({ q: 5, part: "a" });
    expect(parseQuestionLabel("1b")).toEqual({ q: 1, part: "b" });
    expect(parseQuestionLabel("6a")).toEqual({ q: 6, part: "a" });
    expect(parseQuestionLabel("(c)")).toEqual({ q: null, part: "c" });
    expect(parseQuestionLabel("a")).toEqual({ q: null, part: "a" });
    expect(parseQuestionLabel("2. a)")).toEqual({ q: 2, part: "a" });
    expect(parseQuestionLabel("(ii)")).toEqual({ q: null, part: "(ii)" });
    expect(parseQuestionLabel("3")).toEqual({ q: 3, part: null });
    expect(parseQuestionLabel(null)).toEqual({ q: null, part: null });
  });
});
