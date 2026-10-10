import { useEffect, useId, useRef, useState } from "react";
import { isCalendarDate } from "../../paperDate.js";
import { setPaperExamDate } from "../data/modules";

/** The student's correction is saved directly; no model confirmation is needed. */
export default function PaperDateEditor({ paperId, examDate, onSaved }: {
  paperId: string; examDate?: string | null; onSaved: (date: string | null) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(examDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const flight = useRef(false);
  useEffect(() => { setValue(examDate ?? ""); }, [examDate]);
  const submit = async () => {
    if (flight.current || value === (examDate ?? "")) return;
    if (value && !isCalendarDate(value)) { setError("Choose a valid exam date."); return; }
    flight.current = true; setBusy(true); setError(null); setSaved(false);
    try {
      await setPaperExamDate(paperId, value || null);
      onSaved(value || null);
      setSaved(true);
    } catch {
      setError("The exam date couldn't be saved. Check your connection and try again.");
    } finally {
      flight.current = false; setBusy(false);
    }
  };
  return <form className="po-subject po-date" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <label className="k" htmlFor={id}>Exam date</label>
    <input id={id} type="date" min="0001-01-01" max="9999-12-31" value={value} disabled={busy}
      aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
      onChange={event => { setValue(event.target.value); setError(null); setSaved(false); }} />
    {value && <button className="btn plain" type="button" disabled={busy}
      onClick={() => { setValue(""); setError(null); setSaved(false); }}>Clear date</button>}
    {value !== (examDate ?? "") && <button className="btn ghost" type="submit" disabled={busy} aria-busy={busy}>
      {busy ? "Saving…" : "Save date"}
    </button>}
    <span id={`${id}-hint`} className="hint">Optional. Leave it blank to show when the paper was added.</span>
    {error && <span id={`${id}-error`} className="hint" role="alert">{error}</span>}
    {saved && <span className="hint" role="status">{value ? "Exam date saved." : "Exam date cleared. Showing the added date."}</span>}
  </form>;
}
