import { useEffect, useState } from "react";
import { paperDateLabel } from "../../paperDate.js";
/* ═══════════════════════════════════════════════════════════════════════════
   HOME — the snapshot

   ── Why this screen is not a straight port ──

   The pre-port `index.html` carries a fully populated Home: "14 papers",
   "You're losing most marks to unstated assumptions", "7 marks lost". Those are
   the prototype's invented numbers. `__axonHomeEmpty` exists to swap them for
   the empty state — and nothing in `src/` has ever called it. `AGENTS.md`
   documents `__axonRenderHome` as one of the render bridges; it was never
   implemented either.

   The effect on the shipping app is that a student who has just signed up and
   owns no papers is shown fourteen papers and seven marks lost, presented as
   their own. AGENTS.md names this exactly: "those read as this student's marks,
   which is the most confident lie the interface can tell." It also runs
   straight into hard rule 4 — never fill a gap with a plausible guess.

   So this screen renders from `papers`, `useAnalytics` and the practice reads
   (AXO-244: next best action, due queue, leaks, progress) and from nothing
   else. Where there is no data there is no card. Every practice number comes
   from error items the server derives from confirmed evidence only, and each
   card states its own empty, loading and failed states.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { useAnalytics } from "../data/useAnalytics";
import { paperPresentation } from "../data/paperPresentation";
import { paperTypeLabel, providerKeyForStudent } from "../data/modules";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";
import { NoPapersArt } from "../components/EmptyArt";
import PageSkeleton from "../components/PageSkeleton";
import { useIngestion } from "../data/useIngestion";
import { isPartialTotal } from "../data/paperTotals";
import { homeAttention } from "../data/homeAttention";
import { paths } from "../app/paths";
import { ExamCard } from "../components/ExamPlan";
import { useHomePractice, useRefreshOnReturn } from "../data/useHomePractice";
import { JournalLink, DueQueueList, LeaksCard, NextBestActionCard, ProgressStrip, ScanPrompt } from "../components/HomePractice";
import TargetGrades from "../components/TargetGrades";
import "../styles/insights.css";
import "../styles/home.css";

function HomeLoading() {
  return <PageSkeleton variant="home" label="Loading papers…" />;
}

export default function Home() {
  const { student, guardian, papers, papersStale, papersError, papersResource, progressResource, progress } = useApp();
  const { state, stale, needsCheck, unreadable, readiness } = useAnalytics();
  const { addPaper } = useIngestion();
  const practice = useHomePractice();
  useRefreshOnReturn(practice.reload);

  const navigate = useNavigate();

  const name = student?.first_name ?? guardian?.name ?? "there";
  const day = new Date().toLocaleDateString(undefined, { weekday: "long" });
  const subjects = student?.subjects ?? [];

  // The old implementation returned null here and made a fast HTML/React boot
  // look slow. Loading is neither empty nor an error, so render the identity and
  // geometry we already know while the library paints from cache/network.
  if (papersResource.state === "loading" && papersResource.data === null) return <HomeLoading />;


  // A library we could not read is not an empty one. Offering "Add your first
  // paper" to someone who already has papers, because the read failed, is the
  // same confident lie as inventing a paper count — it just fails in the other
  // direction.
  if (!papers.length && papersError) {
    return (
      <>
        <div className="greet"><h1>{name}</h1></div>
        <div className="estate">
          <h4>We couldn&rsquo;t load your papers</h4>
          <p>
            Your papers are safe. This is us failing to read them, not them being
            gone. Try again in a moment.
          </p>
        </div>
      </>
    );
  }

  if (!papers.length) {
    return (
      <>
        <div className="greet"><h1>{name}</h1></div>
        {/* the exam countdown is the most motivating element; it leads (review #12) */}
        <ExamCard quiet />
        <div className="estate">
          <NoPapersArt />
          <h4>No papers yet</h4>
          <p>
            Add a marked paper and we&rsquo;ll show you where the marks went. Until
            there&rsquo;s one to read, there&rsquo;s nothing here we could honestly tell you.
          </p>
          <PressBox as="button" type="button" className="btn primary" onClick={addPaper}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add your first paper
          </PressBox>
        </div>
      </>
    );
  }

  const recent = papers.slice(0, 3);
  const attention = homeAttention({
    papers, progress,
    live: state === "ready" && !stale && progressResource.state === "ready" && progressResource.source === "live",
    needsCheckCount: needsCheck?.count ?? 0,
    unreadable: unreadable ?? [],
    enoughData: readiness?.has_enough_data ?? false,
  });


  return (
    <>
      <div className="greet">
        <div className="d">{day}</div>
        <h1>{name}</h1>
      </div>

      {/* Home is built around the exam countdown (review #12). */}
      <ExamCard />
      <ScanCelebration paper={papers[0] && paperPresentation(papers[0], progressResource).canOpen ? papers[0] : null} />

      {(stale || state === "failed") && <div role="status" className="subnote">Last available analysis. Live analysis is unavailable.</div>}
      <div className="subjectchips" aria-label="Your subjects">
        {subjects.map((subject) => {
          const selection = student?.subject_selections?.find(item => item.subject === subject);
          const filter = selection?.offering_id ? `subject:${selection.offering_id}` : `name:${subject}`;
          return <PressBox as={Link} to={`${paths.library}?subject=${encodeURIComponent(filter)}`}
            className="subjectchip" key={subject} aria-label={`Open ${subject} papers`}>{subject}</PressBox>;
        })}
      </div>




      {/* Shown only when there is something to check. The count and the paper
          count are both real; the surface states its own sample size. */}
      {attention.title && attention.destination && (
        <PressBox
          as="button"
          type="button"
          className="card attention"
          data-interactive=""
          onClick={() => attention.destination && navigate(attention.destination)}
        >
          <div className="ic">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8v5M12 16.5v.4" />
              <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div className="b">
            <div className="t1">
              {attention.title}
            </div>
            <div className="t2">
              {attention.detail}
            </div>
          </div>
          <Chevron />
        </PressBox>
      )}

      {/* AXO-255: the practice home in the brief's order — next best action,
          today's queue, the three biggest leaks, the progress strip — with the
          scan prompt last. Each card owns its loading and failure; a failed
          practice read never turns Home into an empty state. The old
          insight-quoted "Next step" lives on in Insights' "Before your next
          paper"; Home now has one next step, and it starts practice. */}
      <TargetGrades mode="prompt" />
      {practice.resource.data ? (
        <>
          <NextBestActionCard nba={practice.resource.data.nba} showTypes={practice.resource.data.flags.mistake_type_ui} onScan={addPaper} hasPapers={papers.length > 0} />
          {/* When the next best action is already the due queue, the list would repeat it. */}
          {!(practice.resource.data.nba.state === "ready" && practice.resource.data.nba.kind === "due") && (
            <DueQueueList due={practice.resource.data.due} />
          )}
          <LeaksCard leaks={practice.resource.data.leaks} showTypes={practice.resource.data.flags.mistake_type_ui} />
          {practice.resource.data.nba.state !== "no_scans" && practice.resource.data.nba.state !== "no_lost_marks" && (
            <div className="journallink"><JournalLink /></div>
          )}
          <ProgressStrip progress={practice.resource.data.progress} streak={practice.streak} />
        </>
      ) : practice.resource.state === "failed" ? (
        <div className="card nextstep focuscard" role="status">
          <div className="eyebrow">Next step</div>
          <div className="why">Your practice plan could not be loaded. Your papers are safe; this is us failing to read them.</div>
          <PressBox as="button" type="button" className="textaction" onClick={() => void practice.reload()}>Try again <Chevron /></PressBox>
        </div>
      ) : (
        <div className="card nextstep focuscard" role="status" aria-busy="true">
          <div className="eyebrow">Next step</div>
          <div className="why">Working out what to practise…</div>
        </div>
      )}

      <div className="sectitle">Recent scans</div>
      <div className="list">
        {recent.map((p) => { const presentation = paperPresentation(p, progressResource); return (
          <PressBox
            as={Link}
            key={p.id}
            to={presentation.destination}
            aria-disabled={!presentation.canOpen}
            onClick={event => { if (!presentation.canOpen) event.preventDefault(); }}
            className="row"
            data-interactive=""
          >
            <div className="b">
              <div className="t1">{p.subject ? `${p.subject} · ` : ""}{paperTypeLabel(p.type, providerKeyForStudent(student))}</div>
              <div className="t2">{presentation.statusLabel}{presentation.stale ? " · last-known status" : ""}</div>

              <div className="t2">
                <span className={"tier " + (p.tier === "tier_2" ? "t2" : "t1")}>
                  {p.tier === "tier_2" ? "Scheme-matched" : "Teacher's marks"}
                </span>
                <span>
                  {paperDateLabel(p, { short: true })}
                </span>
              </div>
            </div>
            {p.total_available != null && p.total_awarded != null && (
              <div className="lost">{Number(p.total_available) - Number(p.total_awarded)}<small>{isPartialTotal(p) ? "marks lost, at least" : "marks lost"}</small></div>
            )}
            <Chevron />
          </PressBox>
        ); })}
      </div>

      {papersStale && (
        <div className="subnote">Offline copy. New uploads need a connection.</div>
      )}

      {/* The scan prompt closes Home, unless the next step above already is one. */}
      {!(practice.resource.data && ["no_lost_marks", "caught_up", "nothing_due"].includes(practice.resource.data.nba.state)) && <ScanPrompt onScan={addPaper} />}
    </>
  );
}

