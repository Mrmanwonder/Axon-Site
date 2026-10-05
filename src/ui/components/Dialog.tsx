import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

/* Sheets rise from the bottom edge and fall back to it, on the iOS sheet curve:
   no overshoot, a long soft landing (transform and opacity only, 440 ms in,
   300 ms out; nothing under reduced motion). The timings live in system.css
   (`--sheet-in`, `--sheet-out`); EXIT_MS must match `--sheet-out`. The browser still
   owns modal focus, background inertness and the Escape event. Anything inside
   the sheet that closes it should call `useDialogDismiss()` so it leaves the
   same way it arrived instead of vanishing. */

export const SHEET_EXIT_MS = 300;
const EXIT_MS = SHEET_EXIT_MS;
const reducedMotion = () => document.documentElement.dataset.motion === "reduce"
  || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

const DismissCtx = createContext<(() => void) | null>(null);

/** Close the enclosing sheet with its exit motion. Falls back to `fallback` outside a Dialog. */
export function useDialogDismiss(fallback?: () => void): () => void {
  const dismiss = useContext(DismissCtx);
  return dismiss ?? fallback ?? (() => {});
}

export default function Dialog({ title, description, busy = false, onClose, children, restoreFocus, className = "" }: {
  title: string; description?: string; busy?: boolean; onClose: () => void; children: ReactNode; restoreFocus?: HTMLElement | null; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const timer = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current !== null) return;
    if (reducedMotion()) { closeRef.current(); return; }
    setClosing(true);
    timer.current = window.setTimeout(() => { timer.current = null; closeRef.current(); }, EXIT_MS);
  }, []);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  useEffect(() => {
    const dialog = ref.current!;
    const trigger = restoreFocus ?? document.activeElement as HTMLElement | null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    // Focus a text field if the sheet asks for one, otherwise the sheet itself:
    // focusing the first button made Safari draw a keyboard focus ring on it.
    // preventScroll matters: the sheet starts below the fold while it rises,
    // and Safari scrolled the dialog to reveal the focused control, which left
    // the sheet stranded mid-screen once it landed.
    const field = dialog.querySelector<HTMLElement>("input:not([type=hidden]), textarea");
    (field ?? dialog.querySelector<HTMLElement>(".sheet"))?.focus({ preventScroll: true });
    return () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    className={closing ? "is-closing" : undefined}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']")];
      if (!controls.length) { event.preventDefault(); return; }
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }}
    aria-busy={busy || undefined} onCancel={event => { event.preventDefault(); if (!busy) dismiss(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) dismiss(); }}
    style={{ padding: 0, margin: 0, width: "100vw", height: "100dvh", maxWidth: "none", maxHeight: "none", overflow: "hidden", background: "transparent", border: 0, color: "inherit" }}>
    <DismissCtx.Provider value={dismiss}>
      <div className={`sheet ${className}`.trim()} style={{ transform: "none" }} tabIndex={-1}>
        <h4 id={titleId}>{title}</h4>
        {description && <div className="body" id={descriptionId}>{description}</div>}
        {children}
      </div>
    </DismissCtx.Provider>
  </dialog>;
}
