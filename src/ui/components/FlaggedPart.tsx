/* ═══════════════════════════════════════════════════════════════════════════
   A FLAGGED PART ON A SAVED PAPER (AXO-216, council D1)

   One inline card per part the pipeline asked about: its measured reason,
   "Fix this" and "Not now". It never blocks the paper, which is already saved.
   Fix this opens the correction sheet: which number the teacher wrote, and what
   the answer says. The student has the paper, so what they enter is accepted at
   once and the part counts as checked. We never dispute a mark: the picker asks
   which number the teacher wrote, not which the student deserved.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import Dialog, { useDialogDismiss } from "./Dialog";
import Crop from "./Crop";
import PressBox from "./PressBox";
import { hapticTick, hapticFirm } from "../lib/haptics";
import { deferPart, fixSavedPart } from "../data/modules";
import type { QuestionRegionRef } from "../data/modules";
import { numMark } from "../data/causes";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export function FlaggedCard({ label, reason, region, paperId, onChanged }: {
  label: string;
  reason: string | null;
  region: QuestionRegionRef;
  paperId: string;
  onChanged: () => void | Promise<void>;
}) {
  const [fixing, setFixing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notNow = async () => {
    hapticTick();
    setBusy(true); setError(null);
    try { await deferPart(region.id!); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "That did not save. Try again with a connection."); }
    finally { setBusy(false); }
  };
  return (
    <div className="flagcard" role="group" aria-label={`${label} needs a look`}>
      <div className="flagcard-t">{reason ?? "Check this against your paper."}</div>
      <div className="flagcard-n">It stays out of your patterns until you check it.</div>
      {error && <p className="flagcard-err" role="alert">{error}</p>}
      <div className="flagcard-acts">
        <PressBox as="button" type="button" className="qact accent" disabled={busy}
                  onClick={() => { hapticTick(); setFixing(true); }}>
          Fix this
        </PressBox>
        <PressBox as="button" type="button" className="qact" disabled={busy} aria-busy={busy || undefined}
                  onClick={() => void notNow()}>
          Not now
        </PressBox>
      </div>
      {fixing && (
        <FixPartSheet label={label} region={region} paperId={paperId}
                      onClose={() => setFixing(false)} onSaved={onChanged} />
      )}
    </div>
  );
}

export function FixPartSheet({ label, region, paperId, onClose, onSaved }: {
  label: string;
  region: QuestionRegionRef;
  paperId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={`Fix ${label}`} description="Choose what your paper says. You have it in front of you, so your reading is the one we keep."
            className="fixpart-sheet" busy={busy} onClose={onClose}>
      <FixPartBody region={region} paperId={paperId} busy={busy} setBusy={setBusy} onSaved={onSaved} />
    </Dialog>
  );
}

function FixPartBody({ region, paperId, busy, setBusy, onSaved }: {
  region: QuestionRegionRef; paperId: string; busy: boolean; setBusy: (b: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const dismiss = useDialogDismiss();
  const readAvailable = num(region.marks_available);
  const readAwarded = num(region.marks_awarded);
  const [available, setAvailable] = useState(readAvailable === null ? "" : String(readAvailable));
  // An impossible reading (more than the part is worth) is not offered as the answer.
  const [awarded, setAwarded] = useState<number | null>(
    readAwarded !== null && readAvailable !== null && readAwarded > readAvailable ? null : readAwarded,
  );
  const [answer, setAnswer] = useState(region.student_answer ?? "");
  const [error, setError] = useState<string | null>(null);
  const span = region.page_spans?.[0];
  const outOf = readAvailable ?? (/^\d{1,3}$/.test(available) ? Number(available) : null);
  const options = outOf !== null && outOf > 0 && outOf <= 40 ? Array.from({ length: outOf + 1 }, (_, i) => i) : [];

  const save = async () => {
    setError(null);
    if (outOf === null || outOf < 1) { setError("Type how many marks this part is worth, as printed on the paper."); return; }
    if (awarded === null) { setError("Choose the number your teacher wrote."); return; }
    setBusy(true);
    try {
      const trimmed = answer.trim();
      await fixSavedPart(region.id!, {
        marksAwarded: awarded !== readAwarded ? awarded : undefined,
        marksAvailable: outOf !== readAvailable ? outOf : undefined,
        answer: trimmed !== (region.student_answer ?? "").trim() ? trimmed : undefined,
      });
      hapticFirm();
      dismiss();
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not save. Try again with a connection.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixpart">
      {span && (
        <div className="fixpart-crop">
          <Crop paperId={paperId} pageNumber={span.page} box={span.box} missing="We could not show this part of the page." />
        </div>
      )}
      {readAvailable === null && (
        <div className="sh-input">
          <label htmlFor={`fx-out-${region.id}`}>How many marks this part is worth</label>
          <input id={`fx-out-${region.id}`} inputMode="numeric" value={available} disabled={busy}
                 onChange={(e) => { setAvailable(e.target.value.replace(/\D/g, "").slice(0, 3)); setAwarded(null); }} />
        </div>
      )}
      {options.length > 0 && (
        <div className="qfield qmarkpick">
          <div className="k" id={`fx-mk-${region.id}`}>Which number did your teacher write?</div>
          <div className={options.length <= 6 ? "gseg qmarkseg" + (awarded === null ? " is-empty" : "") : "qmarkkeys"}
               role="radiogroup" aria-labelledby={`fx-mk-${region.id}`}
               style={options.length <= 6 ? { "--gseg-n": options.length, "--gseg-i": Math.max(0, awarded ?? 0) } as React.CSSProperties : undefined}>
            {options.length <= 6 && <span className="gseg-pill" aria-hidden="true" />}
            {options.map((a) => (
              <button type="button" key={a} role="radio" aria-checked={a === awarded} disabled={busy}
                      onClick={() => { hapticTick(); setAwarded(a); }}>{numMark(a)}</button>
            ))}
          </div>
        </div>
      )}
      <div className="sh-input">
        <label htmlFor={`fx-ans-${region.id}`}>What your answer says</label>
        <textarea id={`fx-ans-${region.id}`} rows={3} value={answer} disabled={busy}
                  placeholder="Leave it empty to keep the picture as the record"
                  onChange={(e) => setAnswer(e.target.value)} />
      </div>
      <p className="subnote">If a mark itself looks wrong, talk to your teacher. We go by what they wrote.</p>
      {error && <p className="flagcard-err" role="alert">{error}</p>}
      <div className="acts">
        <button type="button" className="btn primary" disabled={busy} aria-busy={busy || undefined} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
