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

   So this screen renders from `papers` and `useAnalytics` and from nothing else.
   Where there is no data there is no card. In particular there is deliberately
   no headline insight card here: no table holds a generated insight yet, and a
   card that had to invent its own sentence would be the same bug wearing a
   React hat.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { useAnalytics } from "../data/useAnalytics";
import { paperPresentation } from "../data/paperPresentation";
import { paths } from "../app/paths";
import { paperTypeLabel, statusKeyForRun } from "../data/modules";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";
import { useIngestion } from "../data/useIngestion";
import { NoPapersArt } from "../components/EmptyArt";
import PageSkeleton from "../components/PageSkeleton";

function HomeLoading() {
  return <PageSkeleton variant="home" label="Loading papers…" />;
}

export default function Home() {
  const { student, guardian, papers, papersStale, papersError, papersResource, progressResource, progress } = useApp();
  const { state, stale, needsCheck, unreadable, readiness } = useAnalytics();


  const { addPaper } = useIngestion();
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
      </>
    );
  }

  const recent = papers.slice(0, 3);
  const analyticsReady = state === "ready" && progressResource.state === "ready";
  const unreadableCount = analyticsReady ? (unreadable?.length ?? 0) : null;
  const waiting = [...progress.values()].filter((p) => {
    const key = statusKeyForRun(p.status);
    return key === "needs_review" || key === "ready";
  }).length;
  const attentionCount = analyticsReady
    ? (needsCheck?.count ?? 0) + (unreadableCount ?? 0) + waiting
    : null;
  const nextCopy = attentionCount == null
    ? "Checking your latest evidence…"
    : attentionCount
      ? `${attentionCount} ${attentionCount === 1 ? "thing needs" : "things need"} your eyes before the analysis can move on.`
      : readiness?.has_enough_data
        ? "Nothing needs you right now. Your latest evidence is ready in Insights."
        : "Nothing needs you right now. Scan your next marked paper when you get it back.";


  return (
    <>
      <div className="greet">
        <div className="d">{day}</div>
        <h1>{name}</h1>
      </div>

      {(stale || state === "failed") && <div role="status">Last available analysis. Live analysis is unavailable.</div>}
      <div className="subjectchips" aria-label="Your subjects">
        {subjects.map((subject) => <span className="subjectchip" key={subject}>{subject}</span>)}
      </div>

      <div className="card nextstep">
        <div className="eyebrow">Next step</div>
        <div className="line">{nextCopy}</div>
        {attentionCount != null && attentionCount > 0 && (
          <PressBox as={Link} to={paths.library} className="textaction">Review now <Chevron /></PressBox>
        )}
      </div>


      {/* Shown only when there is something to check. The count and the paper
          count are both real; the surface states its own sample size. */}
      {attentionCount != null && attentionCount > 0 && (
        <PressBox
          as="button"
          type="button"
          className="card attention"
          data-interactive=""
          onClick={() => navigate(paths.library)}
        >
          <div className="ic">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8v5M12 16.5v.4" />
              <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div className="b">
            <div className="t1">
              Needs your eyes
            </div>
            <div className="t2">
              {needsCheck?.count ?? 0} to confirm · {unreadableCount ?? 0} unreadable · {waiting} ready to review
            </div>
          </div>
          <Chevron />
        </PressBox>
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
              <div className="t1">{p.subject ? `${p.subject} · ` : ""}{paperTypeLabel(p.type)}</div>
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
              <div className="lost">{Number(p.total_available) - Number(p.total_awarded)}<small>marks lost</small></div>
            )}
            <Chevron />
          </PressBox>
        ); })}
      </div>

      {papersStale && (
        <div className="subnote">Offline copy. New uploads need a connection.</div>
      )}

      <PressBox as="button" type="button" className="scanbtn" onClick={addPaper}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V5M12 5 8 9M12 5l4 4" />
          <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
        </svg>
        Just got a test back? Scan it now
      </PressBox>

      <div className="card examcard">
        <div><div className="eyebrow">What&rsquo;s coming up</div><div className="t1">No exam date set</div><div className="t2">Axon won&rsquo;t guess your school calendar. Exam planning will appear here when dates can be saved.</div></div>
      </div>
    </>
  );
}
