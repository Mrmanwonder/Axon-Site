/* ═══════════════════════════════════════════════════════════════════════════
   THE SYLLABUS MAP

   One map per subject: the board's published topic tree, each topic shaded by
   the share of marks the student lost on questions placed on it. Pure, like
   insights.ts, so every cell can be reproduced from the rows behind it.

   Rules (owner decisions 4 Oct 2026 and Axon.md §8):
   · Darker means more marks lost. One hue, the accent. Never red, never a
     percentage on screen.
   · Untested stays untested: a topic with no question is an empty dashed cell,
     never weak and never zero.
   · Thin evidence is drawn as such: fewer than 3 questions or 2 papers is
     "early" and uses the light, bordered form (confidence is form, not colour).
   · No shading until the subject has 4 papers placed on its syllabus; before
     that the map shows only which topics have been tested.
   · A question on several objectives of one topic counts once for that topic.
   · Only evidence from the document chosen for the subject is used, and only
     from papers inside the current filters and filed under that subject.
   ═══════════════════════════════════════════════════════════════════════════ */

import { applyFilters, orderPapers, PATTERN_PAPERS, ALL_FILTERS } from "./insights";
import type { InsightAttempt, InsightFilters, InsightPaper, QuestionRef } from "./insights";

export type SyllabusSubject = { subject: string; subject_offering_id: string | null; display_name_snapshot: string | null; external_code_snapshot: string | null };
export type SyllabusLink = { subject_offering_id: string; document_id: string };
export type SyllabusDocument = {
  id: string; provider_key: string; syllabus_code: string; title: string; version_label: string;
  valid_from_year: number | null; valid_to_year: number | null; source_url: string; fetched_at: string;
};
export type SyllabusTopicRow = {
  id: string; document_id: string; parent_id: string | null; code: string; kind: "unit" | "topic" | "objective";
  title: string; objective_text: string | null; notes_text: string | null; group_title: string | null;
  qualification_scope: string | null; sort_order: number;
};
export type TopicEvidenceRow = {
  attempt_id: string; paper_id: string; topic_id: string; document_id: string; is_primary: boolean;
  max_marks: number | string | null; marks_awarded: number | string | null;
};
export type SyllabusMapInput = {
  subjects: SyllabusSubject[]; links: SyllabusLink[]; documents: SyllabusDocument[];
  topics: SyllabusTopicRow[]; evidence: TopicEvidenceRow[];
};

/** Below these a topic's evidence is drawn as early. */
export const EARLY_QUESTIONS = 3;
export const EARLY_PAPERS = 2;

export type ObjectiveCell = { id: string; code: string; text: string; notes: string | null; group: string | null; questions: number };
export type TopicCell = {
  id: string; code: string; title: string; scope: string | null;
  state: "untested" | "early" | "evidence";
  /** 0 = nothing lost … 4 = most lost. Null when untested or the subject is not ready for shading. */
  level: number | null;
  lost: number; available: number; questions: number; papers: number;
  objectives: ObjectiveCell[];
  refs: QuestionRef[];
};
export type UnitRow = { id: string; code: string; title: string; scope: string | null; cells: TopicCell[] };
export type SubjectMap = {
  offeringId: string;
  label: string;
  document: SyllabusDocument;
  units: UnitRow[];
  /** Papers in this subject (inside the filters) with at least one placed question. */
  papersPlaced: number;
  /** Questions in this subject not (yet) on the syllabus: pending, unplaceable or uncertain. */
  questionsUnplaced: number;
  questionsPlaced: number;
  shadingReady: boolean;
  topicsTested: number;
  topicsTotal: number;
};
export type SyllabusMaps = {
  maps: SubjectMap[];
  /** The student's subjects with no verified syllabus in Axon yet. */
  withoutSyllabus: string[];
};

const num = (v: unknown) => { const n = Number(v); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n; };
const round = (n: number) => Math.round(n * 100) / 100;

/** The edition covering this year, else the newest. Mirrors private.syllabus_for_paper. */
export function chooseDocument(docs: SyllabusDocument[], year: number): SyllabusDocument | null {
  return [...docs].sort((a, b) => {
    const covers = (d: SyllabusDocument) => (d.valid_from_year ?? 0) <= year && year <= (d.valid_to_year ?? 9999) ? 1 : 0;
    return covers(b) - covers(a) || (b.valid_to_year ?? 0) - (a.valid_to_year ?? 0) || Date.parse(b.fetched_at) - Date.parse(a.fetched_at);
  })[0] ?? null;
}

export function levelFor(lost: number, available: number): number {
  if (available <= 0 || lost <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((lost / available) * 4)));
}

