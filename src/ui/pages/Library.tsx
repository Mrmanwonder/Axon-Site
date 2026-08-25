/* ═══════════════════════════════════════════════════════════════════════════
   LIBRARY — the archive

   A direct port of `__axonRenderLibrary`, which was one of the two render
   bridges that actually got built. The behaviour is preserved down to the
   details that carry meaning:

   · The count line states its own sample size, and says so when the copy on
     screen came from the offline cache rather than the network.
   · A paper with no attempts yet is marked "Not read yet" rather than shown
     with a silent zero. A zero would read as "nothing lost", which is a
     different and much more confident claim than "we haven't read this".
   · Tier is stated in the student's terms — "Scheme-matched" or "Teacher's
     marks" — not as tier_1 / tier_2.

   Rows stay single-column at every width. They are already dense, and a second
   column would only shorten each row's usable text.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { paperTypeLabel } from "../data/modules";
import { paths } from "../app/paths";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";

/** The stacked lines that stand in for a page thumbnail until a real crop
    exists. Decorative. */
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
  const { papers, papersStale } = useApp();

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
        {!papers.length && (
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
          return (
            <PressBox
              as={Link}
              key={p.id}
              to={paths.paper(p.id)}
              className="row"
              data-interactive=""
            >
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
                  {/* Not a zero. "We haven't read this" and "nothing was lost"
                      are different claims and must not look the same. */}
                  {!questions && <span className="tier uns">Not read yet</span>}
                </div>
              </div>
              <Chevron />
            </PressBox>
          );
        })}
      </div>
    </>
  );
}
