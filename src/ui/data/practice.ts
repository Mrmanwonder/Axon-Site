/* ═══════════════════════════════════════════════════════════════════════════
   PRACTICE, HOME FOCUS AND V1 ANALYTICS — the reads and writes (AXO-244)

   Every call is a Student Mode scoped RPC (supabase/migrations/
   20261013090000_* and 20261013090100_*). The server derives error items from
   confirmed evidence only, ranks them, schedules re-attempts and refuses any
   student outside the session's scope; this module only shapes the answers.

   Loading, failed and empty stay three different things here, as everywhere:
   a failed read returns an error the screen states, never an empty list.
   ═══════════════════════════════════════════════════════════════════════════ */

import { sb } from "./modules";

export type FocusKind = "due" | "topic" | "command_word" | "ao" | "mistake_type" | "subject" | "item";
export type MistakeType = "careless" | "technique" | "misconception" | "knowledge_gap";
export type Remedy = "retrieval" | "explain_then_retry" | "rewrite" | "final_check";
export type ReattemptResult = "got_it" | "partly" | "not_yet";

export type FocusArea = {
  kind: Exclude<FocusKind, "due" | "item">;
  key: string;
  label: string;
  subject: string | null;
  marks_recoverable: number;
  items_open: number;
  papers_seen: number;
  exam_date: string | null;
  exam_days: number | null;
  heaviest_paper: number | null;
  heaviest_weight_pct: number | null;
  score: number;
  reason: string;
};

export type NextBestAction =
  | { state: "no_scans" }
  | { state: "no_lost_marks" }
  | { state: "caught_up"; next_review_at: string | null }
  | { state: "nothing_due"; next_review_at: string | null }
  | {
      state: "ready";
      kind: FocusKind;
      key: string | null;
      label: string | null;
      subject: string | null;
      item_ids: string[];
      marks_recoverable: number;
      minutes: number;
      papers_seen?: number;
      reason: string;
    };

export type DueItem = {
  id: string;
  subject: string | null;
  question_label: string;
  paper_id: string;
  attempt_id: string | null;
  marks_lost: number;
  marks_available: number;
  minutes: number;
  next_review_at: string;
  overdue_days: number;
  status: "open" | "retried" | "fixed";
};

export type PracticeItem = {
  id: string;
  paper_id: string;
  attempt_id: string | null;
  question_label: string;
  subject: string | null;
  question_text: string | null;
  marks_available: number;
  marks_lost: number;
  command_word: string | null;
  remedy: Remedy;
  mistake_type: MistakeType | null;
  status: "open" | "retried" | "fixed";
  attempts: number;
};

export type Reveal = {
  marks_awarded: number | null;
  max_marks: number | null;
  marks_source: "teacher_pen" | "official_scheme" | null;
  teacher_remark: string | null;
  original_answer: string | null;
  explanation: string | null;
  do_this_next: string | null;
  model_answer: string | null;
  model_answer_source: string | null;
  command_word: string | null;
  command_word_note: string | null;
  scheme: { text: string; source: string; version: string } | null;
  scheme_withheld_reason: "no_scheme" | "not_permitted" | null;
};

export type JournalRow = {
  id: string;
  paper_id: string;
  attempt_id: string | null;
  question_label: string;
  subject: string | null;
  syllabus_code: string | null;
  topic_id: string | null;
  topic_label: string | null;
  command_word: string | null;
  ao: string | null;
  mistake_type: MistakeType | null;
  marks_lost: number;
  marks_available: number;
  original_answer: string | null;
  explanation: string | null;
  status: "open" | "retried" | "fixed";
  attempts: number;
  next_review_at: string;
  paper_date: string;
  recurrence_count: number;
};

export type ScorecardRow = {
  dimension: "command_word" | "ao";
  key: string;
  questions: number;
  papers: number;
  marks_gained: number;
  marks_available: number;
  weighted_gained: number;
  weighted_available: number;
  trend: { paper_id: string; date: string; gained: number; available: number }[];
};