export function buildSyllabusMaps(input: {
  data: SyllabusMapInput;
  papers: InsightPaper[];
  attempts: InsightAttempt[];
  filters?: InsightFilters;
  now?: number;
}): SyllabusMaps {
  const { data } = input;
  const now = input.now ?? Date.now();
  const filters = input.filters ?? ALL_FILTERS;
  const inScope = orderPapers(applyFilters(input.papers as (InsightPaper & { subject_offering_id?: string | null })[], { ...filters, subject: "all" }, now));
  const paperIndex = new Map(inScope.map((p, i) => [p.id, i]));
  const attemptById = new Map(input.attempts.map((a) => [a.id, a]));
  const docsById = new Map(data.documents.map((d) => [d.id, d]));
  const topicsByDoc = new Map<string, SyllabusTopicRow[]>();
  for (const t of data.topics) topicsByDoc.set(t.document_id, [...(topicsByDoc.get(t.document_id) ?? []), t]);

  const offerings = new Map<string, SyllabusSubject>();
  for (const s of data.subjects) if (s.subject_offering_id && !offerings.has(s.subject_offering_id)) offerings.set(s.subject_offering_id, s);

  const maps: SubjectMap[] = [];
  const withoutSyllabus: string[] = [];
  const year = new Date(now).getUTCFullYear();

  for (const [offeringId, subject] of offerings) {
    const label = (subject.display_name_snapshot ?? subject.subject).trim();
    const docs = data.links.filter((l) => l.subject_offering_id === offeringId).map((l) => docsById.get(l.document_id)).filter((d): d is SyllabusDocument => !!d);
    const document = chooseDocument(docs, year);
    if (!document || !(topicsByDoc.get(document.id) ?? []).length) { withoutSyllabus.push(label); continue; }
    if (filters.subject !== "all" && filters.subject !== label) continue;

    const subjectPapers = new Set(inScope.filter((p) => p.subject_offering_id === offeringId).map((p) => p.id));
    const rows = topicsByDoc.get(document.id)!;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const topicOf = (id: string): SyllabusTopicRow | null => {
      let r = byId.get(id) ?? null;
      while (r && r.kind === "objective") r = r.parent_id ? byId.get(r.parent_id) ?? null : null;
      return r && r.kind === "topic" ? r : null;
    };

    // topic id -> attempt id -> ref; objective id -> attempts
    const perTopic = new Map<string, Map<string, QuestionRef>>();
    const perObjective = new Map<string, Set<string>>();
    const placed = new Set<string>();
    const placedPapers = new Set<string>();
    const availableByAttempt = new Map<string, number>();
    for (const e of data.evidence) {
      if (e.document_id !== document.id || !subjectPapers.has(e.paper_id)) continue;
      const topic = topicOf(e.topic_id);
      if (!topic) continue;
      const a = attemptById.get(e.attempt_id);
      const max = num(e.max_marks); const got = num(e.marks_awarded);
      if (max === null || got === null || max <= 0) continue;
      placed.add(e.attempt_id);
      placedPapers.add(e.paper_id);
      const lost = Math.max(0, max - got);
      const m = perTopic.get(topic.id) ?? new Map<string, QuestionRef>();
      if (!m.has(e.attempt_id)) m.set(e.attempt_id, {
        paperId: e.paper_id, attemptId: e.attempt_id, label: (a?.question_label ?? "").trim() || "Question",
        marks: round(lost), paperIndex: paperIndex.get(e.paper_id) ?? 0,
      });
      perTopic.set(topic.id, m);
      availableByAttempt.set(e.attempt_id, max);
      if (byId.get(e.topic_id)?.kind === "objective") {
        perObjective.set(e.topic_id, (perObjective.get(e.topic_id) ?? new Set()).add(e.attempt_id));
      }
    }

    const papersPlaced = placedPapers.size;
    const shadingReady = papersPlaced >= PATTERN_PAPERS;
    const subjectAttempts = input.attempts.filter((a) => subjectPapers.has(a.paper_id) && num(a.max_marks) !== null && (num(a.max_marks) as number) > 0);

    const units: UnitRow[] = [];
    let topicsTested = 0; let topicsTotal = 0;
    for (const u of rows.filter((r) => r.kind === "unit")) {
      const cells: TopicCell[] = [];
      for (const t of rows.filter((r) => r.kind === "topic" && r.parent_id === u.id)) {
        topicsTotal += 1;
        const refs = [...(perTopic.get(t.id)?.values() ?? [])].sort((a, b) => b.paperIndex - a.paperIndex || b.marks - a.marks);
        const lost = round(refs.reduce((n, r) => n + r.marks, 0));
        const available = round(refs.reduce((n, r) => n + (availableByAttempt.get(r.attemptId) ?? 0), 0));
        const papers = new Set(refs.map((r) => r.paperId)).size;
        const state: TopicCell["state"] = !refs.length ? "untested" : refs.length < EARLY_QUESTIONS || papers < EARLY_PAPERS ? "early" : "evidence";
        if (refs.length) topicsTested += 1;
        cells.push({
          id: t.id, code: t.code, title: t.title, scope: t.qualification_scope,
          state, level: refs.length && shadingReady ? levelFor(lost, available) : null,
          lost, available, questions: refs.length, papers,
          objectives: rows.filter((o) => o.kind === "objective" && o.parent_id === t.id).map((o) => ({
            id: o.id, code: o.code, text: o.objective_text ?? o.title, notes: o.notes_text, group: o.group_title,
            questions: perObjective.get(o.id)?.size ?? 0,
          })),
          refs,
        });
      }
      if (cells.length) units.push({ id: u.id, code: u.code, title: u.title, scope: u.qualification_scope, cells });
    }

    maps.push({
      offeringId, label, document, units, papersPlaced, shadingReady, topicsTested, topicsTotal,
      questionsPlaced: placed.size,
      questionsUnplaced: subjectAttempts.filter((a) => !placed.has(a.id)).length,
    });
  }
  maps.sort((a, b) => b.questionsPlaced - a.questionsPlaced || a.label.localeCompare(b.label));
  return { maps, withoutSyllabus: withoutSyllabus.sort() };
}
