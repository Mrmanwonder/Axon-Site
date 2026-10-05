import { describe, expect, test } from "vitest";
import {
  buildInsights, splitLoss, normaliseCommandWord, normaliseTopic, nextFocus, applyFilters,
  ALL_FILTERS, PATTERN_PAPERS,
} from "../../src/ui/data/insights";
import type { InsightAttempt, InsightLoss, InsightPaper } from "../../src/ui/data/insights";

const NOW = Date.parse("2026-10-04T00:00:00Z");

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

function paper(o: Partial<InsightPaper> & { date: string }): InsightPaper {
  return {
    id: o.id ?? id("paper"), type: o.type ?? "unit_test", tier: o.tier ?? "tier_1",
    date_taken: o.date, created_at: o.date, subject: o.subject ?? "Mathematics",
    total_available: o.total_available ?? null, total_awarded: o.total_awarded ?? null,
    total_partial: o.total_partial ?? false,
  };
}
function attempt(p: InsightPaper, o: Partial<InsightAttempt> = {}): InsightAttempt {
  return {
    id: o.id ?? id("att"), paper_id: p.id, question_label: o.question_label ?? "1",
    max_marks: o.max_marks ?? 4, marks_awarded: o.marks_awarded ?? 4,
    question_order: o.question_order ?? null, answer_blank: o.answer_blank ?? false,
  };
}
function loss(a: InsightAttempt, o: Partial<InsightLoss> = {}): InsightLoss {
  return {
    id: o.id ?? id("loss"), attempt_id: a.id, cause: o.cause ?? "procedural_slip",
    marks_lost: o.marks_lost ?? Number(a.max_marks) - Number(a.marks_awarded),
    do_this_next: o.do_this_next ?? null, command_word: o.command_word ?? null,
    concepts: o.concepts ?? null, loss_reasons: o.loss_reasons ?? null,
    depends_on_parts: o.depends_on_parts ?? null, created_at: o.created_at ?? "2026-10-01T00:00:00Z",
  };
}

/** n papers in one subject, each with one question that lost marks to `cause`. */
function series(n: number, cause = "procedural_slip", subject = "Mathematics") {
  const papers: InsightPaper[] = []; const attempts: InsightAttempt[] = []; const losses: InsightLoss[] = [];
  for (let i = 0; i < n; i++) {
    const p = paper({ date: `2026-0${1 + (i % 9)}-1${i % 9}`, subject });
    papers.push(p);
    const a = attempt(p, { marks_awarded: 2, max_marks: 4, question_label: `Q${i + 1}` });
    attempts.push(a, attempt(p, { max_marks: 3, marks_awarded: 3 }));
    losses.push(loss(a, { cause, do_this_next: `Fix number ${i + 1}` }));
  }
  return { papers, attempts, losses };
}

describe("evidence and gates", () => {
  test("nothing is called a pattern below four papers", () => {
    const m = buildInsights({ ...series(3), now: NOW });
    expect(m.evidence.papers).toBe(3);
    expect(m.evidence.enough).toBe(false);
    expect(m.patterns).toEqual([]);
    expect(m.checklist).toEqual([]);
    expect(nextFocus(m)).toBeNull();
  });

  test("a paper with no eligible attempt is not evidence", () => {
    const s = series(4);
    s.papers.push(paper({ date: "2026-09-30" }));
    const m = buildInsights({ ...s, now: NOW });
    expect(m.evidence.papers).toBe(4);
  });

  test("marks available and lost come from the teacher's marks on every eligible attempt", () => {
    const m = buildInsights({ ...series(4), now: NOW });
    expect(m.evidence.questions).toBe(8);
    expect(m.evidence.marksAvailable).toBe(28);
    expect(m.evidence.marksLost).toBe(8);
  });

  test("attempts whose marks were not read do not enter the denominator", () => {
    const s = series(4);
    s.attempts.push({ ...attempt(s.papers[0]), max_marks: null, marks_awarded: null });
    expect(buildInsights({ ...s, now: NOW }).evidence.marksAvailable).toBe(28);
  });
});