export type ReadinessLevel = "no_data" | "attempted" | "familiar" | "proficient" | "mastered";
export type ReadinessRow = {
  topic_id: string;
  parent_id: string | null;
  code: string;
  title: string;
  depth: number;
  sort_order: number;
  level: ReadinessLevel;
  questions: number;
  papers: number;
  open_items: number;
  marks_recoverable: number;
  last_evidence_at: string | null;
};

export type GradeOutlook =
  | { state: "off" }
  | { state: "unsupported"; why: "no_syllabus_code" | "no_verified_thresholds" }
  | { state: "not_enough"; papers: number; needed: number; missing_papers: number[]; components: { paper: number; papers: number }[] }
  | {
      state: "ready";
      syllabus_code: string;
      series_key: string;
      option_code: string;
      /** Variants of the student's route the range was widened across. */
      routes?: number;
      /** The range covers this much of the likely spread (90), from the papers' own ups and downs (AXO-270). */
      interval?: number;
      /** Papers placed on these thresholds through the board's own grade lines for their series. */
      equated_papers?: number;
      source_url: string;
      papers: number;
      components: { paper: number; papers: number }[];
      low_grade: string;
      mid_grade: string | null;
      high_grade: string;
      low_total: number;
      mid_total: number;
      high_total: number;
      max_total: number;
      target: string | null;
      marks_to_target: number | null;
      suggested: string | null;
      stretch: string | null;
    };

export type ProgressSummary = {
  weeks: { week: string; marks: number }[];
  marks_recovered_total: number;
  topics_passed_30d: number;
  reattempts_this_week: number;
  session_dates: string[];
  today: string;
};

export type PracticePref = {
  student_id: string;
  timezone: string;
  outlook_opt_in: boolean;
  target_prompt_dismissed_at: string | null;
  if_then_cohort: "prompt" | "control" | null;
};

export type TargetGrade = { subject: string; grade: string; suggested: string | null };
export type PracticeFlags = { mistake_type_ui: boolean; if_then_prompt: boolean };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message || `${fn} failed`);
  return data as T;
}

const num = (v: unknown) => (v === null || v === undefined ? v : Number(v)) as number;

/* A reply in the wrong shape is a failed read, never a half-drawn card: the
   screen shows its failure state instead of crashing or guessing. */
const NBA_STATES = new Set(["no_scans", "no_lost_marks", "caught_up", "nothing_due", "ready"]);
function shapeError(fn: string): never { throw new Error(`${fn} returned an unexpected answer.`); }
function list<T>(fn: string, v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : shapeError(fn); }

export const practiceFlags = async () => {
  const r = await rpc<PracticeFlags>("practice_flags", {});
  // Flags fail closed: anything unexpected keeps the gated UI hidden.
  return { mistake_type_ui: r?.mistake_type_ui === true, if_then_prompt: r?.if_then_prompt === true };
};

export const nextBestAction = async (studentId: string) => {
  const r = await rpc<NextBestAction>("next_best_action", { p_student: studentId });
  if (!r || typeof r !== "object" || !NBA_STATES.has((r as { state?: string }).state ?? "")) shapeError("next_best_action");
  if (r.state === "ready" && !Array.isArray(r.item_ids)) shapeError("next_best_action");
  if (r.state === "ready") return { ...r, marks_recoverable: num(r.marks_recoverable), minutes: num(r.minutes) };
  return r;
};

export const focusAreas = async (studentId: string, subject: string | null = null, limit = 5) =>
  list<FocusArea>("focus_areas", await rpc<FocusArea[]>("focus_areas", { p_student: studentId, p_subject: subject, p_limit: limit }))
    .map((a) => ({ ...a, marks_recoverable: num(a.marks_recoverable), score: num(a.score), heaviest_weight_pct: num(a.heaviest_weight_pct) }));

export const dueQueue = async (studentId: string) =>
  list<DueItem>("due_queue", await rpc<DueItem[]>("due_queue", { p_student: studentId }))
    .map((d) => ({ ...d, marks_lost: num(d.marks_lost), marks_available: num(d.marks_available) }));