/* A small, one-time acknowledgement when a newly scanned paper is ready
   (review #12). Remembered per paper in localStorage so it shows once. */
const CELEBRATED_KEY = "axon.celebrated-paper";
function ScanCelebration({ paper }: { paper: { id: string; total_available?: unknown; total_awarded?: unknown } | null }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!paper) return;
    let last: string | null = null;
    try { last = localStorage.getItem(CELEBRATED_KEY); } catch { /* storage blocked */ }
    if (last === null) {
      // First visit with papers: record silently so old papers are not celebrated.
      try { localStorage.setItem(CELEBRATED_KEY, paper.id); } catch { /* ignore */ }
      return;
    }
    if (last !== paper.id) {
      setShown(true);
      try { localStorage.setItem(CELEBRATED_KEY, paper.id); } catch { /* ignore */ }
    }
  }, [paper?.id]);
  if (!shown || !paper) return null;
  const lost = paper.total_available != null && paper.total_awarded != null
    ? Number(paper.total_available) - Number(paper.total_awarded) : null;
  return (
    <div className="card celebrate" role="status">
      <span className="celebrate-mark" aria-hidden="true">✓</span>
      <div className="b">
        <div className="t1">Paper read. Nice work.</div>
        <div className="t2">{lost != null ? `${lost} marks traced to their causes. ` : ""}Every paper makes your patterns sharper.</div>
      </div>
      <button type="button" className="textaction" onClick={() => setShown(false)}>Dismiss</button>
    </div>
  );
}
