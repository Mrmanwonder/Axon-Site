/* ═══════════════════════════════════════════════════════════════════════════
   THE INSIGHTS ENGINE

   Pure functions from eligible evidence to the claims Insights is allowed to
   make. No network, no React, no clock except the one passed in, so every
   sentence a student reads can be reproduced in a test from the rows behind it.

   ── What goes in ──
   Only rows read from `attempt_analytics` and `mark_loss_analytics` (hard
   rule 3). Unsure readings and causes the student rejected are already gone by
   the time a row reaches this file. Papers come from the library so filters
   can apply to them.

   ── What it refuses to do ──
   · It never computes or adjusts a mark. Marks lost are max minus awarded from
     the teacher's pen, or the explain stage's split of those same marks.
   · It never calls one paper a pattern. A recurring claim needs two different
     papers in the same subject, inside an evidence set of at least four papers.
   · It never merges a pattern across subjects. Cross-subject detection is a Pro
     capability gated server-side on `pattern_insight`; this file groups by
     subject and stops there.
   · It never ranks, compares or predicts the student. The only comparison is
     the student's own earlier papers against their own recent ones.
   · It never invents an action. "Do this next" text is quoted from the
     student's own explained questions, with a link back to the question.

   The research behind each module is in
   docs/claude_insights-research-and-design-2026-10-04.md.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CAUSES = [
  "conceptual_gap", "procedural_slip", "misread_question", "incomplete",
  "presentation", "keyword_miss", "timed_out",
] as const;
export type Cause = (typeof CAUSES)[number];

/** Cause groups. Technique causes are marks lost where the knowledge was there. */
export const CAUSE_GROUP: Record<Cause, "knowledge" | "technique" | "completion"> = {
  conceptual_gap: "knowledge",
  procedural_slip: "technique",
  misread_question: "technique",
  presentation: "technique",
  keyword_miss: "technique",
  incomplete: "completion",
  timed_out: "completion",
};

export const ERROR_TYPES = ["method", "final_answer", "omitted_step", "presentation", "other"] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

/** Minimum papers before anything is called a pattern (Axon.md §8). */
export const PATTERN_PAPERS = 4;
/** A recurring claim must appear in at least this many different papers. */
export const RECUR_PAPERS = 2;
/** The window "recent" means, in papers. */
export const RECENT_WINDOW = 3;

export type InsightPaper = {
  id: string;
  type: string;
  tier: string | null;
  date_taken: string;
  created_at?: string | null;
  subject?: string | null;
  subject_display_snapshot?: string | null;
  total_available?: number | string | null;
  total_awarded?: number | string | null;
  total_partial?: boolean | null;
};

export type InsightAttempt = {
  id: string;
  paper_id: string;
  question_label: string | null;
  max_marks: number | string | null;
  marks_awarded: number | string | null;
  question_order: number | null;
  answer_blank: boolean | null;
};

export type LossReason = { cause?: string | null; marks?: number | string | null; error_type?: string | null; note?: string | null };

export type InsightLoss = {
  id: string;
  attempt_id: string;
  cause: string;
  marks_lost: number | string;
  do_this_next: string | null;
  command_word: string | null;
  concepts: string[] | null;
  loss_reasons: LossReason[] | null;
  depends_on_parts: string[] | null;
  created_at: string;
};

export type InsightFilters = {
  subject: string; // "all" or a subject label
  type: string;    // "all" or paper.type
  tier: string;    // "all" | "tier_1" | "tier_2"
  range: string;   // "all" | "term"
};

export const ALL_FILTERS: InsightFilters = { subject: "all", type: "all", tier: "all", range: "all" };

/** One question a claim rests on, so every claim can be opened. */
export type QuestionRef = {
  paperId: string;
  attemptId: string;
  label: string;
  marks: number;
  paperIndex: number;
};

export type Tally = {
  marks: number;
  questions: number;
  papers: number;
  refs: QuestionRef[];
};

