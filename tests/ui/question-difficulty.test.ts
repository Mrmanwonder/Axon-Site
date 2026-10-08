import { expect, test } from "vitest";
import { questionDifficultyLabel, difficultyInsights } from "../../src/ui/data/questionDifficulty";
import { ALL_FILTERS } from "../../src/ui/data/insights";

const mkPaper = (id: string) => ({ id, date_taken: "2026-10-01", type: "test", tier: "tier_1", subject: "Mathematics" });
const mkAttempt = (id: string, paper_id: string) => ({
  id, paper_id, question_label: id, max_marks: 5, marks_awarded: 3, question_order: 1, answer_blank: false,
});
const mkRating = (id: string, paper_id: string, band = 3, confidence = .28) => ({
  attempt_id: id, paper_id, band, normalized_score: .5, confidence,
  source: "structural_estimate", method_version: "structural-v1", max_marks: 5, marks_awarded: 3,
});
const mkLoss = (id: string) => ({
  id: `loss-${id}`, attempt_id: id, cause: "procedural_slip", marks_lost: 2,
  do_this_next: null, command_word: null, concepts: ["Vectors"],
  loss_reasons: null, depends_on_parts: null, created_at: "2026-10-01",
});

test("structural and model ratings are clearly estimated; only published evidence claims official status", () => {
  expect(questionDifficultyLabel(mkRating("a", "p"))).toBe("Medium · estimated");
  expect(questionDifficultyLabel({ ...mkRating("a", "p"), source: "official_board_statistics" })).toBe("Medium · published evidence");
});

test("insights relate mark loss to medium rated questions in one topic across multiple papers", () => {
  const papers = [mkPaper("p1"),mkPaper("p2")];
  const attempts = [mkAttempt("a","p1"),mkAttempt("b","p2"),mkAttempt("c","p2")];
  const losses = attempts.map(a => mkLoss(a.id));
  const ratings = attempts.map(a => mkRating(a.id,a.paper_id));
  const result = difficultyInsights({papers,attempts,losses,ratings,filters:ALL_FILTERS,now:Date.parse("2026-10-05")});
  expect(result.rated).toBe(3);
  expect(result.rows).toMatchObject([{topic:"vectors",band:3,count:3,papers:2,lost:6,confidence:"low"}]);
});

test("one paper never makes a pattern; filtered-out student evidence cannot leak through", () => {
  const papers=[mkPaper("p1"),{...mkPaper("p2"),subject:"Physics"}];
  const attempts=[mkAttempt("a","p1"),mkAttempt("b","p1"),mkAttempt("c","p2")];
  const result=difficultyInsights({papers,attempts,losses:attempts.map(x=>mkLoss(x.id)),
    ratings:attempts.map(x=>mkRating(x.id,x.paper_id)),filters:{...ALL_FILTERS,subject:"Mathematics"},now:Date.parse("2026-10-05")});
  expect(result.rows).toEqual([]);
  expect(result.rated).toBe(2);
});
test("unknown or inconsistent marks cannot enter topic conclusions", () => {
  const papers=[mkPaper("p1"),mkPaper("p2")];
  const attempts=[mkAttempt("a","p1"),mkAttempt("b","p2"),mkAttempt("c","p2")];
  const ratings=[mkRating("a","p1"),mkRating("b","p2"),{...mkRating("c","p2"),marks_awarded:9}];
  const result=difficultyInsights({papers,attempts,losses:attempts.map(a=>mkLoss(a.id)),ratings,filters:ALL_FILTERS});
  expect(result.rows).toEqual([]);
});
