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

   So this screen renders from `papers`, `useAnalytics` and the Insights engine
   and from nothing else. Where there is no data there is no card. The one
   insight Home may show is `nextFocus`: a mistake that has cost marks in two
   or more papers of one subject, inside at least four papers of evidence, with
   the student's own fix quoted from the question it came from. Home never
   writes that sentence itself; when the engine has nothing supported, there is
   no card.
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
import { useInsights } from "../data/useInsights";
import { ALL_FILTERS, nextFocus } from "../data/insights";
import { CAUSE_HUE, CAUSE_LABEL } from "../data/causes";
import { paths } from "../app/paths";
import { ExamCard } from "../components/ExamPlan";
import "../styles/insights.css";
import "../styles/home.css";

function HomeLoading() {
  return <PageSkeleton variant="home" label="Loading papers…" />;
}

export default function Home() {
  const { student, guardian, papers, papersStale, papersError, papersResource, progressResource, progress } = useApp();
  const { state, stale, needsCheck, unreadable, readiness } = useAnalytics();
  const { addPaper } = useIngestion();
  const insights = useInsights(ALL_FILTERS);
  const focus = insights.model ? nextFocus(insights.model) : null;

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
        <ExamCard quiet />
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

      {(stale || state === "failed") && <div role="status" className="subnote">Last available analysis. Live analysis is unavailable.</div>}
      <div className="subjectchips" aria-label="Your subjects">
        {subjects.map((subject) => {
          const selection = student?.subject_selections?.find(item => item.subject === subject);
          const filter = selection?.offering_id ? `subject:${selection.offering_id}` : `name:${subject}`;
          return <PressBox as={Link} to={`${paths.library}?subject=${encodeURIComponent(filter)}`}
            className="subjectchip" key={subject} aria-label={`Open ${subject} papers`}>{subject}</PressBox>;
        })}
      </div>

      <div className="card home-library">
        <div className="line">{papers.length} paper{papers.length === 1 ? "" : "s"}</div>
        <div className="actions">
          <PressBox as={Link} to={paths.library} className="textaction">Open Library <Chevron /></PressBox>
          <PressBox as="button" type="button" className="textaction" onClick={addPaper}>Add a paper <Chevron /></PressBox>
        </div>
      </div>

      <div className="card nextstep">
        <div className="eyebrow">Next step</div>
        <div className="line">{attention.copy}</div>
        {attention.destination && (
          <PressBox as={Link} to={attention.destination} className="textaction">{attention.actionLabel} <Chevron /></PressBox>
        )}
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

      {focus && (
        <div className="card focuscard">
          <div className="eyebrow">Before your next paper</div>
          <div className="line">{focus.fix.text}</div>
          <div className="why">
            <span className="sw2" style={{ background: CAUSE_HUE[focus.pattern.cause] }} aria-hidden="true" />
            {CAUSE_LABEL[focus.pattern.cause]}{focus.pattern.subject ? ` · ${focus.pattern.subject}` : ""} · in {focus.pattern.recentHits} of your last {focus.pattern.recentWindow} papers · {focus.pattern.papers} papers in all
          </div>
          <div className="actions">
            <PressBox as={Link} to={paths.question(focus.fix.ref.paperId, focus.fix.ref.attemptId)} className="textaction">Open {focus.fix.ref.label} <Chevron /></PressBox>
            <PressBox as={Link} to={paths.insights} className="textaction">All patterns <Chevron /></PressBox>
          </div>
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
                  {new Date(p.date_taken).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short",
                  })}
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


      <ExamCard />
    </>
  );
}