export type CauseRow = Tally & { cause: Cause; group: (typeof CAUSE_GROUP)[Cause] };

export type Pattern = Tally & {
  cause: Cause;
  subject: string | null;
  /** Papers in this subject inside the recent window, and how many of them show the cause. */
  recentHits: number;
  recentWindow: number;
  /** The student's own most recent fix for this cause, with its source. */
  fix: { text: string; ref: QuestionRef } | null;
};

export type Fading = { cause: Cause; subject: string | null; earlierPapers: number; recentWindow: number };

export type TrendPoint = { paperId: string; index: number; lost: number; available: number; date: string };

export type TariffBand = { key: string; label: string; lost: number; available: number; questions: number };

export type TopicRow = { label: string; questions: number; papers: number; marks: number; refs: QuestionRef[] };

export type CommandWordRow = Tally & { word: string };

export type StageRow = { type: ErrorType; marks: number; questions: number };

export type Pacing = {
  papersRead: number;
  papersWithEndBlanks: number;
  endBlankMarks: number;
  endBlankQuestions: number;
  timedOutMarks: number;
  refs: QuestionRef[];
  isPattern: boolean;
};

export type SubjectRow = { subject: string | null; lost: number; available: number; questions: number; papers: number };

export type InsightsModel = {
  evidence: {
    papers: number;
    questions: number;
    marksAvailable: number;
    marksLost: number;
    marksExplained: number;
    enough: boolean;
  };
  causes: CauseRow[];
  groups: { knowledge: number; technique: number; completion: number };
  patterns: Pattern[];
  fading: Fading[];
  checklist: { text: string; cause: Cause; ref: QuestionRef }[];
  trend: { points: TrendPoint[]; summary: TrendSummary | null };
  tariff: TariffBand[];
  tariffNote: string | null;
  commandWords: { rows: CommandWordRow[]; coverage: { tagged: number; total: number } };
  stages: { rows: StageRow[]; coverage: { split: number; total: number } };
  topics: TopicRow[];
  pacing: Pacing;
  knockOn: Tally;
  subjects: SubjectRow[];
};

export type TrendSummary = {
  direction: "fewer" | "more" | "similar";
  earlier: number;
  recent: number;
};

/* ── small, exact helpers ─────────────────────────────────────────────────── */

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Marks are whole numbers in this product; sums of whole numbers stay whole, but guard float drift. */
const round = (n: number) => Math.round(n * 100) / 100;

export const isCause = (v: unknown): v is Cause => typeof v === "string" && (CAUSES as readonly string[]).includes(v);
const isErrorType = (v: unknown): v is ErrorType => typeof v === "string" && (ERROR_TYPES as readonly string[]).includes(v);

/** The subject a paper is filed under, or null when it was never set. */
export function subjectOf(p: Pick<InsightPaper, "subject" | "subject_display_snapshot">): string | null {
  const s = (p.subject_display_snapshot ?? p.subject ?? "").trim();
  return s.length ? s : null;
}

/** Paper order: exam date, then upload time, then id, so the order is total and stable. */
function paperTime(p: InsightPaper): number {
  const d = Date.parse(p.date_taken);
  return Number.isFinite(d) ? d : 0;
}
export function orderPapers<T extends InsightPaper>(papers: T[]): T[] {
  return [...papers].sort((a, b) =>
    paperTime(a) - paperTime(b)
    || (Date.parse(a.created_at ?? "") || 0) - (Date.parse(b.created_at ?? "") || 0)
    || a.id.localeCompare(b.id));
}

export function applyFilters<T extends InsightPaper>(papers: T[], f: InsightFilters, now: number): T[] {
  const termStart = now - 90 * 86_400_000;
  return papers.filter((p) =>
    (f.subject === "all" || subjectOf(p) === f.subject)
    && (f.type === "all" || p.type === f.type)
    && (f.tier === "all" || p.tier === f.tier)
    && (f.range === "all" || paperTime(p) >= termStart));
}

