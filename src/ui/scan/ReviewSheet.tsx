/* ═══════════════════════════════════════════════════════════════════════════
   STAGE 9 · REVIEW

   Required, not skippable, and not defaulted to accept. A confident-paper fast
   path is earned once extraction accuracy is measured rather than assumed, and
   until then every paper passes through here.

   Unsure and unreadable come first. **Every field is shown against its own
   crop**, which is only possible because every extracted value carries the box
   on the page it was read from — `question_region` has a CHECK making a value
   without its box unstorable. That provenance is the defence against a vision
   model producing plausible fiction, and it is the entire reason this screen can
   exist in the form it does.

   Three rules the copy here is holding:

   · **We never dispute a mark.** The alternatives picker asks which number the
     teacher wrote, not which the student deserved. If the mark itself looks
     wrong, that is a conversation with their teacher.
   · **A wrong cause tag is accepted instantly.** It is self-knowledge and
     exactly the signal we want; there is nothing to negotiate, and the label is
     "Not why I lost it", never "disagree".
   · **Nothing is locked because we were confident.**
   ═══════════════════════════════════════════════════════════════════════════ */

import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { useScan } from "./ScanProvider";
import type { ReviewQuestion } from "./ScanProvider";
import PressBox from "../components/PressBox";
import SourceEvidence from "../components/SourceEvidence";
import MaterialSymbol from "../components/MaterialSymbol";
import TeacherMarkControl from "./TeacherMarkControl";
import "../styles/review-reading.css";
import { hapticTick, hapticFirm } from "../lib/haptics";
import { CAUSE_HUE, CAUSE_LABEL, numMark as num } from "../data/causes";
const AcademicText = lazy(() => import("../components/AcademicText"));
const AnswerBlockView = lazy(() => import("../components/AnswerBlock"));

function RichText({ text }: { text: string }) {
  return (
    <Suspense fallback={text}>
      <AcademicText text={text} />
    </Suspense>
  );
}

function Field({ k, v, steps }: { k: string; v?: string | null; steps?: boolean }) {
  return (
    <div className="qfield">
      <div className="k">{k}</div>
      {/* `steps` keeps the line breaks the student actually wrote. Their
          working is the answer in a notation-dense subject, and reading it
          back as one paragraph is reading someone else's answer. */}
      <div className={"v" + (v ? "" : " empty") + (steps && v ? " steps" : "")}>
        {v ? <RichText text={v} /> : "Not read"}
      </div>
    </div>
  );
}