export const progressSummary = async (studentId: string) => {
  const r = await rpc<ProgressSummary>("progress_summary", { p_student: studentId });
  if (!r || typeof r !== "object" || Array.isArray(r) || !r.today) shapeError("progress_summary");
  return {
    ...r,
    weeks: (r.weeks ?? []).map((w) => ({ week: String(w.week).slice(0, 10), marks: num(w.marks) })),
    marks_recovered_total: num(r.marks_recovered_total),
    session_dates: (r.session_dates ?? []).map((d) => String(d).slice(0, 10)),
    today: String(r.today).slice(0, 10),
  };
};

export const startPracticeSession = (studentId: string, kind: FocusKind, opts: { key?: string | null; subject?: string | null; itemIds?: string[] } = {}) =>
  rpc<{ state: "started"; session_id: string; item_ids: string[]; minutes: number } | { state: "empty" }>("start_practice_session", {
    p_student: studentId, p_kind: kind, p_key: opts.key ?? null, p_subject: opts.subject ?? null, p_item_ids: opts.itemIds ?? null,
  });

export const practiceSession = async (sessionId: string) => {
  const { data, error } = await sb.from("practice_session")
    .select("id,student_id,focus_kind,focus_key,focus_subject,item_ids,budget_minutes,started_at,finished_at,completed_items")
    .eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as null | {
    id: string; student_id: string; focus_kind: FocusKind; focus_key: string | null; focus_subject: string | null;
    item_ids: string[]; budget_minutes: number; started_at: string; finished_at: string | null; completed_items: number;
  };
};

export const sessionResults = async (sessionId: string) => {
  const { data, error } = await sb.from("reattempt").select("error_item_id,result,status_after,interval_days").eq("session_id", sessionId);
  if (error) throw new Error(error.message);
  return (data ?? []) as { error_item_id: string; result: ReattemptResult; status_after: string; interval_days: number }[];
};

export const practiceItem = async (itemId: string) => {
  const r = await rpc<PracticeItem>("practice_item", { p_item: itemId });
  return { ...r, marks_available: num(r.marks_available), marks_lost: num(r.marks_lost) };
};

export const reattemptReveal = async (itemId: string) => {
  const r = await rpc<Reveal>("reattempt_reveal", { p_item: itemId });
  return { ...r, marks_awarded: num(r.marks_awarded), max_marks: num(r.max_marks) };
};

export const recordReattempt = (a: {
  sessionId: string; itemId: string; result: ReattemptResult; answer?: string; remedyText?: string;
  finalCheck?: Record<string, boolean> | null; startedAt?: string; revealedAt?: string;
}) => rpc<{ status: string; next_review_at: string; interval_days: number }>("record_reattempt", {
  p_session: a.sessionId, p_item: a.itemId, p_result: a.result,
  p_answer_text: a.answer ?? null, p_remedy_text: a.remedyText ?? null, p_final_check: a.finalCheck ?? null,
  p_started_at: a.startedAt ?? null, p_revealed_at: a.revealedAt ?? null,
});

export const finishPracticeSession = (sessionId: string) =>
  rpc<{ completed_items: number; local_date: string; first_of_week: boolean; ask_if_then: boolean }>("finish_practice_session", { p_session: sessionId });

export const recordIntention = (studentId: string, sessionId: string | null, plannedFor: Date, place: string | null) =>
  rpc<string>("record_intention", { p_student: studentId, p_session: sessionId, p_planned_for: plannedFor.toISOString(), p_place: place });

export const errorJournal = async (studentId: string) =>
  list<JournalRow>("error_journal", await rpc<JournalRow[]>("error_journal", { p_student: studentId }))
    .map((r) => ({ ...r, marks_lost: num(r.marks_lost), marks_available: num(r.marks_available) }));

