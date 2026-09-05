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
   from. Both surfaces share <Crop>, which cuts with CSS rather than a canvas;
   the canvas path needed a cross-origin fetch and was failing on a missing
   CORS header, which is what "we could not show this part of the page" was
   actually reporting.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { readPaper, paperTypeLabel } from "../data/modules";
import type { PaperDetail, StudentAttempt } from "../data/modules";
import { CAUSE_HUE, CAUSE_LABEL, numMark } from "../data/causes";
import Crop from "../components/Crop";
import Disclose from "../components/Disclose";
import { paths } from "../app/paths";

function Field({ k, v, steps }: { k: string; v?: string | null; steps?: boolean }) {
  return (
    <div className="qfield">
      <div className="k">{k}</div>
      {/* `steps` keeps the line breaks the student actually wrote. Their
          working is the answer in a notation-dense subject, and reading it
          back as one paragraph is reading someone else's answer. */}
      <div className={"v" + (v ? "" : " empty") + (steps && v ? " steps" : "")}>{v || "Not read"}</div>
    </div>
  );
}

/* Plain words, deliberately. These are Axon's categories, not Cambridge's, and
   spelling them out is what keeps them from being mistaken for mark-scheme
   notation. "other" is absent on purpose: it has no honest label, so the chip
   simply does not render and the cause and note carry the row. */
const ERROR_TYPE_LABEL: Record<string, string> = {
  method: "Method",
  final_answer: "Final answer",
  omitted_step: "Missing step",
  presentation: "Presentation",
};

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

  useEffect(() => {
    if (!student || !paperId) return;
    let cancelled = false;
    readPaper(student.id, paperId)
      .then(({ data }) => { if (!cancelled) setPaper(data); })
      .catch((e) => { if (!cancelled) setLoadError(e.message || "That paper could not be opened."); });
    return () => { cancelled = true; };
  }, [student, paperId]);

  const attempt: StudentAttempt | undefined = paper?.student_attempt.find((a) => a.id === qId);

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

  // Where on the page this answer was read from. This is the whole point of the
  // provenance rule: committed_attempt_id is the one column that traces a saved
  // attempt back to the region it came from, and page_spans carries the box.
  const region = paper.question_region.find((r) => r.committed_attempt_id === attempt.id);
  const span = region?.page_spans?.[0];

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
          <Crop paperId={paperId} pageNumber={span?.page} box={span?.box} />
        </div>

        <Field k="Your answer" v={attempt.student_answer} steps />

        {/* The corrected working, one tap below the student's own, in the same
            step shape so the two can be read against each other. Collapsed at
            rest rather than gated: nothing here asks them to prove they tried
            first — the copy rules are explicit that a UI which makes the user
            earn its content is the wrong shape — but it is also not the first
            thing on the screen, so what they actually wrote is what they read
            first. do_this_next names the fix; this is the fix carried through. */}
        {loss?.model_answer && (
          <div className="qfield">
            <Disclose label="See the corrected working">
              <div className="worked">{loss.model_answer}</div>
              <div className="wnote">
                How this question is answered &mdash; not a mark. If the mark itself looks wrong,
                that is a conversation with your teacher.
              </div>
            </Disclose>
          </div>
        )}

        {attempt.teacher_remark && <Field k="Your teacher wrote" v={attempt.teacher_remark} steps />}

        <div className="qfield">
          <div className="k">Marked from</div>
          <div className="v">{attempt.marks_source === "official_scheme" ? "Official marking scheme" : "Teacher's pen"}</div>
        </div>

        {loss?.cause && (
          <div className="qfield">
            {/* What the question asked of an answer, before why this one fell
                short. A Cambridge question is built around its command word,
                and reading "Explain" as "State" is among the most common and
                most fixable ways a mark goes — invisible to a student nobody
                told the word was doing work. */}
            {loss.command_word && (
              <>
                <div className="k">What this question asked for</div>
                <div className="cmdword">
                  <span className="w">{loss.command_word}</span>
                  {loss.command_word_note && <span className="n">{loss.command_word_note}</span>}
                </div>
                <div style={{ height: 14 }} />
              </>
            )}
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
            {/* Where the deduction breaks into distinct parts, each is its own
                diagnosis. A two-part mistake averaged into one "concept gap"
                loses the half the student could have fixed on the day. Empty is
                the normal case and the flat cause above carries it alone —
                which is also what every paper committed before this shipped
                will do, so the fallback is the common path, not an edge. */}
            {loss.loss_reasons && loss.loss_reasons.length > 0 && (
              <div className="reasons">
                {loss.loss_reasons.map((r, i) => (
                  <div className="reason" key={i}>
                    <span
                      className="rail"
                      style={{ "--c": (r.cause && CAUSE_HUE[r.cause]) || "var(--cause-timed-out)" } as React.CSSProperties}
                      aria-hidden="true"
                    />
                    <div className="b">
                      <div className="t">
                        {/* What the mistake looked like, where the cause says
                            why. Whole words, never a letter: a single-character
                            badge here would read as mark-scheme notation, which
                            is exactly what this field exists to avoid being.
                            "other" carries no label — a chip reading "Other"
                            says nothing the row does not already say. */}
                        {r.error_type && ERROR_TYPE_LABEL[r.error_type] && (
                          <span className="etype">{ERROR_TYPE_LABEL[r.error_type]}</span>
                        )}
                        {/* Null on every row today, and a database CHECK keeps
                            it that way for Tier 1: M/A/B/C is Cambridge's own
                            notation, a Tier 1 paper has no scheme to read it
                            from, and it is not ours to reproduce. It renders
                            only if an explanation grounded in licensed scheme
                            text ever fills it. */}
                        {r.mark_type && <span className="mt">{r.mark_type}</span>}
                        <span className="cz">{(r.cause && CAUSE_LABEL[r.cause]) || r.cause}</span>
                        <span className="m">{numMark(r.marks)} mark{r.marks === 1 ? "" : "s"}</span>
                      </div>
                      {r.note && <div className="nt">{r.note}</div>}
                    </div>
                  </div>
                ))}
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