function Question({
  q, onAction, onMark, onAnswer, onBlocked,
}: {
  q: ReviewQuestion;
  onAction: (id: string, action: string) => void;
  onMark: (id: string, value: number) => void | Promise<void>;
  onAnswer?: (id: string, value: string) => void | Promise<void>;
  onBlocked: (id: string, blocked: boolean) => void;
}) {
  const attention = !q.confirmed && q.tier !== "confident";
  const [editing, setEditing] = useState(false);
  const [answerDraft, setAnswerDraft] = useState(q.answer ?? "");
  const [answerBusy, setAnswerBusy] = useState(false);
  const answerFlight = useRef(false);
  const [markBusy, setMarkBusy] = useState(false);
  const [markDirty, setMarkDirty] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const answerInputId = useId();
  const blocked = answerBusy || markBusy || markDirty || editing;
  useEffect(() => { onBlocked(q.id, blocked); return () => onBlocked(q.id, false); }, [q.id, blocked, onBlocked]);
  async function saveAnswer() {
    if (!onAnswer || answerFlight.current) return;
    answerFlight.current = true; setAnswerBusy(true); setAnswerError(null);
    try { await onAnswer(q.id, answerDraft); setEditing(false); }
    catch (cause) { setAnswerError(cause instanceof Error ? cause.message : "Your answer was not saved. Try again."); }
    finally { answerFlight.current = false; setAnswerBusy(false); }
  }

  const conf = q.confirmed
    ? <span className="conf confirmed">You confirmed</span>
    : q.tier === "unreadable"
    ? <span className="conf unsure">Couldn&rsquo;t read</span>
    : q.tier === "unsure"
      ? <span className="conf unsure">Unsure</span>
      : <span className="conf likely">Read cleanly</span>;

  return (
    <section className="qcard" aria-label={q.label || "This question"} data-attention={attention ? "1" : undefined}>
      <div className="qhead">
        <h2 className="t1">{q.label || "This question"}</h2>
        {conf}
        {q.marksAwarded != null && q.marksAvailable != null && (
          <span className="qmarks">
            {num(q.marksAwarded)}<small>/{num(q.marksAvailable)}</small>
          </span>
        )}
      </div>

      <Field k="Printed question" v={q.questionText} steps />
      {q.identityNote && <p className="review-draft-note">{q.identityNote}</p>}
      <div className="review-reading-grid">
      <div className="review-source">
        <SourceEvidence
          paperId={q.crop?.paperId ?? q.paperId}
          pageNumber={q.crop?.page ?? q.pageNumber}
          pageNumbers={q.pageNumbers}
          box={q.crop?.box}
          missing={q.unreadableReason || "We could not show this part of the page."}
        />
      </div>

      <div className="review-fields">
      <Suspense fallback={<Field k="What Axon read" v={q.answer} steps />}><AnswerBlockView block={q.answerBlock ?? null} rawText={q.answer ?? null} recognition={null} /></Suspense>
      {editing && <div className="review-answer-editor">
        <label htmlFor={answerInputId}>Edit answer transcription</label>
        <p>Copy what you wrote, including line breaks. This does not change the teacher’s mark.</p>
        <textarea id={answerInputId} rows={5} value={answerDraft} disabled={answerBusy} onChange={event => setAnswerDraft(event.target.value)} />
        <div className="qacts"><button type="button" className="qact" disabled={answerBusy} onClick={() => void saveAnswer()}>{answerBusy ? "Saving answer…" : "Save answer transcription"}</button>
          <button type="button" className="qact" disabled={answerBusy} onClick={() => { setEditing(false); setAnswerDraft(q.answer ?? ""); setAnswerError(null); }}>Cancel edit</button></div>
        {answerError && <p role="alert">{answerError}</p>}
      </div>}
      <div className="qfield"><div className="k">Teacher’s mark as read</div><div className="v">{q.marksAwarded == null ? "Not read" : num(q.marksAwarded)}{q.marksAvailable != null ? ` out of ${num(q.marksAvailable)}` : " · Maximum not read"}</div></div>
      {q.remark && <Field k="Your teacher wrote" v={q.remark} steps />}
      {q.allocationUnusable && (
        <div className="qfield">
          <div className="k">How many marks this question is worth</div>
          <div className="v empty">
            The allocation does not fit this paper’s mark steps. Copy the teacher’s mark from the source; check the allocation or rescan this page.
          </div>
        </div>
      )}

      {!q.confirmed && <p className="review-pending"><MaterialSymbol name="attention" size={20} />{q.unreadableReason ?? (attention ? "Some readings are uncertain. Compare each field with the saved page." : "Check all readings against the saved page before confirming.")}</p>}
      <TeacherMarkControl id={q.id} awarded={q.marksAwarded} available={q.marksAvailable} step={q.markStep} allocationUnusable={q.allocationUnusable} onSave={onMark} onBusy={setMarkBusy} onDraft={setMarkDirty} />

      {q.explanation?.cause && (
        <div className="qfield">
          <div className="k">Why the mark went</div>
          <div className="v">
            <span className="cause" style={{ "--c": CAUSE_HUE[q.explanation.cause] ?? "var(--cause-timed-out)" } as React.CSSProperties}>
              <span className="sw" />
              {CAUSE_LABEL[q.explanation.cause] ?? q.explanation.cause}
            </span>
          </div>
          {q.explanation.body && (
            <div className="v" style={{ marginTop: 7, color: "var(--label-2)" }}>
              <RichText text={q.explanation.body} />
            </div>
          )}
          {/* Rendered only when it clears the bar: specific to this answer, and
              performable during an exam. An empty slot is honest; generic advice
              trains students to stop reading. */}
          {q.explanation.doThisNext && (
            <div className="v" style={{ marginTop: 9 }}>
              <b>Do this next.</b>{" "}<RichText text={q.explanation.doThisNext} />
            </div>
          )}
        </div>
      )}

      <div className="qacts">
        {!q.confirmed && (
          <PressBox as="button" type="button" className="qact accent"
                    disabled={blocked} onClick={() => { hapticTick(); onAction(q.id, "confirm"); }}>
            <MaterialSymbol name="confirmed" size={20} />Confirm all readings
          </PressBox>
        )}
        <PressBox as="button" type="button" className="qact"
                  disabled={answerBusy || markBusy} onClick={() => { hapticTick(); if (onAnswer) { setAnswerDraft(q.answer ?? ""); setAnswerError(null); setEditing(true); } else onAction(q.id, "type"); }}>
          <MaterialSymbol name="edit" size={20} />Edit answer transcription
        </PressBox>
        <PressBox as="button" type="button" className="qact"
                  disabled={blocked} onClick={() => { hapticTick(); onAction(q.id, "rescan"); }}>
          <MaterialSymbol name="rescan" size={20} />Rescan this page
        </PressBox>
        {q.explanation?.cause && !q.causeRejected && (
          <PressBox as="button" type="button" className="qact"
                    onClick={() => { hapticTick(); onAction(q.id, "cause"); }}>
            Not why I lost it
          </PressBox>
        )}
      </div>
      {(markDirty || editing) && <p className="review-draft-note">Save or cancel the field edit before confirming this question.</p>}
      </div></div>
    </section>
  );
}

