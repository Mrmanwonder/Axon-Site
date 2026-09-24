import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

/** The browser owns modal focus, background inertness and the Escape event. */
export default function Dialog({ title, description, busy = false, onClose, children, restoreFocus, className = "" }: {
  title: string; description?: string; busy?: boolean; onClose: () => void; children: ReactNode; restoreFocus?: HTMLElement | null; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = restoreFocus ?? document.activeElement as HTMLElement | null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    (dialog.querySelector("input, button, [tabindex='0']") as HTMLElement | null)?.focus();
    return () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']")];
      if (!controls.length) { event.preventDefault(); return; }
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }}
    aria-busy={busy || undefined} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}
    style={{ padding: 0, margin: 0, width: "100vw", height: "100dvh", maxWidth: "none", maxHeight: "none", background: "transparent", border: 0, color: "inherit" }}>
    <div className={`sheet ${className}`.trim()} style={{ transform: "none" }}>
      <h4 id={titleId}>{title}</h4>
      {description && <div className="body" id={descriptionId}>{description}</div>}
      {children}
    </div>
  </dialog>;
}
