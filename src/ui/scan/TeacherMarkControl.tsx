import { useEffect, useId, useRef, useState } from "react";
import { numMark } from "../data/causes";

/** Draft selection and durable saving are separate. Saving this field never confirms the question. */
export default function TeacherMarkControl({ id, awarded, available, step = 1, allocationUnusable, onSave, onBusy, onDraft }: {
  id: string; awarded?: number | null; available?: number | null; step?: number; allocationUnusable?: boolean;
  onSave: (id: string, value: number) => void | Promise<void>;
  onBusy?: (busy: boolean) => void;
  onDraft?: (dirty: boolean) => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState(awarded == null ? "" : String(awarded));
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const dirty = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!flight.current && !dirty.current) setDraft(awarded == null ? "" : String(awarded)); }, [awarded]);
  const knownMaximum = available != null && Number.isFinite(available) && available >= 0;
  const validStep = Number.isFinite(step) && step > 0 ? step : 1;
  const small = knownMaximum && !allocationUnusable && available <= 8 && available / validStep <= 8 && Math.abs(available / validStep - Math.round(available / validStep)) < 1e-8;
  const number = draft.trim() ? Number(draft) : NaN;
  const valid = Number.isFinite(number) && number >= 0 && (!knownMaximum || number <= available) && Math.abs(number / validStep - Math.round(number / validStep)) < 1e-8;
  function choose(value: string) { setDraft(value); setSaved(false); setError(null); dirty.current = value !== (awarded == null ? "" : String(awarded)); onDraft?.(dirty.current); }
  async function save() {
    if (flight.current || !valid) return;
    flight.current = true; setBusy(true); onBusy?.(true); setError(null); setSaved(false);
    try { await onSave(id, number); setSaved(true); dirty.current = false; onDraft?.(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The mark was not saved. Your selection is still here; try again."); }
    finally { flight.current = false; setBusy(false); onBusy?.(false); }
  }
  return <fieldset className="teacher-mark-control" disabled={busy}>
    <legend>Teacher’s mark{knownMaximum ? ` (out of ${numMark(available)})` : " (maximum not read)"}</legend>
    <p>The teacher’s mark is the source. This corrects our transcription.</p>
    {small ? <div className="teacher-mark-options">{Array.from({ length: Math.round(available / validStep) + 1 }, (_, i) => i * validStep).map(value => <label className="teacher-mark-option" key={value}>
      <input type="radio" name={`teacher-mark-${id}`} value={value} checked={draft === String(value)} onChange={() => choose(String(value))} />
      <span>{numMark(value)}</span>
    </label>)}</div> : <div className="teacher-mark-number"><label htmlFor={inputId}>Teacher’s mark{knownMaximum ? ` (out of ${numMark(available)})` : " (maximum not read)"}</label>
      <input id={inputId} type="number" inputMode="decimal" min={0} max={knownMaximum ? available : undefined} step={validStep} value={draft} onChange={event => choose(event.target.value)} aria-describedby={`${inputId}-help`} />
      <p id={`${inputId}-help`}>{knownMaximum ? `Use a number from 0 to ${numMark(available)} in steps of ${numMark(validStep)}.` : `No maximum has been inferred. Copy only the mark visible on your paper, in steps of ${numMark(validStep)}.`}</p>
    </div>}
    <button type="button" className="qact" disabled={busy || !valid || !dirty.current} aria-busy={busy || undefined} onClick={() => void save()}>{busy ? "Saving mark…" : "Save teacher’s mark"}</button>
    {dirty.current && <button type="button" className="qact" disabled={busy} onClick={() => { choose(awarded == null ? "" : String(awarded)); }}>Cancel mark change</button>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Teacher’s mark saved. Check the other readings before confirming this question.</p>}
  </fieldset>;
}
