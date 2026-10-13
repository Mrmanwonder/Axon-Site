/* ═══════════════════════════════════════════════════════════════════════════
   HOME — the practice cards (AXO-251, 252, 253, 254)

   Order is the brief's: the one next best action, today's re-attempts, the
   three biggest leaks, the progress strip. Only the next best action carries
   a primary button; everything else is a quiet text action, so the screen
   keeps one obvious thing to do.

   Every number here is sourced: marks lost are the teacher's, "to win back"
   is the sum of those marks on parts not yet fixed, minutes are the server's
   budget estimate, and the streak counts completed re-attempt sessions only.
   Gain framing, no red, no percentages, no comparison with anyone else.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { Link } from "react-router-dom";
import PressBox from "./PressBox";
import Chevron from "./Chevron";
import { paths } from "../app/paths";
import { numMark } from "../data/causes";
import { focusLabel, marks, type DueItem, type FocusArea, type NextBestAction, type ProgressSummary } from "../data/practice";
import { useStartPractice } from "../data/useHomePractice";
import type { Streak } from "../data/streak";
import { hapticFirm } from "../lib/haptics";

function useStarter() {
  const start = useStartPractice();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (tag: string, fn: () => Promise<void>) => {
    setBusy(tag);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "That did not start. Try again."); setBusy(null); }
  };
  return { start, busy, error, run };
}

export function NextBestActionCard({ nba, showTypes, onScan, hasPapers = false }: { nba: NextBestAction; showTypes: boolean; onScan: () => void; hasPapers?: boolean }) {
  const { start, busy, error, run } = useStarter();

  // Papers exist but none is confirmed yet: they are being read or waiting for
  // review. Asking for another scan would ignore the ones already sent.
  if (nba.state === "no_scans" && hasPapers) {
    return (
      <div className="card nextstep focuscard nbacard">
        <div className="eyebrow">Next step</div>
        <div className="line">Practice starts once a paper is read and confirmed.</div>
        <div className="why">Your recent scans below show where each one is.</div>
      </div>
    );
  }
  if (nba.state === "no_scans") {
    return (
      <div className="card nextstep focuscard nbacard">
        <div className="eyebrow">Next step</div>
        <div className="line">Scan a marked paper to see where your marks went.</div>
        <div className="why">Practice starts from the marks you lost, so there is nothing to practise until a paper is read.</div>
        <PressBox as="button" type="button" className="btn primary nbacta" onClick={onScan}>Scan a paper</PressBox>
      </div>
    );
  }
  if (nba.state === "no_lost_marks") {
    return (
      <div className="card nextstep focuscard nbacard">
        <div className="eyebrow">Next step</div>
        <div className="line">No lost marks to practise in your saved papers.</div>
        <div className="why">Scan your next marked paper when you get it back.</div>
        <PressBox as="button" type="button" className="btn primary nbacta" onClick={onScan}>Scan a paper</PressBox>
      </div>
    );
  }
  if (nba.state === "caught_up" || nba.state === "nothing_due") {
    const when = nba.next_review_at ? new Date(nba.next_review_at) : null;
    return (
      <div className="card nextstep focuscard nbacard">
        <div className="eyebrow">Next step</div>
        <div className="line">{nba.state === "caught_up" ? "Every part you lost marks on is fixed." : "Nothing is due today."}</div>
        <div className="why">
          {when ? <>Your next re-attempt comes up {when.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}.</> : null}
          {" "}A new marked paper gives you something fresh to work on.
        </div>
        <PressBox as="button" type="button" className="btn primary nbacta" onClick={onScan}>Scan a paper</PressBox>
      </div>
    );
  }

  const n = nba.item_ids.length;
  const what = focusLabel({ kind: nba.kind, key: nba.key, label: nba.label, subject: nba.subject }, showTypes);
  const line = nba.kind === "due"
    ? <>Re-attempt {n} {n === 1 ? "question" : "questions"} that {n === 1 ? "is" : "are"} due</>
    : <>Re-attempt {n} {n === 1 ? "question" : "questions"} on {what}</>;

  return (
    <div className="card nextstep focuscard nbacard">
      <div className="eyebrow">Next step</div>
      <div className="line">{line}</div>
      <div className="nbameta">
        <span className="gain">{numMark(nba.marks_recoverable)} {nba.marks_recoverable === 1 ? "mark" : "marks"} to win back</span>
        <span aria-hidden="true">·</span>
        <span>{nba.minutes} min</span>
        {nba.subject && nba.kind !== "subject" ? <><span aria-hidden="true">·</span><span>{nba.subject}</span></> : null}
      </div>
      <div className="why">{sentence(nba.reason)}</div>
      <PressBox
        as="button"
        type="button"
        className="btn primary nbacta"
        disabled={busy !== null}
        aria-busy={busy === "nba"}
        onClick={() => {
          hapticFirm();
          void run("nba", () => start(nba.kind, { key: nba.key, subject: nba.subject, itemIds: nba.item_ids }));
        }}
      >
        Start · {nba.minutes} min
      </PressBox>
      {error && <div role="alert" className="subnote">{error}</div>}
    </div>
  );
}

export function DueQueueList({ due }: { due: DueItem[] }) {
  const { start, busy, error, run } = useStarter();
  if (!due.length) return null;
  const minutes = due.reduce((s, d) => s + d.minutes, 0);
  return (
    <>
      <div className="sectitle">Today&rsquo;s re-attempts <span className="sectail">{due.length} · {minutes} min</span></div>
      <div className="list duelist">
        {due.map((d) => (
          <PressBox
            key={d.id}
            as="button"
            type="button"
            className="row"
            data-interactive=""
            disabled={busy !== null}
            onClick={() => void run(d.id, () => start("item", { key: d.id }))}
            aria-label={`Re-attempt ${d.question_label}${d.subject ? `, ${d.subject}` : ""}`}
          >
            <div className="b">
              <div className="t1">{d.subject ? `${d.subject} · ` : ""}{d.question_label}</div>
              <div className="t2">
                {d.status === "fixed" ? "Check it is still fixed" : d.overdue_days > 0 ? `Due ${d.overdue_days} ${d.overdue_days === 1 ? "day" : "days"} ago` : "Due today"}
                {" · "}{d.minutes} min
              </div>
            </div>
            <div className="lost gainnum">{numMark(d.marks_lost)}<small>to win back</small></div>
            <Chevron />
          </PressBox>
        ))}
      </div>
      {error && <div role="alert" className="subnote">{error}</div>}
    </>
  );
}

export function LeaksCard({ leaks, showTypes }: { leaks: FocusArea[]; showTypes: boolean }) {
  const { start, busy, error, run } = useStarter();
  if (!leaks.length) return null;
  return (
    <>
      <div className="sectitle">Where the most marks are</div>
      <div className="card tallycard leakcard">
        {leaks.map((a) => (
          <div className="tallyrow" key={`${a.kind}:${a.key}:${a.subject ?? ""}`}>
            <div className="top">
              <span className="n">{focusLabel(a, showTypes)}</span>
              <span className="v gainnum">{numMark(a.marks_recoverable)}<small>to win back</small></span>
            </div>
            <div className="meta">
              {a.subject && a.kind !== "subject" ? `${a.subject} · ` : ""}
              Seen in {a.papers_seen} {a.papers_seen === 1 ? "paper" : "papers"} · {a.items_open} {a.items_open === 1 ? "part" : "parts"} to re-attempt
              {a.exam_days != null ? ` · exam in ${a.exam_days} ${a.exam_days === 1 ? "day" : "days"}` : ""}
            </div>
            <PressBox
              as="button"
              type="button"
              className="textaction"
              disabled={busy !== null}
              aria-busy={busy === a.key}
              onClick={() => void run(a.key, () => start(a.kind, { key: a.key, subject: a.subject }))}
            >
              Fix this <Chevron />
            </PressBox>
          </div>
        ))}
        {error && <div role="alert" className="subnote">{error}</div>}
      </div>
    </>
  );
}

export function ProgressStrip({ progress, streak }: { progress: ProgressSummary; streak: Streak | null }) {
  const peak = Math.max(1, ...progress.weeks.map((w) => w.marks));
  const anyPractice = progress.session_dates.length > 0;
  return (
    <>
      <div className="sectitle">Your progress</div>
      <div className="card progresscard">
        {!anyPractice ? (
          <p className="lede">Your first finished re-attempt starts this. It only counts practice you complete, never opening the app.</p>
        ) : (
          <>
            <div className="progressrow">
              <div className="pstat">
                <strong>{streak?.current ?? 0}</strong>
                <span>{streak?.current === 1 ? "day" : "days"} practised in a row</span>
              </div>
              <div className="pstat">
                <strong>{numMark(progress.marks_recovered_total)}</strong>
                <span>{progress.marks_recovered_total === 1 ? "mark" : "marks"} fixed in practice</span>
              </div>
            </div>
            <div className="weekbars" role="img"
                 aria-label={`Marks fixed in practice over the last eight weeks: ${progress.weeks.map((w) => numMark(w.marks)).join(", ")}`}>
              {progress.weeks.map((w) => (
                <i key={w.week} style={{ transform: `scaleY(${Math.max(0.06, w.marks / peak)})` }} className={w.marks > 0 ? "on" : undefined} />
              ))}
            </div>
            <div className="meta">
              {streak && streak.freezes > 0 ? `${streak.freezes} ${streak.freezes === 1 ? "freeze" : "freezes"} held · ` : ""}
              {streak?.todayDone ? "Done today" : "Not yet today"}
              {" · "}{progress.reattempts_this_week} {progress.reattempts_this_week === 1 ? "re-attempt" : "re-attempts"} this week
              {progress.topics_passed_30d > 0 ? ` · ${progress.topics_passed_30d} ${progress.topics_passed_30d === 1 ? "topic" : "topics"} passed this month` : ""}
            </div>
            <div className="subnote">
              Weekends never break it. Every 7 days earns a freeze that covers one missed weekday; you can hold two. Practice marks are your own check, not a teacher&rsquo;s mark.
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function ScanPrompt({ onScan }: { onScan: () => void }) {
  return (
    <div className="scanprompt">
      <span>Got a marked paper back?</span>
      <PressBox as="button" type="button" className="textaction" onClick={onScan}>Scan it <Chevron /></PressBox>
    </div>
  );
}

export function JournalLink() {
  return <PressBox as={Link} to={paths.journal} className="textaction">Every lost mark <Chevron /></PressBox>;
}

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + "." : "");
export { marks };