export default function ReviewSheet() {
  const { review, reviewHandlers, reviewOpen, closeReview } = useScan();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const onBlocked = useCallback((id: string, blocked: boolean) => setBlockedIds(previous => {
    if (previous.has(id) === blocked) return previous;
    const next = new Set(previous); if (blocked) next.add(id); else next.delete(id); return next;
  }), []);
  const hasDraft = blockedIds.size > 0;

  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (reviewOpen) root.current?.focus(); }, [reviewOpen]);
  if (!reviewOpen || !review || !reviewHandlers) return null;

  return (
    <div className={"reviewsheet" + (reviewOpen ? " open" : "")}
         ref={root} tabIndex={-1} role="region" aria-label={review.title}>
      <div className="rvhead">
        <PressBox as="button" type="button" className="rvback" aria-label="Back"
                  onClick={closeReview}>
          <MaterialSymbol name="back" />
        </PressBox>
        <h1 className="rvtitle">{review.title}</h1>
        <PressBox as="button" type="button" className="rvsave"
                  disabled={!!review.saving || hasDraft} aria-busy={review.saving || undefined}
                  onClick={() => { hapticFirm(); reviewHandlers.onSave(); }}>
          Save
        </PressBox>
      </div>

      <div className="rvscroll">
        {/* A reconciliation gap, put into words. We state both numbers and let
            the student look; we do not assert which is correct, because the one
            on the paper is the one that counts. */}
        {review.delta && (
          <div className="delta">
            <div className="t1">Worth a second look</div>
            <div className="t2">{review.delta.message}</div>
            <div className="sums">
              <div>Our reading<b>{num(review.delta.ours)}</b></div>
              <div>On the paper<b>{num(review.delta.theirs)}</b></div>
            </div>
          </div>
        )}

        {review.noTotal && <div className="subnote" style={{ marginTop: 14 }}>{review.noTotal}</div>}

        {review.lead && <div className="subnote" style={{ marginTop: 14 }}>{review.lead}</div>}

        {review.questions.map((q) => (
          <Question key={q.id} q={q}
                    onAction={reviewHandlers.onAction}
                    onMark={reviewHandlers.onMark} onAnswer={reviewHandlers.onAnswer} onBlocked={onBlocked} />
        ))}

        {/* Every question still has to be confirmed before the paper can be
            saved — enforced in SQL, not here — but a required step costing
            fourteen identical taps is a step people learn to rush past. */}
        {review.cleanCount > 0 && (
          <div className="bulkrow">
            <div className="b">
              <div className="t1">{review.cleanCount} read cleanly</div>
              <div className="t2">
                Their crops are above. Accept them together, or check them one at a time.
              </div>
            </div>
            <PressBox as="button" type="button" className="qact accent"
                      disabled={hasDraft || !!review.saving}
                      onClick={() => { hapticFirm(); reviewHandlers.onConfirmClean(); }}>
              These look right
            </PressBox>
          </div>
        )}

        <div className="subnote">
          Nothing here is locked because we were confident. If the mark itself
          looks wrong, that is a conversation with your teacher — we go by what
          they wrote.
        </div>

        <div style={{ margin: "20px var(--gutter) 4px" }}>
          <PressBox as="button" type="button" className="btn primary"
                    data-waiting={review.outstanding || review.saving ? "1" : undefined}
                    disabled={!!review.saving || hasDraft} aria-busy={review.saving || undefined}
                    onClick={() => { hapticFirm(); reviewHandlers.onSave(); }}>
            {review.saveLabel}
          </PressBox>
        </div>
      </div>
    </div>
  );
}
