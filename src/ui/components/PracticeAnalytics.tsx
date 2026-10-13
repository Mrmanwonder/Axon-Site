/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHTS — v1 practice analytics for one subject (AXO-259 to 262)

   Three reads, one subject at a time, each with its own loading, failed and
   not-enough-data state:
   - Command words and AOs: marks lost against marks available, ordered by
     what they cost after each paper's weight in the qualification. A command
     word is named only once 3 questions on it lost marks (owner, 5 Oct).
   - Topic readiness: the ladder per syllabus point. No evidence is "Not
     enough data", drawn as a dashed outline, never as weak or zero.
   - Grade outlook: a prediction, so it is drawn only when the student turned
     it on (opt-in, never default; owner, 13 Oct). Always a range, always the
     papers and the series it rests on. Never on Home.

   Every row with something open ends in an action that starts practice on it.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PressBox from "./PressBox";
import Chevron from "./Chevron";
import Disclose from "./Disclose";
import { useApp } from "../data/AppProvider";
import { useResource } from "../data/useResource";
import { useStartPractice } from "../data/useHomePractice";
import { numMark } from "../data/causes";
import {
  errorJournal, gradeOutlook, practicePref, scorecard, topicReadiness, LEVEL_LABEL,
  type FocusKind, type GradeOutlook, type ReadinessLevel, type ReadinessRow, type ScorecardRow,
} from "../data/practice";
import type { SyllabusMaps } from "../data/syllabusMap";
import { paths } from "../app/paths";
import "../styles/practice.css";

/** Copy rule: with fewer than about four papers, say so; do not chart noise. */
export const SCORECARD_MIN_PAPERS = 4;
/** Owner, 5 Oct: a command word is named once it covers 3 questions that lost marks. */
export const COMMAND_WORD_MIN_LOST = 3;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const RUNGS: Record<ReadinessLevel, number> = { no_data: 0, attempted: 1, familiar: 2, proficient: 3, mastered: 4 };

function useDrill() {
  const start = useStartPractice();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drill = async (tag: string, kind: FocusKind, key: string, subject: string) => {
    setBusy(tag); setError(null);
    try { await start(kind, { key, subject }); } catch (e) { setError(e instanceof Error ? e.message : "That did not start. Try again."); setBusy(null); }
  };
  return { drill, busy, error };
}

export type ScorecardView = {
  rows: (ScorecardRow & { lost: number })[];
  hidden: number;
  untagged: ScorecardRow | null;
};

/** Shapes one dimension of the scorecard: the rules for what is named live here, tested. */
export function scorecardView(rows: ScorecardRow[], dimension: ScorecardRow["dimension"], lostQuestions: Map<string, number>): ScorecardView {
  const mine = rows.filter((r) => r.dimension === dimension);
  const untagged = mine.find((r) => r.key === "untagged") ?? null;
  const named = mine.filter((r) => r.key !== "untagged");
  const eligible = dimension === "command_word"
    ? named.filter((r) => (lostQuestions.get(r.key.toLowerCase()) ?? 0) >= COMMAND_WORD_MIN_LOST)
    : named;
  return {
    rows: eligible
      .map((r) => ({ ...r, lost: Math.max(0, r.marks_available - r.marks_gained) }))
      .sort((a, b) => (b.weighted_available - b.weighted_gained) - (a.weighted_available - a.weighted_gained) || b.lost - a.lost || a.key.localeCompare(b.key)),
    hidden: named.length - eligible.length,
    untagged,
  };
}