describe("cause split", () => {
  test("a per-mark breakdown that matches the teacher's loss is used", () => {
    const r = splitLoss({ cause: "incomplete", marks_lost: 3, loss_reasons: [
      { cause: "incomplete", marks: 1, error_type: "omitted_step" },
      { cause: "presentation", marks: 2, error_type: "presentation" },
    ] });
    expect(r.causes).toEqual([["incomplete", 1], ["presentation", 2]]);
    expect(r.stages).toEqual([["omitted_step", 1], ["presentation", 2]]);
  });

  test("a breakdown that disagrees with the teacher's loss falls back to the primary cause", () => {
    const r = splitLoss({ cause: "incomplete", marks_lost: 3, loss_reasons: [{ cause: "presentation", marks: 1, error_type: "presentation" }] });
    expect(r.causes).toEqual([["incomplete", 3]]);
    expect(r.stages).toBeNull();
  });

  test("an unknown cause is never counted", () => {
    expect(splitLoss({ cause: "made_up", marks_lost: 2, loss_reasons: null }).causes).toEqual([]);
    const r = splitLoss({ cause: "incomplete", marks_lost: 2, loss_reasons: [{ cause: "made_up", marks: 2 }] });
    expect(r.causes).toEqual([["incomplete", 2]]);
  });

  test("groups separate knowledge, exam technique and completion", () => {
    const s = series(4, "misread_question");
    s.losses[0] = { ...s.losses[0], cause: "conceptual_gap" };
    const m = buildInsights({ ...s, now: NOW });
    expect(m.groups).toEqual({ knowledge: 2, technique: 6, completion: 0 });
  });
});

describe("patterns", () => {
  test("the same cause in two papers of one subject is a pattern, with the latest fix quoted", () => {
    const m = buildInsights({ ...series(4), now: NOW });
    expect(m.patterns).toHaveLength(1);
    const p = m.patterns[0];
    expect(p.cause).toBe("procedural_slip");
    expect(p.papers).toBe(4);
    expect(p.recentHits).toBe(3);
    expect(p.fix?.text).toBe("Fix number 4");
    expect(m.checklist.map((c) => c.text)).toEqual(["Fix number 4"]);
    expect(nextFocus(m)?.fix.text).toBe("Fix number 4");
  });

  test("a cause in one paper only is not a pattern", () => {
    const s = series(4);
    s.losses = [s.losses[0]];
    expect(buildInsights({ ...s, now: NOW }).patterns).toEqual([]);
  });

  test("patterns are never merged across subjects", () => {
    const a = series(2, "keyword_miss", "Physics");
    const b = series(2, "keyword_miss", "Chemistry");
    const m = buildInsights({
      papers: [...a.papers, ...b.papers], attempts: [...a.attempts, ...b.attempts], losses: [...a.losses, ...b.losses], now: NOW,
    });
    expect(m.evidence.enough).toBe(true);
    expect(m.patterns.map((p) => p.subject).sort()).toEqual(["Chemistry", "Physics"]);
    // One subject alone in one paper is never promoted by the other subject's paper.
    const c = series(1, "keyword_miss", "Biology");
    const m2 = buildInsights({
      papers: [...a.papers, ...b.papers, ...c.papers], attempts: [...a.attempts, ...b.attempts, ...c.attempts], losses: [...a.losses, ...b.losses, ...c.losses], now: NOW,
    });
    expect(m2.patterns.find((p) => p.subject === "Biology")).toBeUndefined();
  });

  test("a cause absent from the last three papers is reported as fading, not as a pattern", () => {
    const s = series(6);
    // Keep the losses only on the first three (oldest) papers.
    const oldest = new Set(s.papers.slice(0, 3).map((p) => p.id));
    s.losses = s.losses.filter((l) => oldest.has(s.attempts.find((a) => a.id === l.attempt_id)!.paper_id));
    const m = buildInsights({ ...s, now: NOW });
    expect(m.patterns).toEqual([]);
    expect(m.fading).toEqual([{ cause: "procedural_slip", subject: "Mathematics", earlierPapers: 3, recentWindow: 3 }]);
  });

  test("a pattern without any fix text never produces a checklist line", () => {
    const s = series(4);
    s.losses = s.losses.map((l) => ({ ...l, do_this_next: "  " }));
    const m = buildInsights({ ...s, now: NOW });
    expect(m.patterns[0].fix).toBeNull();
    expect(m.checklist).toEqual([]);
    expect(nextFocus(m)).toBeNull();
  });
});

