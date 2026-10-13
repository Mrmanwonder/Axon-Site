// AXO-270: the accuracy rules behind Insights. Statistics, the printed
// command word, choice papers, command-word rates, where slips happen, topic
// normalisation and map shading.
import { describe, expect, test } from "vitest";
import fixture from "../fixtures/printed-command-words.json";
import { buildInsights, normaliseTopic, partKey } from "../../src/ui/data/insights";
import type { InsightAttempt, InsightLoss, InsightPaper } from "../../src/ui/data/insights";
import { printedCommandWord } from "../../src/ui/data/commandWords";
import { priorStrength, shareChange, shareSem, shrunkShare, twoProportionZ, wilson, DEFAULT_PRIOR_MARKS } from "../../src/ui/data/stats";
import { shadeFor, levelFor } from "../../src/ui/data/syllabusMap";

const NOW = Date.parse("2026-10-13T00:00:00Z");
let seq = 0;
const id = (p: string) => `${p}-${++seq}`;
const paper = (o: Partial<InsightPaper> & { date: string }): InsightPaper => ({
  id: o.id ?? id("paper"), type: "unit_test", tier: "tier_1", date_taken: o.date, created_at: o.date,
  subject: o.subject ?? "Physics", total_available: o.total_available ?? null, total_awarded: o.total_awarded ?? null,
  total_partial: false, stated_maximum: o.stated_maximum ?? null,
});
const attempt = (p: InsightPaper, o: Partial<InsightAttempt> = {}): InsightAttempt => ({
  id: o.id ?? id("att"), paper_id: p.id, question_label: o.question_label ?? "1",
  max_marks: o.max_marks ?? 4, marks_awarded: o.marks_awarded ?? 4,
  question_order: o.question_order ?? null, answer_blank: o.answer_blank ?? false, question_text: o.question_text ?? null,
});
const loss = (a: InsightAttempt, o: Partial<InsightLoss> = {}): InsightLoss => ({
  id: id("loss"), attempt_id: a.id, cause: o.cause ?? "procedural_slip",
  marks_lost: o.marks_lost ?? Number(a.max_marks) - Number(a.marks_awarded), do_this_next: null,
  command_word: o.command_word ?? null, concepts: o.concepts ?? null, loss_reasons: null,
  depends_on_parts: null, created_at: "2026-10-01T00:00:00Z",
});

describe("statistics", () => {
  test("one paper's measurement error follows the Ofqual SEM figures", () => {
    expect(shareSem(60)).toBeCloseTo(0.071, 2);     // about 4.3 marks on a 60-mark unit
    expect(shareSem(200)).toBeCloseTo(0.039, 2);    // about 7.8 marks on a 200-mark composite
    expect(shareSem(4)).toBe(0.25);                 // capped: a tiny quiz is mostly noise
  });

  test("Wilson intervals stay inside [0, 1] and narrow with evidence", () => {
    const small = wilson(1, 3)!; const big = wilson(100, 300)!;
    expect(small.lo).toBeGreaterThanOrEqual(0);
    expect(small.hi - small.lo).toBeGreaterThan(big.hi - big.lo);
    expect(wilson(0, 0)).toBeNull();
    expect(wilson(0, 5)!.lo).toBe(0);
  });

  test("shrinkage pulls thin evidence to the student's own rate and leaves thick evidence alone", () => {
    expect(shrunkShare(2, 2, 0.3, 10)).toBeCloseTo((2 + 3) / 12);
    expect(shrunkShare(60, 100, 0.3, 10)).toBeCloseTo(63 / 110);
    expect(priorStrength([{ lost: 1, available: 2 }])).toBe(DEFAULT_PRIOR_MARKS);
    // Groups that differ only by binomial noise get a strong prior.
    const same = Array.from({ length: 8 }, () => ({ lost: 3, available: 10 }));
    expect(priorStrength(same)).toBe(60);
    // Groups that really differ get a weaker one.
    const spread = [0, 1, 9, 10, 0, 10, 1, 9].map((lost) => ({ lost, available: 10 }));
    expect(priorStrength(spread)).toBeLessThan(10);
  });

  test("a change is named only above noise and a five-point floor", () => {
    const at = (xs: number[]) => xs.map((share) => ({ share, max: 80 }));
    expect(shareChange(at([0.5, 0.52, 0.48]), at([0.2, 0.22, 0.18]))?.direction).toBe("fewer");
    expect(shareChange(at([0.5, 0.52, 0.48]), at([0.45, 0.47, 0.43]))?.direction).toBe("similar");
    expect(shareChange(at([0.5]), at([0.2]))).toBeNull();
    expect(twoProportionZ(1, 30, 9, 30)!).toBeGreaterThan(1.96);
    expect(twoProportionZ(3, 30, 4, 30)!).toBeLessThan(1.96);
  });
});