function ScoreRows({ view, kind, subject, drill, busy, noun }: {
  view: ScorecardView; kind: "command_word" | "ao"; subject: string; noun: string;
  drill: ReturnType<typeof useDrill>["drill"]; busy: string | null;
}) {
  return (
    <>
      {view.rows.map((r) => {
        const share = r.marks_available > 0 ? Math.min(1, r.lost / r.marks_available) : 0;
        const peak = Math.max(1, ...r.trend.map((t) => t.available));
        const label = kind === "command_word" ? `“${r.key}”` : r.key;
        return (
          <div className="sharerow scorerow" key={r.key}>
            <div className="top"><span className="n">{label}</span><span className="v">{numMark(r.lost)} of {numMark(r.marks_available)} lost</span></div>
            <div className="track" aria-hidden="true"><i style={{ transform: `scaleX(${share})` }} /></div>
            {r.trend.length >= 2 && (
              <div className="spark" role="img" aria-label={`Marks lost per paper, oldest first: ${r.trend.map((t) => `${numMark(t.available - t.gained)} of ${numMark(t.available)}`).join(", ")}`}>
                {r.trend.map((t) => <i key={t.paper_id} style={{ height: `${Math.max(8, ((t.available - t.gained) / peak) * 100)}%` }} />)}
              </div>
            )}
            <div className="meta">{plural(r.questions, "question")} · {plural(r.papers, "paper")}</div>
            {r.lost > 0 && (
              <PressBox as="button" type="button" className="textaction" disabled={busy !== null} aria-busy={busy === `${kind}:${r.key}`}
                        onClick={() => void drill(`${kind}:${r.key}`, kind, r.key, subject)}>
                Practise {noun === "command word" ? `“${r.key}” questions` : `${r.key} questions`} <Chevron />
              </PressBox>
            )}
          </div>
        );
      })}
    </>
  );
}

function Scorecard({ studentId, subject }: { studentId: string; subject: string }) {
  const { drill, busy, error } = useDrill();
  const { resource, reload } = useResource(`scorecard:${studentId}:${subject}`, async () => {
    const [rows, journal] = await Promise.all([scorecard(studentId, subject), errorJournal(studentId)]);
    const lostQuestions = new Map<string, number>();
    const seen = new Set<string>();
    for (const j of journal) {
      if (j.subject !== subject || !j.command_word) continue;
      const q = `${j.paper_id}:${j.question_label}`;
      if (seen.has(q)) continue;
      seen.add(q);
      const k = j.command_word.toLowerCase();
      lostQuestions.set(k, (lostQuestions.get(k) ?? 0) + 1);
    }
    return { data: { rows, lostQuestions } };
  });

  const papers = useMemo(() => Math.max(0, ...(resource.data?.rows ?? []).map((r) => r.papers)), [resource.data]);

  let body: React.ReactNode;
  if (!resource.data && resource.state === "failed") {
    body = <p className="widgetnote">The scorecard could not be loaded. <button type="button" className="textaction" onClick={() => void reload()}>Try again</button></p>;
  } else if (!resource.data) {
    body = <p className="widgetnote" role="status">Loading…</p>;
  } else if (papers < SCORECARD_MIN_PAPERS) {
    body = <p className="widgetnote">Not enough data yet. This needs {SCORECARD_MIN_PAPERS} papers in {subject}; {papers === 0 ? "none are" : `${plural(papers, "paper")} ${papers === 1 ? "is" : "are"}`} confirmed so far.</p>;
  } else {
    const cw = scorecardView(resource.data.rows, "command_word", resource.data.lostQuestions);
    const ao = scorecardView(resource.data.rows, "ao", resource.data.lostQuestions);
    body = (
      <>
        <div className="eyebrow" style={{ marginTop: 2 }}>By command word</div>
        {cw.rows.length ? <ScoreRows view={cw} kind="command_word" subject={subject} drill={drill} busy={busy} noun="command word" />
          : <p className="widgetnote">No command word has lost marks on {COMMAND_WORD_MIN_LOST} questions yet.</p>}
        <div className="eyebrow" style={{ marginTop: 14 }}>By assessment objective</div>
        {ao.rows.length ? <ScoreRows view={ao} kind="ao" subject={subject} drill={drill} busy={busy} noun="AO" />
          : <p className="widgetnote">No question here is tagged with an assessment objective yet. AOs come from the syllabus for supported codes only.</p>}
        <p className="widgetnote">
          {plural(papers, "paper")}. Ordered by marks lost after each paper&rsquo;s weight in the qualification.
          {cw.hidden > 0 ? ` ${plural(cw.hidden, "command word")} with fewer than ${COMMAND_WORD_MIN_LOST} questions that lost marks ${cw.hidden === 1 ? "is" : "are"} not named yet.` : ""}
          {cw.untagged && cw.untagged.questions > 0 ? ` ${plural(cw.untagged.questions, "question")} had no printed command word.` : ""}
        </p>
      </>
    );
  }
  return (
    <section className="isection">
      <div className="sectitle">Practice by command word and AO</div>
      <div className="card tallycard">{body}{error && <div role="alert" className="subnote">{error}</div>}</div>
    </section>
  );
}

