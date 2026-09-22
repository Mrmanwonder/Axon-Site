import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import PressBox from "./PressBox";

type DraftSummary = { id: string; pages: number };

const DISMISSED_PREFIX = "axon.scan.dismissed-draft-alert.";
const DISMISS_MS = 150;

function dismissedKey(id: string) {
  return DISMISSED_PREFIX + id;
}

function wasDismissed(id: string) {
  try { return sessionStorage.getItem(dismissedKey(id)) === "1"; }
  catch { return false; }
}

function rememberDismissed(id: string) {
  try { sessionStorage.setItem(dismissedKey(id), "1"); }
  catch { /* The draft remains in IndexedDB even if session storage is unavailable. */ }
}

export function DraftsButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count === 0) return null;
  const label = `Open ${count} saved draft${count === 1 ? "" : "s"}`;

  return (
    <PressBox
      as="button"
      type="button"
      className="draftsicon show"
      aria-label={label}
      onClick={onOpen}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5.5h8.5a2 2 0 0 1 2 2V18" />
        <path d="M5.5 8.5h8.5a2 2 0 0 1 2 2v8H7.5a2 2 0 0 1-2-2z" />
      </svg>
      {count > 0 && <span className="badge" aria-hidden="true" />}
    </PressBox>
  );
}

export function DraftAlert({
  draft,
  onResume,
}: {
  draft: DraftSummary;
  onResume: (id: string) => void;
}) {
  const [hidden, setHidden] = useState(() => wasDismissed(draft.id));
  const alertRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const dragRef = useRef({ pointerId: -1, startY: 0, startedAt: 0, offset: 0 });

  useEffect(() => {
    setHidden(wasDismissed(draft.id));
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [draft.id]);

  const resetPosition = useCallback(() => {
    const node = alertRef.current;
    if (!node) return;
    node.classList.remove("is-dragging");
    node.style.removeProperty("--draft-alert-drag");
    node.style.removeProperty("--draft-alert-opacity");
  }, []);

  const dismiss = useCallback(() => {
    rememberDismissed(draft.id);
    const node = alertRef.current;
    if (!node) {
      setHidden(true);
      return;
    }
    node.classList.remove("is-dragging");
    node.classList.add("is-dismissing");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setHidden(true), DISMISS_MS);
  }, [draft.id]);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startedAt: performance.now(),
      offset: 0,
    };
    event.currentTarget.classList.add("is-dragging");
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const offset = Math.max(0, event.clientY - dragRef.current.startY);
    dragRef.current.offset = offset;
    event.currentTarget.style.setProperty("--draft-alert-drag", `${offset}px`);
    event.currentTarget.style.setProperty(
      "--draft-alert-opacity",
      String(Math.max(.28, 1 - offset / 180)),
    );
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const elapsed = Math.max(1, performance.now() - dragRef.current.startedAt);
    const velocity = dragRef.current.offset / elapsed;
    const threshold = Math.max(48, event.currentTarget.offsetHeight * .35);
    dragRef.current.pointerId = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragRef.current.offset >= threshold || velocity >= .45) dismiss();
    else resetPosition();
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.pointerId = -1;
    resetPosition();
  };

  if (hidden) return null;

  return (
    <div
      ref={alertRef}
      className="drafttoast"
      role="status"
      aria-live="polite"
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
    >
      <button type="button" className="dh" aria-label="Hide draft alert" onClick={dismiss} />
      <div className="row2">
        <div className="ic">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 7v5l3.5 2" /><circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <div className="b">
          <div className="t1">Resume draft</div>
          <div className="t2">
            {draft.pages} page{draft.pages === 1 ? "" : "s"} added · stored on this device
          </div>
        </div>
        <PressBox as="button" type="button" className="go" onClick={() => onResume(draft.id)}>
          Resume
        </PressBox>
      </div>
    </div>
  );
}