describe("the printed command word", () => {
  test.each(fixture.cases as [string | null, string | null][])("%s", (text, expected) => {
    expect(printedCommandWord(text)).toBe(expected);
  });
});

describe("choice papers", () => {
  test("unanswered questions on a paper that offers a choice are left out, and counted", () => {
    // Four 10-mark essays, answer any two: the paper prints 20.
    const p = paper({ date: "2026-09-01", stated_maximum: 20 });
    const attempts = [
      attempt(p, { max_marks: 10, marks_awarded: 7, question_order: 0 }),
      attempt(p, { max_marks: 10, marks_awarded: 6, question_order: 1 }),
      attempt(p, { max_marks: 10, marks_awarded: 0, answer_blank: true, question_order: 2 }),
      attempt(p, { max_marks: 10, marks_awarded: 0, answer_blank: true, question_order: 3 }),
    ];
    const m = buildInsights({ papers: [p], attempts, losses: [loss(attempts[2], { cause: "incomplete" })], now: NOW });
    expect(m.evidence).toMatchObject({ marksAvailable: 20, marksLost: 7, choicePapers: 1, choiceSkipped: 2 });
    expect(m.causes).toEqual([]);
    expect(m.pacing.papersWithEndBlanks).toBe(0);
  });

  test("without a printed maximum, or when the questions fit it, blanks still count as lost", () => {
    const noMax = paper({ date: "2026-09-01" });
    const fits = paper({ date: "2026-09-02", stated_maximum: 20 });
    const attempts = [
      attempt(noMax, { max_marks: 10, marks_awarded: 0, answer_blank: true }), attempt(noMax, { max_marks: 10, marks_awarded: 10 }),
      attempt(fits, { max_marks: 10, marks_awarded: 0, answer_blank: true }), attempt(fits, { max_marks: 10, marks_awarded: 10 }),
    ];
    const m = buildInsights({ papers: [noMax, fits], attempts, losses: [], now: NOW });
    expect(m.evidence).toMatchObject({ marksLost: 20, choicePapers: 0, choiceSkipped: 0 });
  });
});

describe("command-word rates", () => {
  test("the rate counts every question that prints the word; the explain stage's tag never makes a rate", () => {
    const ps = [0, 1, 2, 3].map((i) => paper({ date: `2026-0${i + 1}-01` }));
    const attempts: InsightAttempt[] = []; const losses: InsightLoss[] = [];
    ps.forEach((p, i) => {
      // An Explain question that lost marks, an Explain question at full marks,
      // and a question with no printed word that the explain stage tagged.
      const lost = attempt(p, { question_text: "Explain why the current falls.", max_marks: 4, marks_awarded: 1 });
      const full = attempt(p, { question_text: "(b) Explain what is meant by drift velocity. [2]", max_marks: 2, marks_awarded: 2 });
      const untagged = attempt(p, { question_text: "The diagram shows a circuit.", max_marks: 3, marks_awarded: 1 });
      attempts.push(lost, full, untagged);
      losses.push(loss(lost, { command_word: "State" }), loss(untagged, { command_word: i < 3 ? "State" : null }));
    });
    const m = buildInsights({ papers: ps, attempts, losses, now: NOW });
    const explain = m.commandWords.rows.find((r) => r.word === "Explain")!;
    // The printed word wins over the explain stage's "State" on the same question.
    expect([explain.questions, explain.marks]).toEqual([4, 12]);
    expect(explain.rate).toMatchObject({ questions: 8, lost: 12, available: 24 });
    expect(explain.rate!.shrunk).toBeGreaterThan(0);
    const state = m.commandWords.rows.find((r) => r.word === "State")!;
    expect(state.questions).toBe(3);
    expect(state.rate).toBeNull();
  });
});

