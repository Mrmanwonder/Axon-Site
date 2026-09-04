/* ═══════════════════════════════════════════════════════════════════════════
   QUESTION DETAIL — milestone 1

   The marks, the teacher's remark, the crop, and the explanation — the whole
   promise of the product on one screen, for one question, from a paper
   already saved to the Library. Read-only: a correction happens during
   review, before the paper is saved (see ReviewSheet); once
   commit_extraction_run has run there is no "edit a committed attempt" path,
   and building one is not what AXON_FIX_BRIEF.md §6.4 asks for here.

   Crops are cut client-side from the stored page image, the same mechanism
   ReviewSheet uses (src/scan/crops.js) — there is no server-side crop_key yet
   (that's §8/WP4), and this does not need one: the box survives on
   question_region.page_spans via question_region.committed_attempt_id, the
   one column that exists to trace a committed attempt back to where it came
   from.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { readPaper, paperTypeLabel } from "../data/modules";
import type { PaperDetail, StudentAttempt } from "../data/modules";
import { CAUSE_HUE, CAUSE_LABEL, numMark } from "../data/causes";
import { paths } from "../app/paths";

function Field({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="qfield">
      <div className="k">{k}</div>
      <div className={"v" + (v ? "" : " empty")}>{v || "Not read"}</div>
    </div>
  );
}

const CONF_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  likely: "Likely",
  unsure: "Unsure",
};

export default function QuestionDetail() {
  const { paperId, qId } = useParams();
  const { student } = useApp();

  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [cropTried, setCropTried] = useState(false);

  useEffect(() => {
    if (!student || !paperId) return;
    let cancelled = false;
    readPaper(student.id, paperId)
      .then(({ data }) => { if (!cancelled) setPaper(data); })
      .catch((e) => { if (!cancelled) setLoadError(e.message || "That paper could not be opened."); });
    return () => { cancelled = true; };
  }, [student, paperId]);

  const attempt: StudentAttempt | undefined = paper?.student_attempt.find((a) => a.id === qId);

  useEffect(() => {
    if (!paper || !attempt || !paperId) return;
    const region = paper.question_region.find((r) => r.committed_attempt_id === attempt.id);
    const span = region?.page_spans?.[0];
    if (!span) { setCropTried(true); return; }
    let cancelled = false;
    import("../../scan/crops.js").then(({ cropUrl }) => cropUrl(paperId, span.page, span.box))
      .then((url) => { if (!cancelled) setCrop(url as string | null); })
      .catch(() => { /* the crop is a nicety; the marks and remark stand without it */ })
      .finally(() => { if (!cancelled) setCropTried(true); });
    return () => { cancelled = true; };
  }, [paper, attempt, paperId]);

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

  if (!paper) return null; // loading — nothing dishonest to show yet

  if (!attempt) {
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">That question could not be found on this paper.</p>
        <Link to={paths.paper(paperId!)} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
          Back to the paper
        </Link>
      </div>
    );
  }

  const loss = attempt.mark_loss_event.find((e) => !e.student_rejected_at) ?? null;
  const marksLost = attempt.max_marks != null && attempt.marks_awarded != null
    ? Number(attempt.max_marks) - Number(attempt.marks_awarded)
    : null;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <div className="rvhead" style={{ position: "static" }}>
        <Link to={paths.paper(paperId!)} className="rvback" aria-label="Back to the paper">
          <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </Link>
        <div className="rvtitle">{paperTypeLabel(paper.type)}</div>
      </div>

      <div className="qcard" style={{ margin: "12px var(--gutter) 0" }}>
        <div className="qhead">
          <span className="t1">{attempt.question_label || "This question"}</span>
          <span className={"conf " + attempt.extraction_confidence}>
            {CONF_LABEL[attempt.extraction_confidence] ?? attempt.extraction_confidence}
          </span>
          {attempt.marks_awarded != null && attempt.max_marks != null && (
            <span className="qmarks">
              {numMark(attempt.marks_awarded)}<small>/{numMark(attempt.max_marks)}</small>
            </span>
          )}
        </div>

        {/* Hard rule 4: an unreadable crop says so, never a silent gap. */}
        <div className="qcrop">
          {crop
            ? <img src={crop} alt="The part of your paper this came from" />
            : cropTried
              ? <div className="missing">We could not show this part of the page.</div>
              : <div className="missing" aria-hidden="true" />}
        </div>

        <Field k="Your answer" v={attempt.student_answer} />
        {attempt.teacher_remark && <Field k="Your teacher wrote" v={attempt.teacher_remark} />}

        <div className="qfield">
          <div className="k">Marked from</div>
          <div className="v">{attempt.marks_source === "official_scheme" ? "Official marking scheme" : "Teacher's pen"}</div>
        </div>

        {loss?.cause && (
          <div className="qfield">
            <div className="k">Why marks were lost</div>
            <div className="v">
              <span className="cause" style={{ "--c": CAUSE_HUE[loss.cause] ?? "var(--cause-timed-out)" } as React.CSSProperties}>
                <span className="sw" />
                {CAUSE_LABEL[loss.cause] ?? loss.cause}
              </span>
              {marksLost != null && marksLost > 0 && (
                <span style={{ marginLeft: 8, color: "var(--label-3)" }}>
                  {numMark(marksLost)} mark{marksLost === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {loss.ai_explanation && (
              <div className="v" style={{ marginTop: 7, color: "var(--label-2)" }}>
                {loss.ai_explanation}
              </div>
            )}
            {/* Rendered only when it clears the quality floor: specific to
                this answer, performable in an exam. An empty slot here is
                honest — generic advice trains a student to stop reading. */}
            {loss.do_this_next && (
              <div className="v" style={{ marginTop: 9 }}>
                <b>Do this next.</b> {loss.do_this_next}
              </div>
            )}
            {/* What this question was about. Descriptive, not evaluative — a
                topic is not a verdict, so these are set in one neutral tone
                rather than in the cause hues. Those seven colours mean a
                specific thing in this app, and a concept borrowing one would
                read as a diagnosis the tag is not making. */}
            {loss.concepts && loss.concepts.length > 0 && (
              <div className="concepts">
                {loss.concepts.map((c) => (
                  <span className="concept" key={c}>{c}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {!loss && marksLost != null && marksLost > 0 && (
          <div className="subnote" style={{ margin: "10px 0 0" }}>
            Marks were lost here, but we don&rsquo;t have an explanation for this one yet.
          </div>
        )}

        {marksLost === 0 && (
          <div className="subnote" style={{ margin: "10px 0 0" }}>
            Full marks on this one.
          </div>
        )}
      </div>

      <div className="subnote" style={{ margin: "16px var(--gutter) 0" }}>
        If the mark itself looks wrong, that is a conversation with your teacher — we go by what they wrote.
      </div>
    </div>
  );
}
