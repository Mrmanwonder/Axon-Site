import { useEffect, useRef, useState } from "react";
import { paperDifficultyFeedback, savePaperDifficultyFeedback } from "../data/modules";
import Chevron from "./Chevron";
import Dialog from "./Dialog";
import PaperDifficultyOrb, { DIFFICULTY_WORDS } from "./PaperDifficultyOrb";
import "../styles/paper-difficulty.css";

type Response = { rating: number | null; skipped: boolean } | null;
type Load = "loading" | "ready" | "error";

/** AXO-302: a row on every paper that opens the orb sheet. Always optional and
 * never prompts by itself. An existing answer is read first; a failed or offline
 * read is reported, never shown as "no answer". */
export default function PaperDifficultyPrompt({ paperId, studentId, ready }: {
  paperId: string; studentId: string; ready: boolean;
}) {
  const [answer, setAnswer] = useState<Response>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const generation = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const version = ++generation.current;
    setOpen(false); setSaved(false); setAnswer(null); setLoad("loading");
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

  const rating = answer?.rating ?? null;

  async function save(value: number) {
    const version = generation.current;
    await savePaperDifficultyFeedback({ paperId, studentId, rating: value, skipped: false });
    // A save that lands after the student moved to another paper belongs to the
    // paper it was made on, not to this one.
    if (generation.current !== version) return;
    setAnswer({ rating: value, skipped: false });
    setSaved(true);
  }

  return <>
    <div className="list pd-entry">
      <button ref={trigger} type="button" className="srow noicon pd-row" aria-haspopup="dialog"
        onClick={() => { setSaved(false); setOpen(true); }}>
        <span className="lbl">
          {rating ? "How hard it felt" : "How hard was this paper?"}
          <small>{rating ? "Only for you. Tap to change." : "Only for you. Your teacher’s marks stay as they are."}</small>
        </span>
        {rating && <span className="aux">{DIFFICULTY_WORDS[rating - 1]}</span>}
        <Chevron />
      </button>
    </div>
    {open && <Dialog className="pd-sheet" restoreFocus={trigger.current}
      title={saved ? "Saved" : "How was the paper?"}
      description={saved ? "Thanks. This stays between you and Axon." : "Only for you. Your teacher’s marks stay as they are."}
      onClose={() => setOpen(false)}>
      <PaperDifficultyOrb initial={rating} saved={saved} onSave={save} />
    </Dialog>}
  </>;
}
