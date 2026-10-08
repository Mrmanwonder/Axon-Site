/* ═══════════════════════════════════════════════════════════════════════════
   STAGE 9 · REVIEW ("Check the reading")

   Opt-in since AXO-216 (council D1, 7 Oct 2026). A read paper saves on its own;
   parts with a measured reason ask on the paper, one card each. This screen is
   the whole reading for a student who wants to look, and the way to fix a
   paper whose save was refused. Nothing here waits for every part.

   Flagged and unreadable come first. **Every field is shown against its own
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

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Dialog, { SHEET_EXIT_MS, useDialogDismiss } from "../components/Dialog";
import { useScan } from "./ScanProvider";
import type { ReviewQuestion } from "./ScanProvider";
import PressBox from "../components/PressBox";
import Crop from "../components/Crop";
import { hapticTick, hapticFirm } from "../lib/haptics";
import { numMark as num } from "../data/causes";
const AcademicText = lazy(() => import("../components/AcademicText"));

function RichText({ text }: { text: string }) {
  return (
    <Suspense fallback={text}>
      <AcademicText text={text} />
    </Suspense>
  );
}

function Field({ k, v, steps, empty = "Not read" }: { k: string; v?: string | null; steps?: boolean; empty?: string }) {
  return (
    <div className="qfield">
      <div className="k">{k}</div>
      {/* `steps` keeps the line breaks the student actually wrote. Their
          working is the answer in a notation-dense subject, and reading it
          back as one paragraph is reading someone else's answer. */}
      <div className={"v" + (v ? "" : " empty") + (steps && v ? " steps" : "")}>
        {v ? <RichText text={v} /> : empty}
      </div>
    </div>
  );
}

function Question({
  q, onAction, onMark, onPlace, saved = false,
}: {
  q: ReviewQuestion;
  onAction: (id: string, action: string) => void;
  onMark: (id: string, value: number) => void;
  onPlace?: (q: ReviewQuestion) => void;
  /** The paper is saved: a rescan would read it again from scratch, so it is not offered here. */
  saved?: boolean;
}) {
  const attention = !q.confirmed && (q.flagged || q.tier !== "confident");

  const conf = q.confirmed
    ? <span className="conf confirmed">You confirmed</span>
    : q.tier === "unreadable"
    ? <span className="conf unsure">Couldn&rsquo;t read</span>
    : q.tier === "unsure"
      ? <span className="conf unsure">Unsure</span>
      : q.flagged
        // Saved as unsure until checked (AXO-216), so never called clean.
        ? <span className="conf unsure">Needs a look</span>
        : <span className="conf likely">Read cleanly</span>;

  return (
    <div className="qcard" data-attention={attention ? "1" : undefined}>
      {q.reason && !q.confirmed && <div className="qfield"><div className="v">{q.reason}</div></div>}
      <div className="qhead">
        {onPlace ? (
          <PressBox as="button" type="button" className="t1 qlabel" aria-label={`${/^(Question|Unassigned)/.test(q.label ?? "") ? q.label : `Question ${q.label || "not numbered"}`}. Change`}
                    onClick={() => { hapticTick(); onPlace(q); }}>
            {q.label || "This question"}
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
          </PressBox>
        ) : <span className="t1">{q.label || "This question"}</span>}
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
        <Crop
          paperId={q.crop?.paperId}
          pageNumber={q.crop?.page}
          box={q.crop?.box}
          missing={q.unreadableReason || "We could not show this part of the page."}
        />
      </div>

      {/* Hard rule 4 again, on the mark rather than the crop. A part whose
          allocation did not read as a whole number gets no grid: rounding it
          offered a mark above the allocation, which the typed rung then
          refused. The gap is named rather than left blank, and it points at
          the rung that still works. */}
      {q.allocationUnusable && (
        <div className="qfield">
          <div className="k">How many marks this question is worth</div>
          <div className="v empty">
            We couldn&rsquo;t read this as a whole number of marks, so we&rsquo;re not guessing at the
            options. Type the mark your teacher wrote, or rescan this page.
          </div>
        </div>
      )}

      {!!q.alternatives?.length && <MarkPicker q={q} onMark={onMark} />}

      <Field k="Your answer" v={q.answer} steps
             empty={q.regionType === "diagram"
               ? "A drawn answer. Axon does not turn drawings into text, so the picture above is the record."
               : "Not read. Fix this to type it, or keep the picture above as the record."} />
      {q.remark && <Field k="Your teacher wrote" v={q.remark} steps />}

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
        {!saved && (
          <PressBox as="button" type="button" className="qact"
                    onClick={() => { hapticTick(); onAction(q.id, "rescan"); }}>
            Rescan this page
          </PressBox>
        )}
      </div>
    </div>
  );
}

