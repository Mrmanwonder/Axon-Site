import { useEffect, useRef, useState } from "react";
import { paperDifficultyFeedback, savePaperDifficultyFeedback } from "../data/modules";
import { useToast } from "./ToastProvider";
import "../styles/paper-difficulty.css";

const CHOICES = [
  { value: 1, label: "Very easy" },
  { value: 2, label: "Easy" },
  { value: 3, label: "About right" },
  { value: 4, label: "Hard" },
  { value: 5, label: "Very hard" },
] as const;

type Response = { rating: number | null; skipped: boolean } | null;
type Load = "loading" | "ready" | "error";

/** Always optional, never blocks the saving/analysis flow. An existing answer
 * is read before asking; failure or offline status never masquerades as no response. */
export default function PaperDifficultyPrompt({ paperId, studentId, ready }: {
  paperId: string; studentId: string; ready: boolean;
}) {
  const [answer, setAnswer] = useState<Response>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const generation = useRef(0);
  const flight = useRef(false);

  useEffect(() => {
    const version = ++generation.current;
    flight.current = false; setBusy(false); setEditing(false); setAnswer(null); setLoad("loading");
    if (!ready) return;
    let cancelled = false;
    paperDifficultyFeedback(studentId, paperId)
      .then((value) => {
        if (cancelled || generation.current !== version) return;
        setAnswer(value);
        setLoad("ready");
      })
      .catch(() => { if (!cancelled && generation.current === version) setLoad("error"); });
    return () => { cancelled = true; generation.current++; };
  }, [ready, paperId, studentId]);

  if (!ready || load === "loading") return null;
  if (load === "error") return (
    <div className="pd-inline" role="status">
      <span>Difficulty feedback is unavailable right now. Your paper is unchanged.</span>
      <button type="button" className="pd-inline-action" onClick={() => {
        const version = generation.current;
        setLoad("loading");
        paperDifficultyFeedback(studentId, paperId).then((a) => {
          if (generation.current !== version) return;
          setAnswer(a);
          setLoad("ready");
        }).catch(() => { if (generation.current === version) setLoad("error"); });
      }}>Retry</button>
    </div>
  );
  if (answer?.skipped) return null;
  if (answer?.rating && !editing) return (
    <div className="pd-inline">
      <span>How this paper felt: <strong>{CHOICES[answer.rating - 1]?.label ?? "Recorded"}</strong></span>
      <button type="button" className="pd-inline-action" onClick={() => setEditing(true)}>Edit</button>
    </div>
  );

  async function choose(rating: number | null) {
    if (flight.current) return;
    const version = generation.current; flight.current = true;
    setBusy(true);
    try {
      await savePaperDifficultyFeedback({ paperId, studentId, rating, skipped: rating === null });
      if (generation.current !== version) return;
      setAnswer({ rating, skipped: rating === null });
      setEditing(false);
      if (rating !== null) toast("How it felt is saved.");
    } catch {
      if (generation.current === version) toast("Couldn't save that response. Try again when you're connected.", "warn");
    } finally {
      if (generation.current === version) { flight.current = false; setBusy(false); }
    }
  }

  return (
    <section className="pd-prompt" aria-labelledby="pd-title">
      <div className="pd-caption">ONE QUICK QUESTION</div>
      <h2 id="pd-title">How difficult did this paper feel?</h2>
      <p>Just how it felt to you. Your teacher's marks stay exactly as they are.</p>
      <div className="pd-options" role="group" aria-label="How difficult the paper felt">
        {CHOICES.map(({ value, label }) => (
          <button key={value} type="button" disabled={busy}
            className={"pd-option" + (answer?.rating === value ? " chosen" : "")}
            aria-pressed={answer?.rating === value} onClick={() => void choose(value)}>
            <span className="pd-dot" aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <button type="button" className="pd-skip" disabled={busy}
        onClick={() => editing ? setEditing(false) : void choose(null)}>
        {editing ? "Cancel" : "Not now"}
      </button>
    </section>
  );
}
