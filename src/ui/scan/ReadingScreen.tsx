/* ═══════════════════════════════════════════════════════════════════════════
   THE READING SCREEN

   One paper between the phone and review: its own pages, which of them are
   safely sent, the step Axon is on, and a way out that is always there. The
   scanner shows it the moment Read is pressed (with Continue scanning), and the
   Library shows the same screen for a paper that is still on its way (owner,
   6 Oct 2026). Nothing here is a spinner or a skeleton.
   ═══════════════════════════════════════════════════════════════════════════ */

import PressBox from "../components/PressBox";
import "../styles/reading.css";

export type ReadingPage = { n: number; thumb: string | null; sent: boolean };
export type ReadingStep = { label: string; state: "done" | "now" | "wait" };

export type ReadingModel = {
  heading: string;
  now: string;
  /** attention: waiting on a connection, or something the student can act on. */
  tone?: "neutral" | "attention";
  pages?: ReadingPage[];
  steps: ReadingStep[];
  note?: string | null;
};

export type ReadingAction = { label: string; run: () => void; primary?: boolean };

/** Phase of a background send, as the student reads it. */
export type SendJob = {
  id: string;
  paperId: string | null;
  runId: string | null;
  title: string | null;
  phase: "sending" | "waiting" | "reading" | "review" | "refused" | "stuck";
  stage: string;
  message: string;
  pages: ReadingPage[];
  steps: ReadingStep[];
};

export function modelForSend(job: SendJob): ReadingModel {
  switch (job.phase) {
    case "review":
      return { heading: "Your paper is read", now: "Check what Axon read, then save it.", pages: job.pages, steps: job.steps };
    case "refused":
      return {
        heading: "This one was not read", now: job.message, tone: "attention", pages: job.pages, steps: [],
        note: "The pages are kept. If this is a marked paper, open it in the Library to read it again.",
      };
    case "stuck":
      return { heading: "This paper is waiting", now: job.message, tone: "attention", pages: job.pages, steps: job.steps };
    case "waiting":
      return {
        heading: "Sending your paper", now: job.message, tone: "attention", pages: job.pages, steps: job.steps,
        note: "Every page already sent stays sent. Nothing is sent twice.",
      };
    case "reading":
      return { heading: "Reading your paper", now: job.message, pages: job.pages, steps: job.steps };
    default:
      return { heading: "Sending your paper", now: job.message, pages: job.pages, steps: job.steps };
  }
}

export default function ReadingScreen({
  model, variant, onClose, closeLabel = "Close", actions = [], footnote,
}: {
  model: ReadingModel;
  variant: "overlay" | "page";
  onClose?: () => void;
  closeLabel?: string;
  actions?: ReadingAction[];
  footnote?: string | null;
}) {
  const pages = model.pages ?? [];
  const sent = pages.filter((p) => p.sent).length;
  return (
    <div className={`sc-reading is-${variant}`} role="region" aria-label={model.heading}>
      {onClose && (
        <div className="sc-reading-top">
          <PressBox as="button" type="button" className="sc-circ sc-close" aria-label={closeLabel} onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
          </PressBox>
        </div>
      )}
      <h1 className="sc-reading-h">{model.heading}</h1>
      <p className="sc-reading-now" data-tone={model.tone === "attention" ? "attention" : undefined} aria-live="polite">
        {model.now}
      </p>
      {pages.length > 0 && (
        <>
          {!/safely sent/.test(model.now) && <p className="sc-reading-sub">
            {sent === pages.length
              ? `${pages.length} ${pages.length === 1 ? "page" : "pages"} safely sent`
              : `${sent} of ${pages.length} pages safely sent`}
          </p>}
          <ol className="sc-reading-pages" aria-label="Pages">
            {pages.map((p) => (
              <li key={p.n} data-sent={p.sent ? "true" : undefined}
                  aria-label={`Page ${p.n}, ${p.sent ? "sent" : "not sent yet"}`}>
                <span className="th">{p.thumb ? <img src={p.thumb} alt="" loading="lazy" /> : <span className="blank" />}</span>
                <span className="n">{p.sent ? (
                  <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 4.5 9 10 3.5" /></svg>
                ) : p.n}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {model.steps.length > 0 && (
        <ol className="sc-reading-steps">
          {model.steps.map((st, i) => (
            <li key={i} className={"pline" + (st.state === "now" ? " now" : "")}>
              <span className={"st " + st.state}>
                {st.state === "done" && (
                  <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 4.5 9 10 3.5" /></svg>
                )}
              </span>
              <span className="lb">{st.label}</span>
            </li>
          ))}
        </ol>
      )}
      {model.note && <p className="sc-reading-sub">{model.note}</p>}
      {(actions.length > 0 || footnote) && (
        <div className="sc-reading-acts">
          {actions.map((a) => (
            <button key={a.label} type="button" className={"btn " + (a.primary ? "primary" : "ghost")} onClick={a.run}>
              {a.label}
            </button>
          ))}
          {footnote && <p className="sc-reading-sub">{footnote}</p>}
        </div>
      )}
    </div>
  );
}
