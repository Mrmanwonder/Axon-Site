/* ═══════════════════════════════════════════════════════════════════════════
   LIBRARY — the archive

   A direct port of `__axonRenderLibrary`, extended per AXON_FIX_BRIEF.md §6.5:
   every paper shows a live status from upload onward, not just "Not read yet"
   or a real row — Scanning → Reading → Needs your eyes → Ready to save →
   (committed rows render as before). A failed or rejected paper stays
   visible, says so, and offers a way back to it, rather than vanishing.

   Three things carried over from the original port, still true and still load
   bearing:

   · The count line states its own sample size, and says so when the copy on
     screen came from the offline cache rather than the network.
   · A committed paper with no attempts is a different, older bug (should not
     happen once `progress` covers the in-flight states below); a paper mid-
     pipeline is no longer shown that way at all — it shows what it's actually
     doing.
   · Tier is stated in the student's terms — "Scheme-matched" or "Teacher's
     marks" — not as tier_1 / tier_2.

   Rows stay single-column at every width. They are already dense, and a second
   column would only shorten each row's usable text.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { paperTypeLabel, PAPER_STATUS, statusKeyForRun } from "../data/modules";
import { paths } from "../app/paths";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";

/** The stacked lines that stand in for a page thumbnail until a real crop
    exists. Decorative. thumb_key (AXON_FIX_BRIEF.md §7.2) is still null on
    every page live — nothing to point this at yet. */
function Thumb() {
  return (
    <div className="thumb" aria-hidden="true">
      <div className="ln" style={{ top: 8 }} />
      <div className="ln" style={{ top: 16, right: 16 }} />
      <div className="ln" style={{ top: 24 }} />
    </div>
  );
}

type CountRow = { count: number }[] | undefined;

export default function Library() {
  const { papers, papersStale, papersError, progress } = useApp();
  const navigate = useNavigate();

  return (
    <>
      <div className="greet">
        <h1>Library</h1>
        <div className="sub">
          {papers.length} paper{papers.length === 1 ? "" : "s"}
          {papersStale ? " · offline copy" : ""}
        </div>
      </div>

      <div className="list">
        {/* Two different states that used to render identically. A library
            that is empty and a library we could not read are not the same
            thing, and telling a student the first when it is the second is
            the confident lie hard rule 4 exists to prevent. */}
        {!papers.length && papersError && (
          <div className="srow noicon">
            <div className="lbl">
              We couldn&rsquo;t load your papers
              <small>
                Your papers are safe — this is us failing to read them, not them
                being gone. Try again in a moment.
              </small>
            </div>
          </div>
        )}

        {!papers.length && !papersError && (
          <div className="srow noicon">
            <div className="lbl">
              Nothing here yet
              <small>Add a paper and it&rsquo;ll show up, readable even offline</small>
            </div>
          </div>
        )}

        {papers.map((p) => {
          const pages = (p.paper_page as CountRow)?.[0]?.count ?? 0;
          const questions = (p.student_attempt as CountRow)?.[0]?.count ?? 0;
          const run = progress.get(p.id);
          const statusKey = run ? statusKeyForRun(run.status) : null;
          const status = statusKey ? PAPER_STATUS[statusKey] : null;

          const meta = (
            <>
              <Thumb />
              <div className="b">
                <div className="t1">{paperTypeLabel(p.type)}</div>
                <div className="t2">
                  <span>
                    {new Date(p.date_taken).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short",
                    })}
                  </span>
                  <span>·</span>
                  <span>{pages} page{pages === 1 ? "" : "s"}</span>
                </div>
                <div className="t2" style={{ marginTop: 6 }}>
                  <span className={"tier " + (p.tier === "tier_2" ? "t2" : "t1")}>
                    {p.tier === "tier_2" ? "Scheme-matched" : "Teacher's marks"}
                  </span>
                  {status
                    ? (
                      // "wait" (still being read) is neutral; "attention" and
                      // "stopped" both use the existing amber .uns treatment —
                      // red is reserved for signing out, nothing else.
                      <span className={"tier " + (status.tone === "wait" ? "t1" : "uns")}>
                        {status.label}
                      </span>
                    )
                    // Not a zero. "We haven't read this" and "nothing was
                    // lost" are different claims and must not look the same.
                    : (!questions && <span className="tier uns">Not read yet</span>)}
                </div>
              </div>
            </>
          );

          // A paper mid-pipeline, or one that never produced a committed
          // attempt, has nothing for PaperOverview to open. Route it back to
          // Scan instead, where the resumable-draft flow already lives, so
          // "needs your eyes" / "ready" / "failed" all have a real place to
          // land rather than a dead link or a misleading empty screen.
          if (status) {
            return (
              <PressBox
                key={p.id}
                as="button"
                type="button"
                className="row"
                data-interactive=""
                onClick={() => navigate(paths.scan)}
              >
                {meta}
                <Chevron />
              </PressBox>
            );
          }

          return (
            <PressBox
              as={Link}
              key={p.id}
              to={paths.paper(p.id)}
              className="row"
              data-interactive=""
            >
              {meta}
              <Chevron />
            </PressBox>
          );
        })}
      </div>
    </>
  );
}
