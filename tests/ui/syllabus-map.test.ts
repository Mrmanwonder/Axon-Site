import { describe, expect, test } from "vitest";
import { buildSyllabusMaps, chooseDocument, levelFor, EARLY_QUESTIONS } from "../../src/ui/data/syllabusMap";
import type { SyllabusMapInput, SyllabusDocument } from "../../src/ui/data/syllabusMap";
import { ALL_FILTERS } from "../../src/ui/data/insights";

const NOW = Date.parse("2026-10-04T00:00:00Z");
const PHYS = "off-phys";

const doc: SyllabusDocument = {
  id: "doc-phys", provider_key: "cambridge", syllabus_code: "9702", title: "Physics", version_label: "2025-2027",
  valid_from_year: 2025, valid_to_year: 2027, source_url: "https://example.test/9702.pdf", fetched_at: "2026-10-04T00:00:00Z",
};
const topics = [
  { id: "u1", parent_id: null, code: "2", kind: "unit", title: "Kinematics" },
  { id: "t1", parent_id: "u1", code: "2.1", kind: "topic", title: "Equations of motion" },
  { id: "o1", parent_id: "t1", code: "2.1.1", kind: "objective", title: "define displacement", objective_text: "define and use displacement" },
  { id: "o2", parent_id: "t1", code: "2.1.2", kind: "objective", title: "use graphs", objective_text: "use graphs of motion" },
  { id: "t2", parent_id: "u1", code: "2.2", kind: "topic", title: "Projectiles" },
  { id: "o3", parent_id: "t2", code: "2.2.1", kind: "objective", title: "projectile motion", objective_text: "describe projectile motion" },
].map((t, i) => ({ document_id: doc.id, objective_text: null, notes_text: null, group_title: null, qualification_scope: "AS", sort_order: i, ...t })) as SyllabusMapInput["topics"];

function scenario(papersCount: number) {
  const papers = Array.from({ length: papersCount }, (_, i) => ({
    id: `p${i}`, type: "unit_test", tier: "tier_1", date_taken: `2026-0${i + 1}-01`, subject_display_snapshot: "Physics", subject_offering_id: PHYS,
  }));
  const attempts = papers.flatMap((p, i) => [
    { id: `a${i}`, paper_id: p.id, question_label: `Q${i + 1}`, max_marks: 4, marks_awarded: 1, question_order: 0, answer_blank: false },
    { id: `b${i}`, paper_id: p.id, question_label: `R${i + 1}`, max_marks: 2, marks_awarded: 2, question_order: 1, answer_blank: false },
  ]);
  // Each a-question is tagged to BOTH objectives of 2.1 (counts once for the topic); b-questions are unplaced.
  const evidence = papers.flatMap((p, i) => ["o1", "o2"].map((o) => ({
    attempt_id: `a${i}`, paper_id: p.id, topic_id: o, document_id: doc.id, is_primary: o === "o1", max_marks: 4, marks_awarded: 1,
  })));
  const data: SyllabusMapInput = {
    subjects: [
      { subject: "Physics", subject_offering_id: PHYS, display_name_snapshot: "Physics", external_code_snapshot: "9702" },
      { subject: "Chemistry", subject_offering_id: "off-chem", display_name_snapshot: "Chemistry", external_code_snapshot: "9701" },
    ],
    links: [{ subject_offering_id: PHYS, document_id: doc.id }],
    documents: [doc], topics, evidence,
  };
  return { papers, attempts, data };
}