function Ladder({ level }: { level: ReadinessLevel }) {
  const n = RUNGS[level];
  return (
    <span className={"ladder" + (level === "no_data" ? " nodata" : "")} aria-hidden="true">
      {[1, 2, 3, 4].map((i) => <i key={i} className={i <= n ? "on" : undefined} />)}
    </span>
  );
}

/** Units (the shallowest rows) with their direct children as topics. */
export function readinessUnits(rows: ReadinessRow[]): { unit: ReadinessRow; topics: ReadinessRow[] }[] {
  if (!rows.length) return [];
  const top = Math.min(...rows.map((r) => r.depth));
  const units = rows.filter((r) => r.depth === top);
  return units.map((unit) => ({ unit, topics: rows.filter((r) => r.parent_id === unit.topic_id) }));
}

function Readiness({ studentId, subject, documentId }: { studentId: string; subject: string; documentId: string | null }) {
  const { drill, busy, error } = useDrill();
  const { resource, reload } = useResource(documentId ? `readiness:${studentId}:${documentId}` : null, async () => ({ data: await topicReadiness(studentId, documentId!) }));

  let body: React.ReactNode;
  if (!documentId) {
    body = <p className="widgetnote">{subject} has no verified syllabus in Axon yet, so there is no map to place topics on.</p>;
  } else if (!resource.data && resource.state === "failed") {
    body = <p className="widgetnote">Readiness could not be loaded. <button type="button" className="textaction" onClick={() => void reload()}>Try again</button></p>;
  } else if (!resource.data) {
    body = <p className="widgetnote" role="status">Loading…</p>;
  } else {
    const units = readinessUnits(resource.data);
    const tested = resource.data.filter((r) => r.level !== "no_data").length;
    body = (
      <>
        <p className="widgetnote" style={{ marginTop: 0 }}>
          Attempted, Familiar, Proficient, Mastered. Rungs are earned through re-attempts and full marks, and slip back after 60 days without either.
          {" "}{tested} of {resource.data.length} syllabus points have evidence.
        </p>
        {units.map(({ unit, topics }) => {
          const rows = topics.length ? topics : [unit];
          const withData = rows.filter((r) => r.level !== "no_data").length;
          return (
            <Disclose key={unit.topic_id} label={`${unit.code} ${unit.title} · ${withData} of ${rows.length} with evidence`}>
              <ul className="readylist">
                {rows.map((r) => (
                  <li key={r.topic_id}>
                    <div className="t">
                      {r.code} {r.title}
                      <small>
                        {LEVEL_LABEL[r.level]}
                        {r.level !== "no_data" ? ` · ${plural(r.questions, "question")} · ${plural(r.papers, "paper")}` : ""}
                        {r.marks_recoverable > 0 ? ` · ${numMark(r.marks_recoverable)} ${r.marks_recoverable === 1 ? "mark" : "marks"} to win back` : ""}
                      </small>
                      {r.open_items > 0 && (
                        <PressBox as="button" type="button" className="textaction" disabled={busy !== null} aria-busy={busy === r.topic_id}
                                  onClick={() => void drill(r.topic_id, "topic", r.topic_id, subject)}>
                          Practise this <Chevron />
                        </PressBox>
                      )}
                    </div>
                    <span aria-label={LEVEL_LABEL[r.level]} role="img"><Ladder level={r.level} /></span>
                  </li>
                ))}
              </ul>
            </Disclose>
          );
        })}
      </>
    );
  }
  return (
    <section className="isection">
      <div className="sectitle">Topic readiness</div>
      <div className="card tallycard">{body}{error && <div role="alert" className="subnote">{error}</div>}</div>
    </section>
  );
}

/** The outlook in words. Never one grade on its own: a range, its basis, and what it takes. */
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-06" → "June 2026". */
export function seriesLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : key;
}

