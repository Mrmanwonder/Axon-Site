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

import { useEffect } from "react";
import { useScan } from "./ScanProvider";
import type { ReviewQuestion } from "./ScanProvider";
import PressBox from "../components/PressBox";
import { hapticTick, hapticFirm } from "../lib/haptics";
import { CAUSE_HUE, CAUSE_LABEL, numMark as num } from "../data/causes";

function Field({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="qfield">
      <div className="k">{k}</div>
      <div className={"v" + (v ? "" : " empty")}>{v || "Not read"}</div>
    </div>
  );
}

function Question({
  q, onAction, onMark,
}: {
  q: ReviewQuestion;
  onAction: (id: string, action: string) => void;
  onMark: (id: string, value: number) => void;
}) {
  const attention = q.tier !== "confident";

  const conf = q.tier === "unreadable"
    ? <span className="conf unsure">Couldn&rsquo;t read</span>
    : q.tier === "unsure"
      ? <span className="conf unsure">Unsure</span>
      : q.confirmed
        ? <span className="conf confirmed">You confirmed</span>
        : <span className="conf likely">Read cleanly</span>;

  return (
    <div className="qcard" data-attention={attention ? "1" : undefined}>
      <div className="qhead">
        <span className="t1">{q.label || "This question"}</span>
        {conf}
        {q.marksAwarded != null && q.marksAvailable != null && (
          <span className="qmarks">
            {num(q.marksAwarded)}<small>/{num(q.marksAvailable)}</small>
          </span>
        )}
      </div>

      {/* Hard rule 4: an unreadable crop says so and shows why. It is never
          quietly dropped, and never filled with a plausible guess. */}
      <div className="qcrop">
        {q.crop
          ? <img src={q.crop} alt="The part of your paper this came from" />
          : <div className="missing">{q.unreadableReason || "We could not show this part of the page."}</div>}
      </div>

      {!!q.alternatives?.length && (
        <>
          <div className="qfield"><div className="k">Which number did your teacher write?</div></div>
          <div className="qalts" role="radiogroup" aria-label="Which number did your teacher write?">
            {q.alternatives.map((a) => (
              <PressBox
                as="button" type="button" key={a}
                className={"qalt" + (a === q.marksAwarded ? " on" : "")}
                role="radio"
                aria-checked={a === q.marksAwarded}
                onClick={() => { hapticTick(); onMark(q.id, a); }}
              >
                {num(a)}
              </PressBox>
            ))}
          </div>
        </>
      )}

      <Field k="Your answer" v={q.answer} />
      {q.remark && <Field k="Your teacher wrote" v={q.remark} />}

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
              {q.explanation.body}
            </div>
          )}
          {/* Rendered only when it clears the bar: specific to this answer, and
              performable during an exam. An empty slot is honest; generic advice
              trains students to stop reading. */}
          {q.explanation.doThisNext && (
            <div className="v" style={{ marginTop: 9 }}>
              <b>Do this next.</b> {q.explanation.doThisNext}
            </div>
          )}
        </div>
      )}

      <div className="qacts">
        {!q.confirmed && (
          <PressBox as="button" type="button" className="qact accent"
                    onClick={() => { hapticTick(); onAction(q.id, "confirm"); }}>
            That&rsquo;s right
          </PressBox>
        )}
        <PressBox as="button" type="button" className="qact"
                  onClick={() => { hapticTick(); onAction(q.id, "type"); }}>
          Fix this
        </PressBox>
        <PressBox as="button" type="button" className="qact"
                  onClick={() => { hapticTick(); onAction(q.id, "rescan"); }}>
          Rescan this page
        </PressBox>
        {q.explanation?.cause && !q.causeRejected && (
          <PressBox as="button" type="button" className="qact"
                    onClick={() => { hapticTick(); onAction(q.id, "cause"); }}>
            Not why I lost it
          </PressBox>
        )}
      </div>
    </div>
  );
}

export default function ReviewSheet() {
  const { review, reviewHandlers, reviewOpen, closeReview } = useScan();

  /* Back closes the review rather than leaving the app. It is a full-screen
     surface over the shell, so the hardware back gesture has to mean what it
     looks like it means. */
  useEffect(() => {
    if (!reviewOpen) return;
    history.pushState({ review: true }, "");
    const onPop = () => closeReview();
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [reviewOpen, closeReview]);

  if (!review || !reviewHandlers) return null;

  return (
    <div className={"reviewsheet" + (reviewOpen ? " open" : "")}
         role="dialog" aria-modal="true" aria-label={review.title}>
      <div className="rvhead">
        <PressBox as="button" type="button" className="rvback" aria-label="Back"
                  onClick={closeReview}>
          <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </PressBox>
        <div className="rvtitle">{review.title}</div>
        <PressBox as="button" type="button" className="rvsave"
                  disabled={!!review.saving} aria-busy={review.saving || undefined}
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

        {review.lead && <div className="subnote" style={{ marginTop: 14 }}>{review.lead}</div>}

        {review.questions.map((q) => (
          <Question key={q.id} q={q}
                    onAction={reviewHandlers.onAction}
                    onMark={reviewHandlers.onMark} />
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
                    disabled={!!review.saving} aria-busy={review.saving || undefined}
                    onClick={() => { hapticFirm(); reviewHandlers.onSave(); }}>
            {review.saveLabel}
          </PressBox>
        </div>
      </div>
    </div>
  );
}