export const scorecard = async (studentId: string, subject: string) =>
  list<ScorecardRow>("scorecard", await rpc<ScorecardRow[]>("scorecard", { p_student: studentId, p_subject: subject })).map((r) => ({
    ...r,
    marks_gained: num(r.marks_gained), marks_available: num(r.marks_available),
    weighted_gained: num(r.weighted_gained), weighted_available: num(r.weighted_available),
    trend: (r.trend ?? []).map((t) => ({ ...t, gained: num(t.gained), available: num(t.available) })),
  }));

export const topicReadiness = async (studentId: string, documentId: string) =>
  list<ReadinessRow>("topic_readiness", await rpc<ReadinessRow[]>("topic_readiness", { p_student: studentId, p_document: documentId }))
    .map((r) => ({ ...r, marks_recoverable: num(r.marks_recoverable) }));

export const gradeOutlook = (studentId: string, subject: string) =>
  rpc<GradeOutlook>("grade_outlook", { p_student: studentId, p_subject: subject });

export const practicePref = async (studentId: string) => {
  const { data, error } = await sb.from("student_practice_pref").select("*").eq("student_id", studentId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PracticePref | null;
};

export const setPracticePref = (studentId: string, p: { timezone?: string; outlookOptIn?: boolean; dismissTargetPrompt?: boolean }) =>
  rpc<PracticePref>("set_practice_pref", {
    p_student: studentId, p_timezone: p.timezone ?? null,
    p_outlook_opt_in: p.outlookOptIn ?? null, p_dismiss_target_prompt: p.dismissTargetPrompt ?? null,
  });

export const targetGrades = async (studentId: string) => {
  const { data, error } = await sb.from("student_target_grade").select("subject,grade,suggested").eq("student_id", studentId);
  if (error) throw new Error(error.message);
  return (data ?? []) as TargetGrade[];
};

export const targetGradeScale = (studentId: string) => rpc<string[] | null>("target_grade_scale", { p_student: studentId });

export const setTargetGrade = (studentId: string, subject: string, grade: string | null, suggested: string | null = null) =>
  rpc<null>("set_target_grade", { p_student: studentId, p_subject: subject, p_grade: grade, p_suggested: suggested });

/** The device's own IANA zone, written once per session so "today" and the
    streak are the student's day, not the server's. */
export function deviceTimeZone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

/** Three leaks, each a different area; the whole-subject fallback only when
    nothing more specific exists. */
export function topLeaks(areas: FocusArea[], showTypes = true): FocusArea[] {
  // A mistake-type leak with its label hidden would read "These questions":
  // until the classifier passes its bar it gives way to the next real leak.
  const visible = showTypes ? areas : areas.filter(a => a.kind !== "mistake_type");
  const specific = visible.filter(a => a.kind !== "subject");
  return (specific.length ? specific : visible).slice(0, 3);
}

/* ── copy helpers ── */

export const MISTAKE_TYPE_LABEL: Record<MistakeType, string> = {
  careless: "Slips",
  technique: "Exam technique",
  misconception: "Misunderstandings",
  knowledge_gap: "Not yet learned",
};

export const LEVEL_LABEL: Record<ReadinessLevel, string> = {
  no_data: "Not enough data",
  attempted: "Attempted",
  familiar: "Familiar",
  proficient: "Proficient",
  mastered: "Mastered",
};

export const marks = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? "mark" : "marks"}`;

/** "Rates of reaction", '"Explain" questions', "Exam technique", "Physics". */
export function focusLabel(a: { kind: FocusKind; key: string | null; label: string | null; subject: string | null }, showTypes: boolean): string {
  switch (a.kind) {
    case "topic": return a.label ?? "This topic";
    case "command_word": return `“${a.key}” questions`;
    case "ao": return `${a.key} questions`;
    case "mistake_type": return showTypes && a.key ? MISTAKE_TYPE_LABEL[a.key as MistakeType] ?? "These questions" : "These questions";
    case "subject": return a.subject ? `${a.subject} questions` : "Questions you lost marks on";
    case "due": return "Today’s re-attempts";
    default: return "This question";
  }
}