describe("filters", () => {
  test("filters narrow every module, not only the paper list", () => {
    const math = series(4, "procedural_slip", "Mathematics");
    const phys = series(4, "keyword_miss", "Physics");
    const all = { papers: [...math.papers, ...phys.papers], attempts: [...math.attempts, ...phys.attempts], losses: [...math.losses, ...phys.losses] };
    const m = buildInsights({ ...all, filters: { ...ALL_FILTERS, subject: "Physics" }, now: NOW });
    expect(m.evidence.papers).toBe(4);
    expect(m.causes.map((c) => c.cause)).toEqual(["keyword_miss"]);
  });

  test("last 90 days uses the paper date", () => {
    const papers = [paper({ date: "2026-09-01" }), paper({ date: "2026-03-01" })];
    expect(applyFilters(papers, { ...ALL_FILTERS, range: "term" }, NOW).map((p) => p.date_taken)).toEqual(["2026-09-01"]);
  });

  test("the subject display snapshot wins over the legacy subject", () => {
    const p = { ...paper({ date: "2026-09-01", subject: "maths" }), subject_display_snapshot: "Mathematics (9709)" };
    expect(applyFilters([p], { ...ALL_FILTERS, subject: "Mathematics (9709)" }, NOW)).toHaveLength(1);
  });
});

describe("trend", () => {
  test("partial totals never enter the trend", () => {
    const s = series(4);
    s.papers = s.papers.map((p, i) => ({ ...p, total_available: 20, total_awarded: 15, total_partial: i === 0 }));
    expect(buildInsights({ ...s, now: NOW }).trend.points).toHaveLength(3);
  });

  test("no direction is named under six complete papers, and small movements read as similar", () => {
    const s = series(6);
    s.papers = s.papers.map((p, i) => ({ ...p, total_available: 50, total_awarded: i < 3 ? 30 : 41 }));
    expect(buildInsights({ ...s, now: NOW }).trend.summary).toEqual({ direction: "fewer", earlier: 3, recent: 3 });
    s.papers = s.papers.map((p) => ({ ...p, total_awarded: 40 }));
    expect(buildInsights({ ...s, now: NOW }).trend.summary?.direction).toBe("similar");
    const five = series(5);
    five.papers = five.papers.map((p) => ({ ...p, total_available: 50, total_awarded: 40 }));
    expect(buildInsights({ ...five, now: NOW }).trend.summary).toBeNull();
  });
});

describe("question size", () => {
  test("bands need three questions and count every attempt, lost or not", () => {
    const p = paper({ date: "2026-09-01" });
    const attempts = [
      ...[1, 2, 2, 1].map((m) => attempt(p, { max_marks: m, marks_awarded: m })),
      ...[8, 9, 10, 8, 8].map((m) => attempt(p, { max_marks: m, marks_awarded: m - 3 })),
    ];
    const m = buildInsights({ papers: [p], attempts, losses: [], now: NOW });
    expect(m.tariff.map((b) => [b.key, b.lost, b.available, b.questions])).toEqual([
      ["1-2", 0, 6, 4], ["8+", 15, 43, 5],
    ]);
    expect(m.tariffNote).toContain("8+ mark questions");
  });
});