describe("where slips happen", () => {
  function paperWithSlips(date: string, slipAt: number[]) {
    const p = paper({ date });
    const attempts = Array.from({ length: 9 }, (_, i) => attempt(p, {
      question_order: i, max_marks: 3, marks_awarded: slipAt.includes(i) ? 1 : 3, question_label: `${i + 1}`,
    }));
    const losses = attempts.filter((_, i) => slipAt.includes(i)).map((a) => loss(a, { cause: "procedural_slip" }));
    return { p, attempts, losses };
  }
  const join = (xs: ReturnType<typeof paperWithSlips>[]) => ({
    papers: xs.map((x) => x.p), attempts: xs.flatMap((x) => x.attempts), losses: xs.flatMap((x) => x.losses),
  });

  test("slips that cluster in the last third, in more than one paper, are named", () => {
    const m = buildInsights({ ...join([
      paperWithSlips("2026-09-01", [6, 7, 8]), paperWithSlips("2026-09-08", [7, 8]),
      paperWithSlips("2026-09-15", [6, 8]), paperWithSlips("2026-09-22", [8]),
    ]), now: NOW });
    expect(m.slips.papersRead).toBe(4);
    expect(m.slips.last).toEqual({ slips: 8, questions: 12 });
    expect(m.slips.first.slips).toBe(0);
    expect(m.slips.note).toBe("late");
    expect(m.slips.refs).toHaveLength(8);
  });

  test("slips spread through the paper, or from one paper, are not", () => {
    const even = buildInsights({ ...join([
      paperWithSlips("2026-09-01", [0, 4, 8]), paperWithSlips("2026-09-08", [1, 5, 7]),
      paperWithSlips("2026-09-15", [2, 6]), paperWithSlips("2026-09-22", [0, 8]),
    ]), now: NOW });
    expect(even.slips.note).toBeNull();
    const onePaper = buildInsights({ ...join([
      paperWithSlips("2026-09-01", [6, 7, 8]), paperWithSlips("2026-09-08", []),
      paperWithSlips("2026-09-15", []), paperWithSlips("2026-09-22", []),
    ]), now: NOW });
    expect(onePaper.slips.note).toBeNull();
  });
});

describe("topic and part keys", () => {
  test("topic tags fold case, punctuation, articles and plain plurals, and nothing else", () => {
    expect(normaliseTopic("Newton's Laws")).toBe(normaliseTopic("newtons law"));
    expect(normaliseTopic("The Equations of Motion.")).toBe(normaliseTopic("equation of motion"));
    expect(normaliseTopic("Forces & Moments")).toBe(normaliseTopic("forces and moments"));
    expect(normaliseTopic("Kinematics")).toBe("kinematics");
    expect(normaliseTopic("Gas laws")).not.toBe(normaliseTopic("Gas laws of motion"));
    expect(normaliseTopic("Stress")).toBe("stress");
  });
  test("part labels compare without spacing and brackets", () => {
    expect(partKey("Q 3(b)(ii)")).toBe(partKey("3 b ii"));
    expect(partKey("5(a)")).not.toBe(partKey("5(b)"));
  });
});

describe("map shading", () => {
  test("one small question cannot take the darkest shade; a well-evidenced topic keeps its own", () => {
    expect(levelFor(2, 2)).toBe(4);
    expect(shadeFor(2, 2, 0.25, 10)).toBe(2);
    expect(shadeFor(36, 40, 0.25, 10)).toBe(4);
    expect(shadeFor(0, 40, 0.25, 10)).toBe(0);
  });
});
