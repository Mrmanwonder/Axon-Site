/* ═══════════════════════════════════════════════════════════════════════════
   PRACTICE — the re-attempt loop (AXO-256, 257, 258)

   One session: 3 to 6 parts the student lost marks on, inside a 15-minute
   budget. For each part:

     1. The question, and nothing else. No explanation, no old answer, no mark.
     2. The student answers from memory (closed book).
     3. Reveal: the teacher's marks and remark, Axon's explanation, the worked
        answer where it is grounded, and scheme points only where the scheme on
        file may be reproduced (owner decision, 13 Oct 2026; hard rule 2 keeps
        Cambridge and Pearson scheme text out, and the screen says so).
     4. The student checks their own answer: got it, partly, not yet. This is
        their judgement of a practice answer, never a mark (hard rule 1).
     5. The remedy for the part's mistake type (AXO-257): retrieval and spacing,
        explain-then-retry, rewrite against the worked answer, or a final-check
        routine. The type's label stays hidden until the classifier passes its
        bar; the remedy runs regardless.
     6. The server schedules the next re-attempt and the next part opens.

   Progress is shown as steps and minutes used against the budget, never a
   countdown: the budget is a size, not a pressure. Nothing is lost on a closed
   tab — finished parts are saved as they finish and the session resumes.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";
import AcademicText from "../components/AcademicText";
import MathText from "../components/MathText";
import WorkedAnswer from "../components/WorkedAnswer";
import PageSkeleton from "../components/PageSkeleton";
import { useApp } from "../data/AppProvider";
import { numMark } from "../data/causes";
import {
  finishPracticeSession, practiceFlags, practiceItem, practiceSession, reattemptReveal, recordIntention, recordReattempt,
  sessionResults, MISTAKE_TYPE_LABEL, type PracticeItem, type ReattemptResult, type Remedy, type Reveal,
} from "../data/practice";
import { paths } from "../app/paths";
import { hapticFirm, hapticTick } from "../lib/haptics";
import "../styles/practice.css";

type Phase = "question" | "reveal" | "remedy";

const RESULT_LABEL: Record<ReattemptResult, string> = { got_it: "Got it", partly: "Partly", not_yet: "Not yet" };

const FINAL_CHECKS: { key: string; label: string }[] = [
  { key: "reread", label: "I reread the question and answered what it asked" },
  { key: "units", label: "Units and significant figures are right" },
  { key: "signs", label: "Signs and arithmetic are checked" },
  { key: "parts", label: "Every part of the question has an answer" },
];

const REMEDY_INTRO: Record<Remedy, string> = {
  retrieval: "Recalling it again later is what makes it stick, so this part comes back on a schedule.",
  explain_then_retry: "Say what was wrong with your first answer, then answer once more.",
  rewrite: "Rewrite your answer the way the worked answer sets it out.",
  final_check: "This mark went on a slip, so the fix is a checking routine rather than more revision.",
};

export default function Practice() {
  const { sessionId } = useParams();
  const { student } = useApp();
  const navigate = useNavigate();

  const [session, setSession] = useState<Awaited<ReturnType<typeof practiceSession>> | undefined>(undefined);
  const [done, setDone] = useState<Record<string, { result: ReattemptResult; interval_days: number; status: string }>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showTypes, setShowTypes] = useState(false);

  const [item, setItem] = useState<PracticeItem | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [phase, setPhase] = useState<Phase>("question");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ReattemptResult | null>(null);
  const [remedyText, setRemedyText] = useState("");
  const [retry, setRetry] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [startedAt, setStartedAt] = useState<string>(new Date().toISOString());
  const [revealedAt, setRevealedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [finish, setFinish] = useState<Awaited<ReturnType<typeof finishPracticeSession>> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [s, flags] = await Promise.all([practiceSession(sessionId!), practiceFlags().catch(() => null)]);
        if (!live) return;
        if (!s) { setSession(null); return; }
        const results = await sessionResults(s.id);
        if (!live) return;
        setSession(s);
        setShowTypes(Boolean(flags?.mistake_type_ui));
        setDone(Object.fromEntries(results.map((r) => [r.error_item_id, { result: r.result, interval_days: r.interval_days, status: r.status_after }])));
      } catch (e) {
        if (live) setLoadError(e instanceof Error ? e.message : "This session could not be opened.");
      }
    })();
    return () => { live = false; };
  }, [sessionId]);

  const current = useMemo(() => session?.item_ids.find((id) => !done[id]) ?? null, [session, done]);

  useEffect(() => {
    if (!current) return;
    let live = true;
    setItem(null); setReveal(null); setPhase("question"); setAnswer(""); setResult(null);
    setRemedyText(""); setRetry(""); setChecks({}); setStepError(null); setRevealedAt(null);
    setStartedAt(new Date().toISOString());
    practiceItem(current).then((i) => { if (live) setItem(i); })
      .catch((e) => { if (live) setStepError(e instanceof Error ? e.message : "This question could not be opened."); });
    return () => { live = false; };
  }, [current]);

  // Minutes used, refreshed gently. Not a countdown.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!session || current || finish || session.finished_at) return;
    finishPracticeSession(session.id).then(setFinish).catch(() => setFinish({ completed_items: Object.keys(done).length, local_date: "", first_of_week: false, ask_if_then: false }));
  }, [session, current, finish, done]);

  if (loadError) {
    return (
      <div className="practice">
        <p className="subnote">{loadError}</p>
        <PressBox as={Link} to={paths.home} className="btn ghost practice-back">Back to Home</PressBox>
      </div>
    );
  }
  if (session === undefined) return <PageSkeleton variant="question" label="Opening practice…" />;
  if (session === null) {
    return (
      <div className="practice">
        <p className="subnote">This practice session is not available. It may belong to another profile.</p>
        <PressBox as={Link} to={paths.home} className="btn ghost practice-back">Back to Home</PressBox>
      </div>
    );
  }

  const total = session.item_ids.length;
  const finished = Object.keys(done).length;
  const usedMin = Math.max(0, Math.round((now - new Date(session.started_at).getTime()) / 60_000));

  if (!current) {
    return <SessionDone sessionId={session.id} studentId={student?.id ?? null} done={done} total={total} finish={finish}
                        onHome={() => navigate(paths.home)} />;
  }

  const doReveal = async () => {
    if (!item) return;
    setBusy(true); setStepError(null);
    try {
      const r = await reattemptReveal(item.id);
      setReveal(r);
      setRevealedAt(new Date().toISOString());
      setPhase("reveal");
      hapticTick();
    } catch (e) {
      setStepError(e instanceof Error ? e.message : "The explanation could not be loaded.");
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!item || !result) return;
    setBusy(true); setStepError(null);
    try {
      const text = item.remedy === "explain_then_retry"
        ? [remedyText.trim(), retry.trim() ? `Retry: ${retry.trim()}` : ""].filter(Boolean).join("\n\n")
        : item.remedy === "rewrite" ? remedyText : undefined;
      const r = await recordReattempt({
        sessionId: session.id, itemId: item.id, result, answer,
        remedyText: text, finalCheck: item.remedy === "final_check" ? checks : null,
        startedAt, revealedAt: revealedAt ?? undefined,
      });
      hapticFirm();
      setDone((d) => ({ ...d, [item.id]: { result, interval_days: r.interval_days, status: r.status } }));
    } catch (e) {
      setStepError(e instanceof Error ? e.message : "That did not save. Your answer is still here; try again.");
    } finally { setBusy(false); }
  };

  const remedyReady = !item ? false
    : item.remedy === "explain_then_retry" ? remedyText.trim().length > 0
    : item.remedy === "rewrite" ? remedyText.trim().length > 0 || result === "got_it"
    : item.remedy === "final_check" ? FINAL_CHECKS.every((c) => checks[c.key])
    : true;

  return (
    <div className="practice">
      <div className="practice-top">
        <PressBox as={Link} to={paths.home} className="textaction" aria-label="Leave practice; finished parts are saved">Leave</PressBox>
        <div className="practice-progress" aria-label={`Part ${finished + 1} of ${total}. ${usedMin} of ${session.budget_minutes} minutes used.`}>
          <div className="growsteps" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, margin: 0 }}>
            {session.item_ids.map((id) => <i key={id} className={done[id] || id === current ? "on" : undefined} />)}
          </div>
          <span>{finished + 1} of {total} · {Math.min(usedMin, 99)} of {session.budget_minutes} min</span>
        </div>
      </div>

      {!item ? (
        stepError ? <p className="subnote" role="alert">{stepError}</p> : <div className="subnote" role="status">Loading the question…</div>
      ) : (
        <div className="qcard practice-card">
          <div className="qhead">
            <h1 className="t1">{item.subject ? `${item.subject} · ` : ""}{item.question_label}</h1>
            <span className="qmarks">{numMark(item.marks_available)}<small> {item.marks_available === 1 ? "mark" : "marks"}</small></span>
          </div>
          {showTypes && item.mistake_type && <div className="practice-type">{MISTAKE_TYPE_LABEL[item.mistake_type]}</div>}

          <div className="qfield">
            <div className="k">Question</div>
            <div className="v">
              {item.question_text ? <AcademicText text={item.question_text} />
                : <>The question text was not read from your paper. <Link to={paths.question(item.paper_id, item.attempt_id ?? "")}>Open it on the paper</Link>, cover your old answer, and answer here.</>}
            </div>
          </div>

          <div className="qfield">
            <label className="k" htmlFor="practice-answer">Your answer, from memory</label>
            <textarea id="practice-answer" className="practice-input" rows={5} value={answer} readOnly={phase !== "question"}
                      onChange={(e) => setAnswer(e.target.value)} placeholder="Write it as you would in the exam" />
          </div>

          {phase === "question" && (
            <div className="practice-actions">
              <PressBox as="button" type="button" className="btn primary" disabled={busy || !answer.trim()} aria-busy={busy} onClick={() => void doReveal()}>
                Check my answer
              </PressBox>
              <PressBox as="button" type="button" className="btn plain" disabled={busy} onClick={() => void doReveal()}>
                I can&rsquo;t recall it
              </PressBox>
            </div>
          )}

          {phase !== "question" && reveal && <RevealBlock reveal={reveal} />}

          {phase === "reveal" && (
            <div className="qfield">
              <div className="k">How did your answer compare?</div>
              <div className="practice-results" role="group" aria-label="Your check of this answer">
                {(["got_it", "partly", "not_yet"] as ReattemptResult[]).map((r) => (
                  <PressBox key={r} as="button" type="button" className={"btn ghost" + (result === r ? " on" : "")}
                            aria-pressed={result === r} onClick={() => { setResult(r); hapticTick(); }}>
                    {RESULT_LABEL[r]}
                  </PressBox>
                ))}
              </div>
              <div className="practice-note">Your own check of a practice answer. It never changes your teacher&rsquo;s marks.</div>
              <div className="practice-actions">
                <PressBox as="button" type="button" className="btn primary" disabled={!result} onClick={() => setPhase("remedy")}>Continue</PressBox>
              </div>
            </div>
          )}

          {phase === "remedy" && result && (
            <div className="qfield">
              <div className="k">Fix it</div>
              <p className="practice-lede">{REMEDY_INTRO[item.remedy]}</p>

              {item.remedy === "explain_then_retry" && (
                <>
                  <label className="practice-label" htmlFor="why-wrong">Why was your first answer wrong?</label>
                  <textarea id="why-wrong" className="practice-input" rows={3} value={remedyText} onChange={(e) => setRemedyText(e.target.value)} />
                  <label className="practice-label" htmlFor="retry">Now answer it again</label>
                  <textarea id="retry" className="practice-input" rows={4} value={retry} onChange={(e) => setRetry(e.target.value)} />
                </>
              )}

              {item.remedy === "rewrite" && (
                <>
                  {reveal?.command_word && (
                    <p className="practice-lede">
                      The question says <b>{reveal.command_word}</b>.{reveal.command_word_note ? <> <MathText text={reveal.command_word_note} /></> : null}
                    </p>
                  )}
                  <label className="practice-label" htmlFor="rewrite">Your rewritten answer</label>
                  <textarea id="rewrite" className="practice-input" rows={5} value={remedyText} onChange={(e) => setRemedyText(e.target.value)} />
                </>
              )}

              {item.remedy === "final_check" && (
                <fieldset className="practice-checks">
                  <legend className="practice-label">Run the check on your answer above</legend>
                  {FINAL_CHECKS.map((c) => (
                    <label key={c.key} className="practice-check">
                      <input type="checkbox" checked={Boolean(checks[c.key])} onChange={(e) => setChecks((v) => ({ ...v, [c.key]: e.target.checked }))} />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              <div className="practice-actions">
                <PressBox as="button" type="button" className="btn primary" disabled={busy || !remedyReady} aria-busy={busy} onClick={() => void save()}>
                  {finished + 1 < total ? "Save and next" : "Save and finish"}
                </PressBox>
              </div>
            </div>
          )}

          {stepError && <p className="subnote" role="alert">{stepError}</p>}
        </div>
      )}
    </div>
  );
}

function RevealBlock({ reveal }: { reveal: Reveal }) {
  return (
    <>
      <div className="qfield">
        <div className="k">Your teacher&rsquo;s marks</div>
        <div className="v">
          {reveal.marks_awarded != null && reveal.max_marks != null
            ? <>{numMark(reveal.marks_awarded)} of {numMark(reveal.max_marks)}{reveal.teacher_remark ? <> · &ldquo;{reveal.teacher_remark}&rdquo;</> : null}</>
            : "Not read"}
        </div>
      </div>
      {reveal.explanation && (
        <div className="qfield">
          <div className="k">Where the marks went</div>
          <div className="v"><MathText text={reveal.explanation} /></div>
        </div>
      )}
      {reveal.do_this_next && (
        <div className="qfield"><div className="v"><b>Do this next.</b> <MathText text={reveal.do_this_next} /></div></div>
      )}
      {reveal.model_answer && (
        <div className="qfield">
          <div className="k">Worked answer</div>
          <div className="worked"><WorkedAnswer text={reveal.model_answer} /></div>
          <div className="wnote">
            {reveal.model_answer_source === "verified_scheme"
              ? "From the official marking scheme for this paper."
              : "Axon’s own method, not a mark scheme: one way to reach the answer."}
          </div>
        </div>
      )}
      {reveal.scheme ? (
        <div className="qfield">
          <div className="k">Mark scheme</div>
          <div className="v steps"><MathText text={reveal.scheme.text} /></div>
          <div className="wnote">{reveal.scheme.source}, {reveal.scheme.version}</div>
        </div>
      ) : reveal.scheme_withheld_reason === "not_permitted" ? (
        <div className="qfield"><div className="practice-note" style={{ marginTop: 0 }}>The board&rsquo;s mark scheme for this paper cannot be shown here. The explanation above is written from your teacher&rsquo;s marks.</div></div>
      ) : null}
      {!reveal.explanation && !reveal.model_answer && !reveal.scheme && (
        <div className="qfield"><div className="v empty">No explanation was written for this part yet. Compare with your teacher&rsquo;s remark and your notes.</div></div>
      )}
    </>
  );
}

const RESULT_SUMMARY: Record<ReattemptResult, string> = { got_it: "got it", partly: "partly", not_yet: "to come back to" };

function SessionDone({ sessionId, studentId, done, total, finish, onHome }: {
  sessionId: string; studentId: string | null;
  done: Record<string, { result: ReattemptResult; interval_days: number; status: string }>;
  total: number;
  finish: Awaited<ReturnType<typeof finishPracticeSession>> | null;
  onHome: () => void;
}) {
  const rows = Object.values(done);
  const fixed = rows.filter((r) => r.status === "fixed").length;
  // Only results that happened are named: no "0 got right".
  const byResult = (["got_it", "partly", "not_yet"] as ReattemptResult[])
    .map((k) => [k, rows.filter((r) => r.result === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${RESULT_SUMMARY[k]}`);
  const soonest = rows.length ? Math.min(...rows.map((r) => r.interval_days)) : null;
  return (
    <div className="practice">
      <div className="qcard practice-card">
        <div className="qhead"><h1 className="t1">Session done</h1></div>
        <div className="qfield">
          <div className="v">
            {rows.length} of {total} {total === 1 ? "part" : "parts"} re-attempted{byResult.length ? ` · ${byResult.join(", ")}` : ""}
            {fixed > 0 ? ` · ${fixed} now fixed` : ""}
          </div>
          {soonest != null && <div className="practice-note">The next of these comes back in {soonest} {soonest === 1 ? "day" : "days"}.</div>}
        </div>
        {finish?.ask_if_then && studentId && <IfThenPrompt studentId={studentId} sessionId={sessionId} />}
        <div className="practice-actions">
          <PressBox as="button" type="button" className="btn primary" onClick={onHome}>Back to Home</PressBox>
        </div>
      </div>
    </div>
  );
}

/* AXO-258. One prompt, skippable, behind its flag and only for the prompt arm
   of the experiment. The reminder is a calendar file the student adds to their
   own calendar: nothing is sent to a third party and no push is needed. */
