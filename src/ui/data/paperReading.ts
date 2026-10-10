import { parseQuestionLabel, projectQuestionRegions, questionDisplayPath } from "../../questionCount.js";
import { paperDateLabel, isCalendarDate } from "../../paperDate.js";
import type { PaperDetail, StudentAttempt } from "./modules";

export function paperIdentity(paper: PaperDetail, kind: string) {
  const verified = !!paper.subject_verified_at && !!paper.subject_offering_id && !!paper.subject_display_snapshot;
  const suggested = paper.subject_display_snapshot || paper.subject;
  return {
    title: verified ? `${paper.subject_display_snapshot} · ${kind}` : kind,
    subject: verified ? `Subject confirmed: ${paper.subject_display_snapshot}${paper.subject_external_code_snapshot ? ` · ${paper.subject_external_code_snapshot}` : ""}` : suggested ? `Subject suggested: ${suggested}` : "Subject not confirmed",
    added: paperDateLabel({ date_taken: paper.date_taken }),
    examDate: isCalendarDate(paper.exam_date) ? paperDateLabel(paper) : "Test date not recorded",
  };
}

export function partPath(question: number | null, part: string | null) {
  return questionDisplayPath(question, part);
}

export type ReadingPart = {
  attempt: StudentAttempt; question: number | null; part: string | null;
  label: string; inherited: boolean; page: number | null; stem: string | null;
};

/** The shared AXO-122 projection owns parent assignment and source ordering. */
export function paperReading(paper: PaperDetail) {
  const attempts = paper.student_attempt ?? [];
  const byAttempt = new Map(attempts.map(a => [a.id, a]));
  const regions = paper.question_region ?? [];
  const projected = projectQuestionRegions(regions.map((r, index) => {
    const attempt = r.committed_attempt_id ? byAttempt.get(r.committed_attempt_id) : undefined;
    return {
      reference: r, order_index: r.order_index ?? index, label: r.question_label === undefined ? attempt?.question_label ?? null : r.question_label,
      page: r.page_spans?.[0]?.page ?? null, y: r.page_spans?.[0]?.box.y ?? null,
      evidence: r.marks_awarded != null || r.marks_available != null || !!r.student_answer || !!r.question_text || !!attempt?.student_answer || !!attempt?.question_text,
    };
  }));
  const parts: ReadingPart[] = [];
  const seen = new Set<string>();
  for (const entry of projected.entries) {
    const source = entry.region as typeof projected.entries[number]["region"] & { reference: typeof regions[number] };
    const attempt = source.reference.committed_attempt_id ? byAttempt.get(source.reference.committed_attempt_id) : undefined;
    if (!attempt || seen.has(attempt.id)) continue;
    seen.add(attempt.id);
    parts.push({ attempt, question: entry.question, part: entry.part, inherited: entry.inherited,
      label: partPath(entry.question, entry.part), page: source.page, stem: attempt.question_text });
  }
  // Old offline copies have saved attempts but lack the source projection.
  // Explicit parent labels remain readable; missing provenance stays unknown.
  for (const attempt of attempts) {
    if (seen.has(attempt.id)) continue;
    const { q, part } = parseQuestionLabel(attempt.question_label);
    parts.push({ attempt, question: q, part, label: partPath(q, part), inherited: false, page: null, stem: attempt.question_text });
  }
  const grouped = new Map<number, ReadingPart[]>();
  const unassigned: ReadingPart[] = [];
  for (const part of parts) {
    if (part.question == null) unassigned.push(part);
    else { const group = grouped.get(part.question) ?? []; group.push(part); grouped.set(part.question, group); }
  }
  const groups = Array.from(grouped, ([question, items]) => {
    const unique = Array.from(new Set(items.map(i => i.stem).filter((s): s is string => !!s)));
    const parentStem = items.find(i => i.part == null)?.stem;
    return { question, items, sharedStem: parentStem || (items.length > 1 && unique.length === 1 ? unique[0] : null) };
  });
  const leaves = parts.filter(p => !parts.some(other => other !== p && p.question != null && other.question === p.question && (p.part == null ? other.part != null : !!other.part && other.part.startsWith(p.part) && other.part !== p.part)));
  const scored = leaves.filter(p => p.attempt.marks_awarded != null && p.attempt.max_marks != null && Number.isFinite(Number(p.attempt.marks_awarded)) && Number.isFinite(Number(p.attempt.max_marks)) && Number(p.attempt.marks_awarded) >= 0 && Number(p.attempt.max_marks) >= Number(p.attempt.marks_awarded));
  const confirmed = scored.filter(p => p.attempt.extraction_confidence !== "unsure" || !!p.attempt.student_confirmed_at);
  const awarded = confirmed.reduce((sum, p) => sum + Number(p.attempt.marks_awarded), 0);
  const maximum = confirmed.reduce((sum, p) => sum + Number(p.attempt.max_marks), 0);
  return { groups, unassigned, parts, leaves, scored: confirmed, awarded, maximum, lost: maximum - awarded,
    partial: paper.total_partial === true || confirmed.length !== leaves.length,
    counts: regions.length ? projected.counts : null,
  };
}
