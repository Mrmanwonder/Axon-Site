import { expect, test } from "vitest";
import { reviewLeadFor } from "../../src/scan/reviewSummary.js";
import { countQuestions } from "../../src/questionCount.js";

test("review uses the existing top-level question/part contract", () => {
  const regions = [
    { label: "5(a)", page: 1, y: 0, evidence: true },
    { label: "5(b)", page: 1, y: 0.3, evidence: true },
    { label: "(c)", page: 2, y: 0, evidence: true },
    { label: null, page: 3, y: 0, evidence: false },
  ];
  const counts = countQuestions(regions);
  const lead = reviewLeadFor([{ tier: "unsure", confirmed: false }], [{}, {}, {}], counts);
  expect(lead).toContain("1 question (3 parts) · 3 pages");
  expect(lead).toContain("1 to check");
  expect(lead).not.toContain("4 questions");
});

test("confirmed unreadable source does not become pending attention again", () => {
  const lead = reviewLeadFor([{ tier: "unreadable", confirmed: true }], [{}],
    { questions_total: 1, parts_total: 1, unassigned_parts: 0, raw_region_count: 1 });
  expect(lead).toContain("all confirmed");
  expect(lead).not.toContain("to check");
});

test("unassigned and mandatory clean confirmations remain explicit", () => {
  const lead = reviewLeadFor([{ tier: "confident", confirmed: false }], [{}],
    { questions_total: 0, parts_total: 1, unassigned_parts: 1, raw_region_count: 1 });
  expect(lead).toContain("1 part not placed");
  expect(lead).toContain("1 to confirm");
});