/** "explain" -> "Explain"; "State and explain" -> "State and explain". Never invents a word. */
export function normaliseCommandWord(raw: string | null | undefined): string | null {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 40) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Topic tags are model text; only casing, spacing and edge punctuation are folded. */
export function normaliseTopic(raw: string): string {
  return raw.toLowerCase().replace(/[\s ]+/g, " ").replace(/^[\s.,;:()\-–]+|[\s.,;:()\-–]+$/g, "").trim();
}

/**
 * How one loss event's marks divide across causes and answer stages.
 *
 * The explain stage writes a per-mark breakdown (`loss_reasons`). It is used
 * only when it accounts for exactly the marks the teacher's pen took away; a
 * breakdown that sums to anything else is the model's arithmetic disagreeing
 * with the teacher, and the teacher wins, so the whole loss stays on the
 * event's primary cause.
 */
export function splitLoss(e: Pick<InsightLoss, "cause" | "marks_lost" | "loss_reasons">): {
  causes: [Cause, number][];
  stages: [ErrorType, number][] | null;
} {
  const total = num(e.marks_lost) ?? 0;
  const primary: Cause | null = isCause(e.cause) ? e.cause : null;
  const reasons = Array.isArray(e.loss_reasons) ? e.loss_reasons : [];
  const valid = reasons
    .map((r) => ({ cause: r?.cause, marks: num(r?.marks), type: r?.error_type }))
    .filter((r): r is { cause: Cause; marks: number; type: string | null | undefined } => isCause(r.cause) && r.marks !== null && r.marks > 0);
  const sum = valid.reduce((n, r) => n + r.marks, 0);
  if (valid.length && Math.abs(sum - total) < 0.01) {
    const byCause = new Map<Cause, number>();
    for (const r of valid) byCause.set(r.cause, (byCause.get(r.cause) ?? 0) + r.marks);
    const stagesOk = valid.every((r) => isErrorType(r.type));
    const byStage = new Map<ErrorType, number>();
    if (stagesOk) for (const r of valid) byStage.set(r.type as ErrorType, (byStage.get(r.type as ErrorType) ?? 0) + r.marks);
    return { causes: [...byCause], stages: stagesOk ? [...byStage] : null };
  }
  return { causes: primary && total > 0 ? [[primary, total]] : [], stages: null };
}

function emptyTally(): Tally { return { marks: 0, questions: 0, papers: 0, refs: [] }; }

function tallyFrom(refs: QuestionRef[]): Tally {
  const byAttempt = new Map<string, QuestionRef>();
  for (const r of refs) {
    const prev = byAttempt.get(r.attemptId);
    byAttempt.set(r.attemptId, prev ? { ...prev, marks: round(prev.marks + r.marks) } : r);
  }
  const merged = [...byAttempt.values()].sort((a, b) => b.paperIndex - a.paperIndex || b.marks - a.marks);
  return {
    marks: round(merged.reduce((n, r) => n + r.marks, 0)),
    questions: merged.length,
    papers: new Set(merged.map((r) => r.paperId)).size,
    refs: merged,
  };
}

/* ── the model ────────────────────────────────────────────────────────────── */