function IfThenPrompt({ studentId, sessionId }: { studentId: string; sessionId: string }) {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const [when, setWhen] = useState(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T17:00`);
  const [where, setWhere] = useState("");
  const [state, setState] = useState<"ask" | "saving" | "saved" | "skipped" | "failed">("ask");
  const [ics, setIcs] = useState<string | null>(null);

  if (state === "skipped") return null;
  if (state === "saved") {
    return (
      <div className="qfield">
        <div className="v">Planned for {new Date(when).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}{where ? ` · ${where}` : ""}.</div>
        {ics && <a className="textaction" href={ics} download="axon-practice.ics">Add it to your calendar <Chevron /></a>}
      </div>
    );
  }
  return (
    <div className="qfield">
      <div className="k">When will you do the next one?</div>
      <div className="practice-ifthen">
        <label className="practice-label" htmlFor="ifthen-when">Day and time</label>
        <input id="ifthen-when" className="practice-input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <label className="practice-label" htmlFor="ifthen-where">Where (optional)</label>
        <input id="ifthen-where" className="practice-input" type="text" maxLength={80} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Desk at home" />
      </div>
      <div className="practice-actions">
        <PressBox as="button" type="button" className="btn ghost" disabled={state === "saving"} onClick={async () => {
          setState("saving");
          try {
            const at = new Date(when);
            await recordIntention(studentId, sessionId, at, where.trim() || null);
            setIcs(icsFor(at, where.trim()));
            setState("saved");
          } catch { setState("failed"); }
        }}>Plan it</PressBox>
        <PressBox as="button" type="button" className="btn plain" onClick={() => setState("skipped")}>Skip</PressBox>
      </div>
      {state === "failed" && <p className="subnote" role="alert">That did not save. Pick a time in the next two weeks and try again.</p>}
    </div>
  );
}

function icsFor(at: Date, where: string): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(at.getTime() + 15 * 60_000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Axon//Practice//EN", "BEGIN:VEVENT",
    `UID:${stamp(at)}-practice@axon`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(at)}`, `DTEND:${stamp(end)}`,
    "SUMMARY:Axon practice (15 min)", where ? `LOCATION:${where.replace(/[,;\\]/g, " ")}` : "",
    "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:Axon practice", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
}
