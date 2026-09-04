/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHTS — the deep dive

   Which view this shows is a DATA question, not a tap affordance. In the
   prototype it toggled on a second tap on the Insights tab, which meant a
   student with two papers could reach the populated chart — the exact failure
   `student_analytics_readiness` exists to prevent. AGENTS.md records that as a
   bug; here readiness decides and nothing else can.

   The populated view renders `lossByCause`, which reads `mark_loss_analytics`
   and never the base table, so unsure and student-rejected rows are already
   excluded — hard rule 3, enforced upstream of this file.

   Cause colours are categorical and of equal weight. The bar is ordered by
   size because that is what a reader needs, but the hues carry no ranking: a
   green-to-red ramp would turn this into a shame map. Every headline states its
   own sample size.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useAnalytics } from "../data/useAnalytics";
import { useIngestion } from "../data/useIngestion";
import PressBox from "../components/PressBox";
import { NotEnoughDataArt } from "../components/EmptyArt";

/** The fixed enum, with the hues from CLAUDE.md and the student-facing wording
    from the prototype. Not extensible without a decision — a new cause is an
    "ask, don't guess" item. */
const CAUSE = {
  conceptual_gap: { hue: "var(--cause-conceptual-gap)", label: "Concept gap" },
  procedural_slip: { hue: "var(--cause-procedural-slip)", label: "Slip in the working" },
  misread_question: { hue: "var(--cause-misread-question)", label: "Misread the question" },
  incomplete: { hue: "var(--cause-incomplete)", label: "Left incomplete" },
  presentation: { hue: "var(--cause-presentation)", label: "How it was presented" },
  keyword_miss: { hue: "var(--cause-keyword-miss)", label: "Missing keyword" },
  timed_out: { hue: "var(--cause-timed-out)", label: "Ran out of time" },
} as const;

type Cause = keyof typeof CAUSE;

const THRESHOLD = 4;

export default function Insights() {
  const { state, readiness, loss } = useAnalytics();
  const { addPaper } = useIngestion();

  // Loading is not "not enough data". Showing the insufficient-data state while
  // the read is in flight tells a student their papers don't count.
  if (state === "loading" || !readiness) return null;

  if (state === "failed") {
    return (
      <>
        <div className="greet"><h1>Insights</h1></div>
        <div className="estate">
          <h4>Can&rsquo;t reach your analysis</h4>
          <p>
            Your papers are still saved and still readable. This view needs a
            connection to work out what changed.
          </p>
        </div>
      </>
    );
  }

  if (!readiness.has_enough_data) {
    const have = readiness.papers_counted;
    return (
      <>
        <div className="greet"><h1>Insights</h1></div>
        <div className="estate">
          <NotEnoughDataArt />
          <h4>Not enough papers yet</h4>
          <p>
            Patterns need about four papers before they mean anything. With
            {have === 1 ? " one, " : ` ${have}, `}
            anything shown here would be noise dressed as insight.
          </p>
          <div className="prog">
            <div className="tr">
              <i style={{ width: `${Math.min(100, (have / THRESHOLD) * 100)}%` }} />
            </div>
            <span>{have} of {THRESHOLD}</span>
          </div>
          <PressBox as="button" type="button" className="btn primary" onClick={addPaper}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add a paper
          </PressBox>
        </div>
      </>
    );
  }

  const entries = Object.entries(loss ?? {})
    .filter(([c, marks]) => c in CAUSE && marks > 0)
    .sort((a, b) => b[1] - a[1]) as [Cause, number][];
  const total = entries.reduce((n, [, marks]) => n + marks, 0);

  return (
    <>
      <div className="greet">
        <h1>Insights</h1>
        <div className="sub">
          {readiness.questions_counted} question
          {readiness.questions_counted === 1 ? "" : "s"} · {readiness.papers_counted} paper
          {readiness.papers_counted === 1 ? "" : "s"}
        </div>
      </div>

      <div className="sectitle">Marks lost by cause</div>

      {!total ? (
        <div className="card causecard">
          <div className="subnote" style={{ margin: 0 }}>
            No marks lost across the papers we&rsquo;ve read. Nothing to break down yet.
          </div>
        </div>
      ) : (
        <>
          <div className="card causecard">
            <div className="causebar">
              {entries.map(([cause, marks]) => (
                <i
                  key={cause}
                  style={{ flex: marks, background: CAUSE[cause].hue }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <div className="causegrid">
              {entries.map(([cause, marks]) => (
                <div className="cz" key={cause}>
                  <span className="sw2" style={{ background: CAUSE[cause].hue }} aria-hidden="true" />
                  <span className="n">{CAUSE[cause].label}</span>
                  <span className="v">{marks}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="subnote">
            Different kinds of problem, coloured categorically — no cause ranks
            worse than another.
          </div>
        </>
      )}
    </>
  );
}