/* Which number did the teacher write? The onboarding selector, so the choice
   reads as one control, not a row of radio buttons (owner, 6 Oct 2026). More
   than six options wrap as plain number keys of the same size. */
function MarkPicker({ q, onMark }: { q: ReviewQuestion; onMark: (id: string, value: number) => void }) {
  const options = q.alternatives ?? [];
  const label = "Which number did your teacher write?";
  const chosen = options.findIndex((a) => a === q.marksAwarded);
  const pick = (a: number) => { if (a !== q.marksAwarded) { hapticTick(); onMark(q.id, a); } };
  // The radio keyboard pattern: one tab stop, arrows move and choose.
  const focusIndex = chosen < 0 ? 0 : chosen;
  const onKey = (event: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (i + step + options.length) % options.length;
    const group = event.currentTarget.parentElement;
    group?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
    pick(options[next]);
  };
  return (
    <div className="qfield qmarkpick">
      <div className="k" id={`mk-${q.id}`}>{label}</div>
      {options.length <= 6 ? (
        <div className={"gseg qmarkseg" + (chosen < 0 ? " is-empty" : "")} role="radiogroup" aria-labelledby={`mk-${q.id}`}
             style={{ "--gseg-n": options.length, "--gseg-i": Math.max(0, chosen) } as React.CSSProperties}>
          <span className="gseg-pill" aria-hidden="true" />
          {options.map((a, i) => (
            <button type="button" key={a} role="radio" aria-checked={a === q.marksAwarded}
                    tabIndex={i === focusIndex ? 0 : -1} onKeyDown={(e) => onKey(e, i)}
                    onClick={() => pick(a)}>{num(a)}</button>
          ))}
        </div>
      ) : (
        <div className="qmarkkeys" role="radiogroup" aria-labelledby={`mk-${q.id}`}>
          {options.map((a, i) => (
            <button type="button" key={a} role="radio" aria-checked={a === q.marksAwarded}
                    tabIndex={i === focusIndex ? 0 : -1} onKeyDown={(e) => onKey(e, i)}
                    onClick={() => pick(a)}>{num(a)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const PARTS = ["", "a", "b", "c", "d", "e", "f", "g", "h"];
const SUBPARTS = ["", "i", "ii", "iii", "iv", "v", "vi"];

function parseLabel(label?: string) {
  // Accepts "1(a)(ii)" and the display forms "Question 1(a)" / "Unassigned part (b)".
  const m = String(label ?? "").replace(/\s+/g, "").replace(/^(question|unassignedpart)/i, "").match(/^(\d{1,3})?(?:\(?([a-h])\)?)?(?:\(?((?:i|ii|iii|iv|v|vi))\)?)?$/i);
  return { q: m?.[1] ? Number(m[1]) : null, part: (m?.[2] ?? "").toLowerCase(), sub: (m?.[3] ?? "").toLowerCase() };
}

/* Place a part by hand: question number, part, sub-part, each a tap. The
   student has the paper in front of them; their answer is the label. */
function PlaceSheet({ q, highest, onClose, onPlace }: {
  q: ReviewQuestion; highest: number; onClose: () => void; onPlace: (id: string, label: string) => Promise<void>;
}) {
  const start = parseLabel(q.label);
  const [num, setNum] = useState<number | null>(start.q);
  const [part, setPart] = useState(start.part);
  const [sub, setSub] = useState(start.sub);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = Math.min(40, Math.max(12, highest + 3));
  const label = num ? `${num}${part ? `(${part})` : ""}${sub ? `(${sub})` : ""}` : "";
  return (
    <Dialog title="Which question is this?" description="Choose it as it is printed on your paper." className="qplace-sheet"
            busy={busy} onClose={onClose}>
      <PlaceBody q={q} count={count} num={num} setNum={setNum} part={part} setPart={setPart} sub={sub} setSub={setSub}
                 label={label} error={error} busy={busy}
                 onSave={async (dismiss) => {
                   if (!label) { setError("Choose the question number."); return; }
                   setBusy(true); setError(null);
                   try { await onPlace(q.id, label); dismiss(); }
                   catch (e) { setError(e instanceof Error ? e.message : "That could not be changed. Try again."); }
                   finally { setBusy(false); }
                 }} />
    </Dialog>
  );
}

function PlaceBody({ q, count, num, setNum, part, setPart, sub, setSub, label, error, busy, onSave }: {
  q: ReviewQuestion; count: number; num: number | null; setNum: (n: number) => void;
  part: string; setPart: (p: string) => void; sub: string; setSub: (p: string) => void;
  label: string; error: string | null; busy: boolean; onSave: (dismiss: () => void) => void;
}) {
  const dismiss = useDialogDismiss();
  return (
    <div className="qplace">
      {q.crop && (
        <div className="qplace-crop">
          <Crop paperId={q.crop.paperId} pageNumber={q.crop.page} box={q.crop.box} missing="" />
        </div>
      )}
      <div className="qplace-k">Question</div>
      <div className="qplace-keys" role="radiogroup" aria-label="Question number">
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <button type="button" key={n} role="radio" aria-checked={n === num} onClick={() => { hapticTick(); setNum(n); }}>{n}</button>
        ))}
      </div>
      <div className="qplace-k">Part</div>
      <div className="qplace-keys" role="radiogroup" aria-label="Part">
        {PARTS.map((p) => (
          <button type="button" key={p || "none"} role="radio" aria-checked={p === part}
                  onClick={() => { hapticTick(); setPart(p); if (!p) setSub(""); }}>{p ? `(${p})` : "None"}</button>
        ))}
      </div>
      {part && (
        <>
          <div className="qplace-k">Sub-part</div>
          <div className="qplace-keys" role="radiogroup" aria-label="Sub-part">
            {SUBPARTS.map((p) => (
              <button type="button" key={p || "none"} role="radio" aria-checked={p === sub}
                      onClick={() => { hapticTick(); setSub(p); }}>{p ? `(${p})` : "None"}</button>
            ))}
          </div>
        </>
      )}
      {error && <p className="qplace-err" role="alert">{error}</p>}
      <div className="acts">
        <button type="button" className="btn primary" disabled={!label || busy} aria-busy={busy || undefined}
                onClick={() => onSave(dismiss)}>
          {label ? `This is ${label}` : "Choose the question"}
        </button>
      </div>
    </div>
  );
}

export default function ReviewSheet() {
  const { review, reviewHandlers, reviewOpen, closeReview } = useScan();

  const root = useRef<HTMLDivElement>(null);
  const [placing, setPlacing] = useState<ReviewQuestion | null>(null);
  useEffect(() => { if (reviewOpen) root.current?.focus(); }, [reviewOpen]);
  if (!reviewOpen || !review || !reviewHandlers) return null;
  const highest = review.questions.reduce((m, q) => Math.max(m, parseLabel(q.label).q ?? 0), 0);

  return (
    <div className={"reviewsheet" + (reviewOpen ? " open" : "")}
         ref={root} tabIndex={-1} role="region" aria-label={review.title}>
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

        {(review.lead || review.noTotal) && (
          <div className="subnote rv-lead">
            {review.lead}
            {review.noTotal && <span className="rv-lead-2">{review.noTotal}</span>}
          </div>
        )}

        {review.questions.map((q) => (
          <Question key={q.id} q={q}
                    onAction={reviewHandlers.onAction}
                    onMark={reviewHandlers.onMark}
                    onPlace={reviewHandlers.onRelabel ? setPlacing : undefined}
                    saved={!!review.committed} />
        ))}

        {/* One tap accepts only parts that were read cleanly and that nobody
            flagged. A flagged part is checked one at a time or left unsure:
            the old "All are right" confirmed 44 unsure parts into analytics in
            one tap (ADDENDUM-01A item 5, AXO-216). */}
        {review.cleanCount > 0 && (
          <div className="bulkrow">
            <div className="b">
              <div className="t1">{review.cleanCount} read cleanly</div>
              <div className="t2">Accept them together, or check them one at a time.</div>
            </div>
            <PressBox as="button" type="button" className="qact accent"
                      onClick={() => { hapticFirm(); reviewHandlers.onConfirmClean(); }}>
              These look right
            </PressBox>
          </div>
        )}

        <div className="subnote">
          If a mark itself looks wrong, talk to your teacher. We go by what they wrote.
        </div>

        <div style={{ margin: "20px var(--gutter) 4px" }}>
          <PressBox as="button" type="button" className="btn primary"
                    data-waiting={review.saving ? "1" : undefined}
                    disabled={!!review.saving} aria-busy={review.saving || undefined}
                    onClick={() => { hapticFirm(); reviewHandlers.onSave(); }}>
            {review.saveLabel}
          </PressBox>
        </div>
      </div>
      {placing && reviewHandlers.onRelabel && (
        <PlaceSheet q={placing} highest={highest} onClose={() => setPlacing(null)}
                    onPlace={async (id, label) => {
                      await reviewHandlers.onRelabel!(id, label);
                      window.setTimeout(() => hapticFirm(), SHEET_EXIT_MS);
                    }} />
      )}
    </div>
  );
}