export function outlookLines(o: Extract<GradeOutlook, { state: "ready" }>): { range: string; basis: string; target: string | null } {
  const range = o.low_grade === o.high_grade ? `Around ${o.low_grade}` : `${o.low_grade} to ${o.high_grade}`;
  const papers = o.components.map((c) => c.paper).join(", ");
  const variants = o.routes && o.routes > 1 ? ` (${o.routes} variants, widest range)` : "";
  const basis = `Based on ${plural(o.papers, "paper")} · ${o.low_total} to ${o.high_total} of ${o.max_total} weighted marks · ${seriesLabel(o.series_key)} thresholds for ${o.syllabus_code}, papers ${papers}${variants}`;
  let target: string | null = null;
  if (o.target) {
    target = o.marks_to_target && o.marks_to_target > 0
      ? `About ${plural(o.marks_to_target, "more weighted mark")} across these papers would reach your target of ${o.target}, on these thresholds.`
      : `Your target of ${o.target} is inside or below this range on these thresholds.`;
  }
  return { range, basis, target };
}

function Outlook({ studentId, subject }: { studentId: string; subject: string }) {
  const { resource, reload } = useResource(`outlook:${studentId}:${subject}`, async () => {
    const pref = await practicePref(studentId);
    if (!pref?.outlook_opt_in) return { data: { state: "off" } as GradeOutlook };
    return { data: await gradeOutlook(studentId, subject) };
  });
  const o = resource.data;
  let body: React.ReactNode;
  if (!o && resource.state === "failed") {
    body = <p className="widgetnote">The outlook could not be loaded. <button type="button" className="textaction" onClick={() => void reload()}>Try again</button></p>;
  } else if (!o) {
    body = <p className="widgetnote" role="status">Loading…</p>;
  } else if (o.state === "off") {
    body = <p className="widgetnote" style={{ margin: 0 }}>Off. A projected grade range is only shown if you turn it on. <Link className="textaction" to={paths.settings}>Settings <Chevron /></Link></p>;
  } else if (o.state === "unsupported") {
    body = <p className="widgetnote" style={{ margin: 0 }}>{o.why === "no_syllabus_code"
      ? `${subject} has no syllabus code on your profile, so there are no thresholds to compare with.`
      : `No checked grade thresholds are loaded for ${subject} yet. Axon will not estimate a grade without them.`}</p>;
  } else if (o.state === "not_enough") {
    body = <p className="widgetnote" style={{ margin: 0 }}>
      Not enough data yet. An outlook needs {o.needed} complete, identified papers covering every paper you sit; you have {o.papers}.
      {o.missing_papers.length ? ` Nothing yet from paper ${o.missing_papers.join(", ")}.` : ""}
    </p>;
  } else {
    const l = outlookLines(o);
    body = (
      <>
        <div className="range">{l.range}</div>
        <div className="meta">{l.basis}</div>
        {l.target && <div className="meta">{l.target}</div>}
        <div className="meta">An estimate from your own teacher-marked papers, not a prediction anyone guarantees. <a className="textaction" href={o.source_url} target="_blank" rel="noreferrer">Thresholds source</a></div>
      </>
    );
  }
  return (
    <section className="isection">
      <div className="sectitle">Grade outlook</div>
      <div className="card outlookcard">{body}</div>
    </section>
  );
}

export default function PracticeAnalytics({ subjects, initialSubject, syllabus }: {
  subjects: string[]; initialSubject: string | null; syllabus: SyllabusMaps | null;
}) {
  const { student } = useApp();
  const [picked, setPicked] = useState<string | null>(null);
  const subject = picked ?? (initialSubject && subjects.includes(initialSubject) ? initialSubject : subjects[0] ?? null);
  if (!student || !subject) return null;
  const documentId = syllabus?.maps.find((m) => m.label === subject)?.document.id ?? null;

  return (
    <>
      <section className="isection">
        <div className="sectitle">Practice</div>
        <div className="analyticsselect">
          {subjects.length > 1 ? (
            <label>
              Subject{" "}
              <select value={subject} onChange={(e) => setPicked(e.target.value)} aria-label="Subject for practice analytics">
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          ) : <span>{subject}</span>}
          <PressBox as={Link} to={paths.journal} className="textaction" style={{ marginLeft: "auto" }}>Every lost mark <Chevron /></PressBox>
        </div>
      </section>
      <Scorecard key={`s:${subject}`} studentId={student.id} subject={subject} />
      <Readiness key={`r:${subject}`} studentId={student.id} subject={subject} documentId={documentId} />
      <Outlook key={`o:${subject}`} studentId={student.id} subject={subject} />
    </>
  );
}