export function buildInsights(input: {
  papers: InsightPaper[];
  attempts: InsightAttempt[];
  losses: InsightLoss[];
  filters?: InsightFilters;
  now?: number;
}): InsightsModel {
  const filters = input.filters ?? ALL_FILTERS;
  const now = input.now ?? Date.now();

  const inScope = orderPapers(applyFilters(input.papers, filters, now));
  const scopeIds = new Set(inScope.map((p) => p.id));
  const attempts = input.attempts.filter((a) => scopeIds.has(a.paper_id));
  // Papers count as evidence only once at least one eligible attempt is on them.
  const evidencePapers = inScope.filter((p) => attempts.some((a) => a.paper_id === p.id));
  const paperIndex = new Map(evidencePapers.map((p, i) => [p.id, i]));
  const paperById = new Map(evidencePapers.map((p) => [p.id, p]));
  const attemptById = new Map(attempts.map((a) => [a.id, a]));
  const losses = input.losses.filter((l) => attemptById.has(l.attempt_id));

  const ref = (a: InsightAttempt, marks: number): QuestionRef => ({
    paperId: a.paper_id,
    attemptId: a.id,
    label: (a.question_label ?? "").trim() || "Question",
    marks: round(marks),
    paperIndex: paperIndex.get(a.paper_id) ?? 0,
  });

  /* Evidence. Available and lost come only from attempts with both marks read. */
  let marksAvailable = 0;
  let marksLost = 0;
  for (const a of attempts) {
    const max = num(a.max_marks); const got = num(a.marks_awarded);
    if (max === null || got === null || max <= 0) continue;
    marksAvailable += max;
    marksLost += Math.max(0, max - got);
  }

  /* Causes, split by the per-mark breakdown where it is trustworthy. */
  const causeRefs = new Map<Cause, QuestionRef[]>();
  const stageMarks = new Map<ErrorType, { marks: number; attempts: Set<string> }>();
  let stageSplit = 0;
  let marksExplained = 0;
  for (const l of losses) {
    const a = attemptById.get(l.attempt_id)!;
    const { causes, stages } = splitLoss(l);
    for (const [c, m] of causes) {
      marksExplained += m;
      causeRefs.set(c, [...(causeRefs.get(c) ?? []), ref(a, m)]);
    }
    if (stages) {
      stageSplit += 1;
      for (const [t, m] of stages) {
        const s = stageMarks.get(t) ?? { marks: 0, attempts: new Set<string>() };
        s.marks += m; s.attempts.add(a.id);
        stageMarks.set(t, s);
      }
    }
  }
  const causes: CauseRow[] = CAUSES
    .map((c) => ({ cause: c, group: CAUSE_GROUP[c], ...tallyFrom(causeRefs.get(c) ?? []) }))
    .filter((r) => r.marks > 0)
    .sort((a, b) => b.marks - a.marks || b.papers - a.papers || CAUSES.indexOf(a.cause) - CAUSES.indexOf(b.cause));
  const groups = { knowledge: 0, technique: 0, completion: 0 };
  for (const r of causes) groups[r.group] = round(groups[r.group] + r.marks);

  const enough = evidencePapers.length >= PATTERN_PAPERS;

  /* Patterns: the same cause in two or more papers of the same subject. */
  const bySubject = new Map<string | null, InsightPaper[]>();
  for (const p of evidencePapers) {
    const s = subjectOf(p);
    bySubject.set(s, [...(bySubject.get(s) ?? []), p]);
  }
  const lossesByCauseSubject = new Map<string, { loss: InsightLoss; marks: number }[]>();
  for (const l of losses) {
    const a = attemptById.get(l.attempt_id)!;
    const s = subjectOf(paperById.get(a.paper_id)!);
    for (const [c, m] of splitLoss(l).causes) {
      const k = `${c}\u0000${s ?? ""}`;
      lossesByCauseSubject.set(k, [...(lossesByCauseSubject.get(k) ?? []), { loss: l, marks: m }]);
    }
  }
  const patterns: Pattern[] = [];
  const fading: Fading[] = [];
  if (enough) {
    for (const [subject, subjectPapers] of bySubject) {
      const window = subjectPapers.slice(-RECENT_WINDOW).map((p) => p.id);
      for (const cause of CAUSES) {
        const items = lossesByCauseSubject.get(`${cause}\u0000${subject ?? ""}`) ?? [];
        if (!items.length) continue;
        const t = tallyFrom(items.map(({ loss, marks }) => ref(attemptById.get(loss.attempt_id)!, marks)));
        const hitPapers = new Set(t.refs.map((r) => r.paperId));
        const recentHits = window.filter((id) => hitPapers.has(id)).length;
        if (t.papers >= RECUR_PAPERS && recentHits > 0) {
          const withFix = items
            .filter(({ loss }) => (loss.do_this_next ?? "").trim().length > 0)
            .sort((x, y) =>
              (paperIndex.get(attemptById.get(y.loss.attempt_id)!.paper_id) ?? 0) - (paperIndex.get(attemptById.get(x.loss.attempt_id)!.paper_id) ?? 0)
              || Date.parse(y.loss.created_at) - Date.parse(x.loss.created_at));
          const latest = withFix[0];
          patterns.push({
            cause, subject, ...t, recentHits, recentWindow: window.length,
            fix: latest ? { text: latest.loss.do_this_next!.trim(), ref: ref(attemptById.get(latest.loss.attempt_id)!, latest.marks) } : null,
          });
        } else if (t.papers >= RECUR_PAPERS && recentHits === 0 && subjectPapers.length >= RECENT_WINDOW + RECUR_PAPERS) {
          // Seen in two or more earlier papers and in none of the last three: the
          // student's own record, not praise and not a prediction.
          fading.push({ cause, subject, earlierPapers: t.papers, recentWindow: window.length });
        }
      }
    }
  }
  patterns.sort((a, b) => b.recentHits - a.recentHits || b.marks - a.marks || b.papers - a.papers);

  /* Checklist: up to three distinct fixes from the strongest patterns. */
  const seen = new Set<string>();
  const checklist: InsightsModel["checklist"] = [];
  for (const p of patterns) {
    if (!p.fix) continue;
    const key = p.fix.text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    checklist.push({ text: p.fix.text, cause: p.cause, ref: p.fix.ref });
    if (checklist.length === 3) break;
  }

  /* Trend: complete teacher totals only, in paper order. */
  const points: TrendPoint[] = [];
  for (const p of evidencePapers) {
    const avail = num(p.total_available); const got = num(p.total_awarded);
    if (avail === null || got === null || avail <= 0 || p.total_partial === true) continue;
    points.push({ paperId: p.id, index: points.length + 1, lost: round(Math.max(0, avail - got)), available: avail, date: p.date_taken });
  }
  let summary: TrendSummary | null = null;
  if (points.length >= 6) {
    const half = Math.floor(points.length / 2);
    const share = (xs: TrendPoint[]) => xs.reduce((n, x) => n + x.lost, 0) / xs.reduce((n, x) => n + x.available, 0);
    const early = points.slice(0, half); const late = points.slice(points.length - half);
    const diff = share(late) - share(early);
    // Five points of share either way before a direction is named; smaller
    // movements are within what one harder paper explains.
    summary = { direction: diff <= -0.05 ? "fewer" : diff >= 0.05 ? "more" : "similar", earlier: early.length, recent: late.length };
  }

  /* Question size. Every eligible attempt counts, lost or not, so this is the one
     view where the denominator is complete. */
  const bands: { key: string; label: string; test: (m: number) => boolean }[] = [
    { key: "1-2", label: "1–2 mark questions", test: (m) => m <= 2 },
    { key: "3-4", label: "3–4 mark questions", test: (m) => m >= 3 && m <= 4 },
    { key: "5-7", label: "5–7 mark questions", test: (m) => m >= 5 && m <= 7 },
    { key: "8+", label: "8+ mark questions", test: (m) => m >= 8 },
  ];
  const tariff: TariffBand[] = bands.map((b) => ({ key: b.key, label: b.label, lost: 0, available: 0, questions: 0 }));
  for (const a of attempts) {
    const max = num(a.max_marks); const got = num(a.marks_awarded);
    if (max === null || got === null || max <= 0) continue;
    const i = bands.findIndex((b) => b.test(max));
    tariff[i].available += max; tariff[i].lost += Math.max(0, max - got); tariff[i].questions += 1;
  }
  const shownBands = tariff.filter((b) => b.questions >= 3).map((b) => ({ ...b, lost: round(b.lost), available: round(b.available) }));
  let tariffNote: string | null = null;
  if (shownBands.length >= 2) {
    // Each band against the rest of the student's questions, which is what the
    // sentence claims. A band needs five questions, four marks lost, and a gap
    // of at least ten points of share before it is named.
    const candidates = shownBands
      .filter((b) => b.questions >= 5 && b.lost >= 4)
      .map((b) => {
        const restAvail = marksAvailable - b.available;
        const restQuestions = shownBands.reduce((n, x) => n + (x.key === b.key ? 0 : x.questions), 0);
        const rest = restAvail > 0 ? (marksLost - b.lost) / restAvail : null;
        return { b, share: b.lost / b.available, rest, restQuestions };
      })
      .filter((c) => c.rest !== null && c.restQuestions >= 3 && c.share - (c.rest as number) >= 0.1 && c.share >= (c.rest as number) * 1.5)
      .sort((x, y) => (y.share - (y.rest as number)) - (x.share - (x.rest as number)));
    if (candidates[0]) tariffNote = `You lose a larger share of the marks on ${candidates[0].b.label} than on the rest of your questions.`;
  }

  /* Command words: only questions that lost marks carry one, so this counts
     losses, never a success rate. */
  const cwRefs = new Map<string, QuestionRef[]>();
  let cwTagged = 0;
  for (const l of losses) {
    const w = normaliseCommandWord(l.command_word);
    if (!w) continue;
    cwTagged += 1;
    cwRefs.set(w, [...(cwRefs.get(w) ?? []), ref(attemptById.get(l.attempt_id)!, num(l.marks_lost) ?? 0)]);
  }
  const commandWords = {
    rows: [...cwRefs].map(([word, refs]) => ({ word, ...tallyFrom(refs) }))
      .filter((r) => r.marks > 0)
      .sort((a, b) => b.marks - a.marks || b.questions - a.questions || a.word.localeCompare(b.word)),
    coverage: { tagged: cwTagged, total: losses.length },
  };

  const stages = {
    rows: ERROR_TYPES.map((t) => ({ type: t, marks: round(stageMarks.get(t)?.marks ?? 0), questions: stageMarks.get(t)?.attempts.size ?? 0 }))
      .filter((r) => r.marks > 0).sort((a, b) => b.marks - a.marks),
    coverage: { split: stageSplit, total: losses.length },
  };

  /* Topics: tags that recur across two or more papers. Tags on one event share
     its marks, so marks are reported as "on questions that lost N marks". */
  const topicMap = new Map<string, { label: string; labelPaper: number; refs: QuestionRef[] }>();
  for (const l of losses) {
    const a = attemptById.get(l.attempt_id)!;
    const tags = new Set<string>();
    for (const raw of l.concepts ?? []) {
      if (typeof raw !== "string") continue;
      const key = normaliseTopic(raw);
      if (key.length < 3 || tags.has(key)) continue;
      tags.add(key);
      const r = ref(a, num(l.marks_lost) ?? 0);
      const t = topicMap.get(key) ?? { label: raw.trim(), labelPaper: -1, refs: [] };
      if (r.paperIndex >= t.labelPaper) { t.label = raw.trim(); t.labelPaper = r.paperIndex; }
      t.refs.push(r);
      topicMap.set(key, t);
    }
  }
  const topics: TopicRow[] = [...topicMap.values()]
    .map((t) => { const tally = tallyFrom(t.refs); return { label: t.label, questions: tally.questions, papers: tally.papers, marks: tally.marks, refs: tally.refs }; })
    .filter((t) => t.papers >= RECUR_PAPERS)
    .sort((a, b) => b.papers - a.papers || b.marks - a.marks || a.label.localeCompare(b.label));

  /* Pacing: the longest run of unanswered, zero-mark questions at the end of
     each paper, read in paper order (Cambridge Assessment's speededness
     measure). Only papers whose question order is known are read. */
  const pacingRefs: QuestionRef[] = [];
  let papersRead = 0; let papersWithEndBlanks = 0; let endBlankMarks = 0; let endBlankQuestions = 0;
  for (const p of evidencePapers) {
    const rows = attempts.filter((a) => a.paper_id === p.id);
    if (rows.length < 3 || rows.some((a) => a.question_order === null || a.answer_blank === null)) continue;
    papersRead += 1;
    const ordered = [...rows].sort((a, b) => (a.question_order as number) - (b.question_order as number));
    const tail: InsightAttempt[] = [];
    for (let i = ordered.length - 1; i >= 0; i--) {
      const a = ordered[i];
      if (a.answer_blank === true && num(a.marks_awarded) === 0 && (num(a.max_marks) ?? 0) > 0) tail.push(a);
      else break;
    }
    // Every question blank is an unanswered paper, not a pacing signal.
    if (tail.length && tail.length < ordered.length) {
      papersWithEndBlanks += 1;
      for (const a of tail) {
        endBlankQuestions += 1;
        endBlankMarks += num(a.max_marks) ?? 0;
        pacingRefs.push(ref(a, num(a.max_marks) ?? 0));
      }
    }
  }
  const timedOut = causes.find((c) => c.cause === "timed_out");
  const pacing: Pacing = {
    papersRead, papersWithEndBlanks,
    endBlankMarks: round(endBlankMarks), endBlankQuestions,
    timedOutMarks: timedOut?.marks ?? 0,
    refs: pacingRefs.sort((a, b) => b.paperIndex - a.paperIndex),
    isPattern: enough && papersWithEndBlanks >= RECUR_PAPERS,
  };

  /* Knock-on: marks lost on parts the explain stage found were built on an
     earlier part's answer. */
  const knockRefs: QuestionRef[] = [];
  for (const l of losses) {
    if (!Array.isArray(l.depends_on_parts) || !l.depends_on_parts.some((x) => typeof x === "string" && x.trim())) continue;
    knockRefs.push(ref(attemptById.get(l.attempt_id)!, num(l.marks_lost) ?? 0));
  }
  const knockOn = knockRefs.length ? tallyFrom(knockRefs) : emptyTally();

  /* Subjects, each against its own denominator. */
  const subjects: SubjectRow[] = [...bySubject].map(([subject, ps]) => {
    const ids = new Set(ps.map((p) => p.id));
    let lost = 0; let available = 0; let questions = 0;
    for (const a of attempts) {
      if (!ids.has(a.paper_id)) continue;
      const max = num(a.max_marks); const got = num(a.marks_awarded);
      if (max === null || got === null || max <= 0) continue;
      available += max; lost += Math.max(0, max - got); questions += 1;
    }
    return { subject, lost: round(lost), available: round(available), questions, papers: ps.length };
  }).filter((s) => s.questions > 0)
    .sort((a, b) => (a.subject ?? "￿").localeCompare(b.subject ?? "￿"));

  return {
    evidence: {
      papers: evidencePapers.length,
      questions: attempts.length,
      marksAvailable: round(marksAvailable),
      marksLost: round(marksLost),
      marksExplained: round(marksExplained),
      enough,
    },
    causes, groups, patterns, fading, checklist,
    trend: { points, summary },
    tariff: shownBands, tariffNote,
    commandWords, stages, topics, pacing, knockOn, subjects,
  };
}

/** The single next action Home may name, or null when nothing is supported. */
export function nextFocus(model: InsightsModel): { pattern: Pattern; fix: NonNullable<Pattern["fix"]> } | null {
  if (!model.evidence.enough) return null;
  const p = model.patterns.find((x) => x.fix && x.recentHits >= 1);
  return p && p.fix ? { pattern: p, fix: p.fix } : null;
}
