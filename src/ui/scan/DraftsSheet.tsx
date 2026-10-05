/* ═══════════════════════════════════════════════════════════════════════════
   SAVED DRAFTS

   Pages taken but not yet sent, kept on this device. Each draft shows what it
   holds (its first pages, how many, when it was last touched) and offers the
   two things a student wants: open it, or delete it. Opening lands in the page
   grid, where every page can be seen, adjusted, reordered or removed.
   Delete states its consequence in place rather than asking "are you sure".
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import Dialog, { SHEET_EXIT_MS, useDialogDismiss } from "../components/Dialog";
import { hapticTick } from "../lib/haptics";
import type { ScanValue } from "./ScanProvider";

type Draft = ScanValue["drafts"][number];

export function draftWhen(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "";
  const d = new Date(ms);
  const today = new Date(now);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toDateString() === d.toDateString();
  if (sameDay) return `Today, ${time}`;
  if (yesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function DraftsSheet({ drafts, onClose, onOpen, onDelete }: {
  drafts: Draft[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog title="Saved drafts" className="sc-drafts-sheet"
            description={drafts.length ? "Pages you took but have not sent. They stay on this phone." : "Nothing saved. Pages you take but do not send are kept here."}
            onClose={onClose}>
      {drafts.length > 0 && (
        <ul className="sc-draft-list">
          {drafts.map((draft) => <DraftRow key={draft.id} draft={draft} onOpen={onOpen} onDelete={onDelete} />)}
        </ul>
      )}
      {drafts.length === 0 && <DraftsDone fallback={onClose} />}
    </Dialog>
  );
}

function DraftsDone({ fallback }: { fallback: () => void }) {
  const dismiss = useDialogDismiss(fallback);
  return <div className="acts"><button type="button" className="btn primary" onClick={dismiss}>OK</button></div>;
}

function DraftRow({ draft, onOpen, onDelete }: { draft: Draft; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const dismiss = useDialogDismiss();
  const [confirming, setConfirming] = useState(false);
  const urls = useMemo(() => (draft.thumbs ?? []).slice(0, 3).map((blob) => URL.createObjectURL(blob)), [draft.thumbs]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  const pages = `${draft.pages} page${draft.pages === 1 ? "" : "s"}`;
  const when = draftWhen(draft.updatedAt);

  return (
    <li className="sc-draft" data-confirming={confirming ? "true" : undefined}>
      <button type="button" className="sc-draft-open" aria-label={`Open draft, ${pages}${when ? `, ${when}` : ""}`}
              onClick={() => { hapticTick(); dismiss(); window.setTimeout(() => onOpen(draft.id), SHEET_EXIT_MS); }}>
        <span className="sc-draft-pile" aria-hidden="true">
          {urls.length
            ? urls.map((url, i) => <img key={url} src={url} alt="" style={{ zIndex: 3 - i }} data-i={i} />)
            : <span className="blank" />}
        </span>
        <span className="sc-draft-txt">
          <b>{pages}</b>
          <small>{[draft.title, when].filter(Boolean).join(" · ")}</small>
        </span>
      </button>
      {confirming ? (
        <div className="sc-draft-confirm">
          <button type="button" className="btn danger-soft" onClick={() => { hapticTick(); onDelete(draft.id); }}>
            Delete {pages} from this phone
          </button>
          <button type="button" className="btn plain" onClick={() => setConfirming(false)}>Keep</button>
        </div>
      ) : (
        <button type="button" className="sc-draft-del" aria-label={`Delete draft, ${pages}`}
                onClick={() => { hapticTick(); setConfirming(true); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
          </svg>
        </button>
      )}
    </li>
  );
}