describe("command words, stages and topics", () => {
  test("command words are normalised, need three questions, and report coverage", () => {
    const s = series(5);
    s.losses[0].command_word = "explain"; s.losses[1].command_word = "Explain "; s.losses[2].command_word = "EXPLAIN";
    s.losses[3].command_word = "State"; s.losses[4].command_word = "state";
    const m = buildInsights({ ...s, now: NOW });
    // "State" covers two questions, under the owner's minimum of three, so it is not named.
    expect(m.commandWords.rows.map((r) => [r.word, r.questions, r.marks])).toEqual([["Explain", 3, 6]]);
    expect(m.commandWords.coverage).toEqual({ tagged: 5, total: 5 });
    expect(normaliseCommandWord("x".repeat(60))).toBeNull();
  });

  test("topics must recur across two papers; casing and spacing are folded", () => {
    const s = series(4);
    s.losses[0].concepts = ["Expected value", "Variance"];
    s.losses[1].concepts = ["expected  value."];
    s.losses[2].concepts = ["Variance"];
    s.losses[3].concepts = ["Probability trees"];
    const m = buildInsights({ ...s, now: NOW });
    expect(m.topics.map((t) => [normaliseTopic(t.label), t.papers])).toEqual([["expected value", 2], ["variance", 2]]);
  });

  test("answer stages come only from breakdowns that match the teacher's loss", () => {
    const s = series(4);
    s.losses[0].loss_reasons = [{ cause: "procedural_slip", marks: 2, error_type: "final_answer" }];
    s.losses[1].loss_reasons = [{ cause: "procedural_slip", marks: 1, error_type: "method" }];
    const m = buildInsights({ ...s, now: NOW });
    expect(m.stages.rows).toEqual([{ type: "final_answer", marks: 2, questions: 1 }]);
    expect(m.stages.coverage).toEqual({ split: 1, total: 4 });
  });
});

describe("pacing and knock-on", () => {
  function pacedPaper(date: string, tailBlank: number) {
    const p = paper({ date });
    const attempts = [0, 1, 2, 3, 4].map((i) => attempt(p, {
      question_order: i, max_marks: 3,
      marks_awarded: i >= 5 - tailBlank ? 0 : 3,
      answer_blank: i >= 5 - tailBlank,
    }));
    return { p, attempts };
  }

  test("trailing blank, zero-mark questions are counted in paper order and need two papers", () => {
    const a = pacedPaper("2026-09-01", 2); const b = pacedPaper("2026-09-08", 1);
    const c = pacedPaper("2026-09-15", 0); const d = pacedPaper("2026-09-22", 0);
    const m = buildInsights({ papers: [a.p, b.p, c.p, d.p], attempts: [...a.attempts, ...b.attempts, ...c.attempts, ...d.attempts], losses: [], now: NOW });
    expect(m.pacing).toMatchObject({ papersRead: 4, papersWithEndBlanks: 2, endBlankQuestions: 3, endBlankMarks: 9, isPattern: true });
  });

  test("a blank in the middle is not end-of-paper pacing, and papers without order are not read", () => {
    const p = paper({ date: "2026-09-01" });
    const attempts = [0, 1, 2].map((i) => attempt(p, { question_order: i, marks_awarded: i === 1 ? 0 : 4, answer_blank: i === 1 }));
    const unordered = paper({ date: "2026-09-02" });
    const m = buildInsights({ papers: [p, unordered], attempts: [...attempts, attempt(unordered), attempt(unordered), attempt(unordered)], losses: [], now: NOW });
    expect(m.pacing.papersRead).toBe(1);
    expect(m.pacing.papersWithEndBlanks).toBe(0);
  });

  test("an entirely blank paper is not a pacing signal", () => {
    const { p, attempts } = pacedPaper("2026-09-01", 5);
    expect(buildInsights({ papers: [p], attempts, losses: [], now: NOW }).pacing.papersWithEndBlanks).toBe(0);
  });

  test("knock-on counts losses built on an earlier part", () => {
    const s = series(4);
    s.losses[0].depends_on_parts = ["5(a)"];
    s.losses[1].depends_on_parts = [""];
    const m = buildInsights({ ...s, now: NOW });
    expect([m.knockOn.questions, m.knockOn.marks]).toEqual([1, 2]);
  });
});

test("the pattern threshold matches the copy rule", () => {
  expect(PATTERN_PAPERS).toBe(4);
});
