/* ═══════════════════════════════════════════════════════════════════════════
   PAPER OVERVIEW

   The question list for one saved paper — marks, reconciliation state, and a
   link into each question's detail. Reads student_attempt (the committed,
   frontend-side record — see AXON_FIX_BRIEF.md §1's "two data models"), never
   question_region directly for the marks themselves.

   A paper still mid-pipeline (no committed attempts yet) has nothing to show
   here — that state belongs to the Library row (§6.5), which links here only
   once there is something to open. This screen assumes it is being asked for
   a paper that has been saved.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";
import { useApp } from "../data/AppProvider";
import { readPaper, paperTypeLabel } from "../data/modules";
import type { PaperDetail } from "../data/modules";
import { numMark } from "../data/causes";
import { paths } from "../app/paths";

const CONF_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  likely: "Likely",
  unsure: "Unsure",
};

export default function PaperOverview() {
  const { paperId } = useParams();
  const { student } = useApp();

  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [stale, setStale] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!student || !paperId) return;
    let cancelled = false;
    readPaper(student.id, paperId)
      .then(({ data, stale: s }) => { if (!cancelled) { setPaper(data); setStale(!!s); } })
      .catch((e) => { if (!cancelled) setLoadError(e.message || "That paper could not be opened."); });
    return () => { cancelled = true; };
  }, [student, paperId]);

  if (loadError) {
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">{loadError}</p>
        <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
          Back to Library
        </Link>
      </div>
    );
  }

  if (!paper) return null; // loading

  const attempts = paper.student_attempt;
  const marksRows = attempts.filter((a) => a.marks_awarded != null && a.max_marks != null);
  const sumAwarded = marksRows.reduce((t, a) => t + Number(a.marks_awarded), 0);
  const sumAvailable = marksRows.reduce((t, a) => t + Number(a.max_marks), 0);

  return (
    <>
      <div className="greet">
        <h1>{paperTypeLabel(paper.type)}</h1>
        <div className="sub">
          {paper.subject ? `${paper.subject} · ` : ""}
          {new Date(paper.date_taken).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          {stale ? " · offline copy" : ""}
        </div>
      </div>

      {marksRows.length > 0 && (
        <div className="card" style={{ padding: "16px 18px", marginTop: 4 }}>
          <div className="t1" style={{ fontSize: 15, color: "var(--label-2)" }}>
            {marksRows.length} of {attempts.length} question{attempts.length === 1 ? "" : "s"} marked
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", marginTop: 4 }}>
            {numMark(sumAwarded)}<span style={{ color: "var(--label-3)", fontWeight: 500 }}>/{numMark(sumAvailable)}</span>
          </div>

          {/* We never assert our reading is right against the paper's own
              total — we state both and let the student judge. */}
          {paper.reconciled === false && paper.reported_total != null && (
            <div className="subnote" style={{ marginTop: 10 }}>
              Our reading adds up to {numMark(sumAwarded)}, and the total on your paper is{" "}
              {numMark(Number(paper.reported_total))} — worth a look at the questions below.
            </div>
          )}
        </div>
      )}

      <div className="sectitle">Questions</div>
      <div className="list">
        {!attempts.length && (
          <div className="srow noicon">
            <div className="lbl">
              Nothing to show yet
              <small>This paper hasn&rsquo;t produced any readable questions.</small>
            </div>
          </div>
        )}

        {attempts.map((a) => (
          <PressBox
            as={Link}
            key={a.id}
            to={paths.question(paperId!, a.id)}
            className="row"
            data-interactive=""
          >
            <div className="b">
              <div className="t1">{a.question_label || "Question"}</div>
              <div className="t2">
                <span className={"conf " + a.extraction_confidence}>
                  {CONF_LABEL[a.extraction_confidence] ?? a.extraction_confidence}
                </span>
                {a.marks_awarded != null && a.max_marks != null && (
                  <span>{numMark(a.marks_awarded)}/{numMark(a.max_marks)}</span>
                )}
              </div>
            </div>
            <Chevron />
          </PressBox>
        ))}
      </div>
    </>
  );
}