describe("syllabus map", () => {
  test("untested topics stay untested; a question on two objectives counts once for its topic", () => {
    const s = scenario(4);
    const { maps, withoutSyllabus } = buildSyllabusMaps({ ...s, now: NOW });
    expect(withoutSyllabus).toEqual(["Chemistry"]);
    const [m] = maps;
    const [eq, proj] = m.units[0].cells;
    expect([eq.questions, eq.lost, eq.available, eq.papers]).toEqual([4, 12, 16, 4]);
    expect(eq.state).toBe("evidence");
    expect(eq.objectives.map((o) => [o.code, o.questions])).toEqual([["2.1.1", 4], ["2.1.2", 4]]);
    expect(proj).toMatchObject({ state: "untested", level: null, questions: 0 });
    expect([m.topicsTested, m.topicsTotal]).toEqual([1, 2]);
    expect([m.questionsPlaced, m.questionsUnplaced]).toEqual([4, 4]);
  });

  test("a unit counts each placed question once and carries the radar's numbers", () => {
    const s = scenario(4);
    // Tag every a-question to the second topic too: still one question per attempt in the unit.
    s.data.evidence.push(...s.papers.map((p, i) => ({ attempt_id: `a${i}`, paper_id: p.id, topic_id: "o3", document_id: doc.id, is_primary: false, max_marks: 4, marks_awarded: 1 })));
    const u = buildSyllabusMaps({ ...s, now: NOW }).maps[0].units[0];
    expect([u.questions, u.papers, u.lost, u.available, u.topicsTested, u.state]).toEqual([4, 4, 12, 16, 2, "evidence"]);
  });

  test("a unit with no placed question is untested, with nothing lost and nothing available", () => {
    const s = scenario(4);
    s.data.evidence = [];
    const u = buildSyllabusMaps({ ...s, now: NOW }).maps[0].units[0];
    expect([u.state, u.questions, u.lost, u.available]).toEqual(["untested", 0, 0, 0]);
  });

  test("no shading until four papers are placed in the subject", () => {
    const three = buildSyllabusMaps({ ...scenario(3), now: NOW }).maps[0];
    expect(three.shadingReady).toBe(false);
    expect(three.units[0].cells[0].level).toBeNull();
    const four = buildSyllabusMaps({ ...scenario(4), now: NOW }).maps[0];
    expect(four.shadingReady).toBe(true);
    expect(four.units[0].cells[0].level).toBe(3); // 12 of 16 lost
  });

  test("thin evidence is early, even once the subject is ready for shading", () => {
    const s = scenario(4);
    s.data.evidence = s.data.evidence.filter((e) => e.attempt_id !== "a3" && e.attempt_id !== "a2");
    s.data.evidence.push(...["p2", "p3"].map((p, i) => ({ attempt_id: `x${i}`, paper_id: p, topic_id: "o3", document_id: doc.id, is_primary: true, max_marks: 2, marks_awarded: 0 })));
    const m = buildSyllabusMaps({ ...s, attempts: [...s.attempts, { id: "x0", paper_id: "p2", question_label: "5", max_marks: 2, marks_awarded: 0, question_order: 2, answer_blank: false }, { id: "x1", paper_id: "p3", question_label: "6", max_marks: 2, marks_awarded: 0, question_order: 2, answer_blank: false }], now: NOW }).maps[0];
    const proj = m.units[0].cells[1];
    expect(proj.questions).toBeLessThan(EARLY_QUESTIONS);
    expect(proj.state).toBe("early");
  });

  test("filters narrow the evidence; papers filed under another subject never count", () => {
    const s = scenario(4);
    s.papers[0] = { ...s.papers[0], subject_offering_id: "off-chem", subject_display_snapshot: "Chemistry" };
    const m = buildSyllabusMaps({ ...s, now: NOW }).maps[0];
    expect(m.units[0].cells[0].questions).toBe(3);
    const term = buildSyllabusMaps({ ...s, filters: { ...ALL_FILTERS, range: "term" }, now: NOW }).maps[0];
    expect(term.units[0].cells[0].questions).toBe(0); // all dated Jan–Apr
  });

  test("levels and edition choice", () => {
    expect([levelFor(0, 10), levelFor(1, 10), levelFor(5, 10), levelFor(10, 10)]).toEqual([0, 1, 2, 4]);
    const old = { ...doc, id: "old", valid_from_year: 2022, valid_to_year: 2024 };
    const next = { ...doc, id: "next", valid_from_year: 2028, valid_to_year: 2030 };
    expect(chooseDocument([old, next, doc], 2026)?.id).toBe("doc-phys");
    expect(chooseDocument([old, next], 2026)?.id).toBe("next");
  });
});
