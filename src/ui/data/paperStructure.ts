/* ═══════════════════════════════════════════════════════════════════════════
   PAPER STRUCTURE — a saved paper as questions and their parts

   The flat list of attempts becomes top-level questions with ordered parts. Placement
   is the AXO-122 contract (src/questionCount.js, one implementation shared with the
   count): a part's parent comes from its own label, or, for a bare part such as (c),
   from reading order when the page and position support it. Anything that cannot be
   placed stays visible as an unassigned part with its page — never merged into a
   question by guesswork and never dropped.

   Read-side only. Stored labels, ids and marks are not touched.
   ═══════════════════════════════════════════════════════════════════════════ */

import { countQuestions, placeRegions } from "../../questionCount.js";
import type { PaperDetail, StudentAttempt } from "./modules";
import { explanationGap } from "./explanationGap";
import type { ExplanationGap } from "./explanationGap";

export type PartMarks =
  | { kind: "marked"; awarded: number; max: number }
  | { kind: "unread"; max: number | null };

export type PaperPart = {
  attemptId: string;
  /** "1(b)", "5(a)(ii)", "(c)": how the part is named on screen. */
  path: string;
  /** Tail only ("(b)"), for the row once the question heading is shown. */
  partTail: string | null;
  page: number | null;
  prompt: string | null;
  marks: PartMarks;
  confidence: StudentAttempt["extraction_confidence"];
  confirmed: boolean;
  /** True when the parent came from reading order rather than the part's own label. */
  placedByPosition: boolean;
  explanationGap?: ExplanationGap;
};

export type PaperQuestion = {
  number: number;
  parts: PaperPart[];
};

export type PaperStructure = {
  questions: PaperQuestion[];
  unassigned: PaperPart[];
  counts: ReturnType<typeof countQuestions>;
  /** Parts whose mark was read, and parts whose mark was not: unmarked is never zero. */
  markedParts: number;
  unmarkedParts: number;
};

/** "b" -> "(b)", "a(ii)" -> "(a)(ii)". */
function partTail(part: string | null): string | null {
  if (!part) return null;
  const m = part.match(/^([a-z])(?:\(([ivx]+)\))?$/);
  if (m) return m[2] ? `(${m[1]})(${m[2]})` : `(${m[1]})`;
  return part.startsWith("(") ? part : `(${part})`;
}

const PROMPT_LIMIT = 120;

/** A short, faithful preview: whitespace collapsed, cut on a word boundary, never reworded. */
export function promptPreview(text: string | null | undefined): string | null {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.length <= PROMPT_LIMIT) return flat;
  const cut = flat.slice(0, PROMPT_LIMIT);
  const space = cut.lastIndexOf(" ");
  return `${(space > 60 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

type Ref = { attempt: StudentAttempt };

export function paperStructure(paper: Pick<PaperDetail, "student_attempt" | "question_region">): PaperStructure {
  const regionFor = new Map<string, PaperDetail["question_region"][number]>();
  for (const r of paper.question_region ?? []) {
    if (r.committed_attempt_id) regionFor.set(r.committed_attempt_id, r);
  }

  const regions = paper.student_attempt.map((attempt, i) => {
    const span = regionFor.get(attempt.id)?.page_spans?.[0];
    return {
      order_index: i,
      label: attempt.question_label,
      page: span?.page ?? null,
      y: span?.box?.y ?? null,
      // A committed attempt is always shown. This only decides whether it counts as a part.
      evidence:
        attempt.marks_awarded != null ||
        !!attempt.student_answer?.trim() ||
        !!attempt.question_text?.trim() ||
        !!attempt.question_label?.trim(),
      ref: { attempt } as Ref,
    };
  });

  const placed = placeRegions(regions) as {
    region: (typeof regions)[number];
    q: number | null;
    part: string | null;
    counted: boolean;
    unassigned: boolean;
    inferred: boolean;
  }[];

  const questions = new Map<number, PaperQuestion>();
  const unassigned: PaperPart[] = [];
  let markedParts = 0;
  let unmarkedParts = 0;

  for (const e of placed) {
    const { attempt } = e.region.ref;
    const marked = attempt.marks_awarded != null && attempt.max_marks != null;
    const tail = partTail(e.part);
    const path = e.q !== null ? `${e.q}${tail ?? ""}` : (attempt.question_label?.trim() || "Part");
    const part: PaperPart = {
      attemptId: attempt.id,
      path,
      partTail: tail,
      page: e.region.page,
      prompt: promptPreview(attempt.question_text),
      marks: marked
        ? { kind: "marked", awarded: Number(attempt.marks_awarded), max: Number(attempt.max_marks) }
        : { kind: "unread", max: attempt.max_marks != null ? Number(attempt.max_marks) : null },
      confidence: attempt.extraction_confidence,
      confirmed: !!attempt.student_confirmed_at,
      placedByPosition: e.inferred,
      explanationGap: explanationGap(attempt, regionFor.get(attempt.id)?.explain_status),
    };
    if (e.counted) {
      if (marked) markedParts += 1;
      else unmarkedParts += 1;
    }
    if (e.q === null) {
      unassigned.push(part);
      continue;
    }
    let q = questions.get(e.q);
    if (!q) {
      q = { number: e.q, parts: [] };
      questions.set(e.q, q);
    }
    q.parts.push(part);
  }

  return {
    // Map keeps first-appearance order in reading order: 10 never sorts before 2 lexically.
    questions: [...questions.values()],
    unassigned,
    counts: countQuestions(regions),
    markedParts,
    unmarkedParts,
  };
}
