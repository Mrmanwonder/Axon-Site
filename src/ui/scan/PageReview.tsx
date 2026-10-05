/* ═══════════════════════════════════════════════════════════════════════════
   PAGE REVIEW

   Opened from the stack, or by Review when any page needs a look. Pages that
   need a look come first, each with one honest reason; clear pages stay quiet.
   Retake is the main action. "Read as it is" accepts every flagged page exactly
   as captured: the student is allowed to say the photo is fine.

   Adjust edges starts from the page the detector saw (when it saw one) and
   lets the student drag the four corners. The corrected corners are applied to
   the original photograph, never to a re-saved copy.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import Dialog, { SHEET_EXIT_MS, useDialogDismiss } from "../components/Dialog";
import { hapticTick, hapticFirm } from "../lib/haptics";
import { needsLook } from "./PaperStack";
import { useScan } from "./ScanProvider";
import type { TrayPage } from "./ScanProvider";

type Point = { x: number; y: number };
type Corners = { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point };

const toCorners = (q: Point[]): Corners => ({
  topLeft: q[0], topRight: q[1], bottomRight: q[2], bottomLeft: q[3],
});
const toQuad = (c: Corners): Point[] => [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft];

export default function PageReview({ onClose }: { onClose: () => void }) {
  const { tray, trayHandlers, submitting } = useScan();
  const [adjusting, setAdjusting] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  // Pages stay in paper order: the grid is the paper, not a to-do list.
  const pages = useMemo(() => tray.filter((p) => !p.pending || p.thumb), [tray]);
  const flagged = pages.filter(needsLook);

  if (adjusting !== null) {
    return (
      <EdgeEditor
        pageNumber={adjusting}
        sourceOf={trayHandlers.onAdjustSource}
        apply={async (quad) => { await trayHandlers.onAdjustApply?.(adjusting, quad); }}
        onDone={() => { setAdjusting(null); }}
        onClose={() => setAdjusting(null)}
      />
    );
  }

  const current = open !== null ? pages.find((p) => p.page_number === open) ?? null : null;
  if (current) {
    return (
      <PageDetail page={current} count={pages.length} busy={submitting}
        onBack={() => setOpen(null)}
        onAdjust={() => { hapticTick(); setAdjusting(current.page_number); setOpen(null); }}
        onRetake={() => { trayHandlers.onRetake?.(current.page_number); onClose(); }}
        onKeep={async () => { await trayHandlers.onKeep?.(current.page_number); setOpen(null); }}
        onMove={async (to) => { await trayHandlers.onMove?.(current.page_number, to); setOpen(to); }}
        onRemove={async () => {
          await trayHandlers.onRemove?.(current.page_number);
          setOpen(null);
          if (pages.length <= 1) onClose();
        }} />
    );
  }

  const title = `${pages.length} page${pages.length === 1 ? "" : "s"}`;
  // One line, only when something needs the student. Notes live on the page.
  const body = flagged.length
    ? `${flagged.length === 1 ? `Page ${flagged[0].page_number} needs` : `${flagged.length} pages need`} a look. Tap a page to fix it.`
    : undefined;

  return (
    <Dialog title={title} description={body} busy={submitting} onClose={onClose} className="sc-review">
      <ul className="sc-grid" aria-label="Pages">
        {pages.map((page) => (
          <li key={page.page_number}>
            <button type="button" className="sc-tile" data-flagged={needsLook(page) ? "true" : undefined}
                    disabled={submitting || page.pending}
                    aria-label={`Page ${page.page_number}${needsLook(page) ? ", needs a look" : ""}`}
                    onClick={() => { hapticTick(); setOpen(page.page_number); }}>
              <span className="th">{page.thumb && <img src={page.thumb} alt="" />}</span>
              <span className="n">{page.page_number}</span>
              {needsLook(page) && <span className="look">Needs a look</span>}
            </button>
          </li>
        ))}
      </ul>
      <ReviewActions pages={pages.length} flagged={flagged.length} busy={submitting}
        onRead={async () => {
          if (flagged.length) await trayHandlers.onKeepAll?.();
          trayHandlers.onDone?.();
        }}
        fallback={onClose} />
    </Dialog>
  );
}

/** Read leaves with the sheet's own exit, then sending starts behind it. */
function ReviewActions({ pages, flagged, busy, onRead, fallback }: {
  pages: number; flagged: number; busy: boolean; onRead: () => Promise<void> | void; fallback: () => void;
}) {
  const dismiss = useDialogDismiss(fallback);
  const label = flagged ? "Read as it is" : `Read ${pages === 1 ? "this page" : `these ${pages} pages`}`;
  return (
    <div className="acts sc-review-acts">
      <button type="button" className="btn primary" disabled={busy || pages === 0}
              onClick={() => { hapticFirm(); dismiss(); window.setTimeout(() => { void onRead(); }, SHEET_EXIT_MS); }}>
        {label}
      </button>
      <button type="button" className="btn plain" onClick={dismiss}>Keep scanning</button>
    </div>
  );
}

/** One page, large, with everything that can be done to it. */
function PageDetail({ page, count, busy, onBack, onAdjust, onRetake, onKeep, onMove, onRemove }: {
  page: TrayPage; count: number; busy: boolean;
  onBack: () => void; onAdjust: () => void; onRetake: () => void; onKeep: () => Promise<void>;
  onMove: (to: number) => Promise<void>; onRemove: () => Promise<void>;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [working, setWorking] = useState(false);
  const look = needsLook(page);
  const why = page.retakeRequested && !page.flag ? "Waiting for the new photo" : look ? page.flag?.reason : page.note;
  const run = async (fn: () => Promise<void>) => {
    if (working) return;
    setWorking(true);
    try { await fn(); } finally { setWorking(false); }
  };
  const off = busy || working;
  return (
    <Dialog title={`Page ${page.page_number}`} description={why ?? undefined} busy={off} onClose={onBack} className="sc-review sc-page">
      <div className="sc-page-img" data-flagged={look ? "true" : undefined}>
        {page.thumb && <img src={page.thumb} alt={`Page ${page.page_number}`} />}
      </div>
      <div className="sc-page-acts">
        {page.canAdjust && (
          <button type="button" className="btn ghost" disabled={off} onClick={onAdjust}>Adjust edges</button>
        )}
        <button type="button" className="btn ghost" disabled={off} onClick={() => { hapticTick(); onRetake(); }}>Retake</button>
        {look && page.flag?.kind === "quality" && (
          <button type="button" className="btn ghost" disabled={off} onClick={() => void run(onKeep)}>Keep as it is</button>
        )}
      </div>
      {count > 1 && (
        <div className="sc-page-move" role="group" aria-label="Order">
          <button type="button" className="btn plain" disabled={off || page.page_number <= 1}
                  onClick={() => void run(() => onMove(page.page_number - 1))}>Move earlier</button>
          <button type="button" className="btn plain" disabled={off || page.page_number >= count}
                  onClick={() => void run(() => onMove(page.page_number + 1))}>Move later</button>
        </div>
      )}
      <div className="acts">
        {confirmRemove ? (
          <>
            <button type="button" className="btn danger-soft" disabled={off} onClick={() => void run(onRemove)}>
              Remove page {page.page_number}. The pages after it move up.
            </button>
            <button type="button" className="btn plain" disabled={off} onClick={() => setConfirmRemove(false)}>Keep it</button>
          </>
        ) : (
          <>
            <button type="button" className="btn primary" disabled={off} onClick={onBack}>Back to all pages</button>
            <button type="button" className="btn plain sc-remove" disabled={off} onClick={() => setConfirmRemove(true)}>Remove this page</button>
          </>
        )}
      </div>
    </Dialog>
  );
}

function EdgeEditor({ pageNumber, sourceOf, apply, onDone, onClose }: {
  pageNumber: number;
  sourceOf?: (n: number) => { blob: Blob; quad: Point[] | null } | null;
  apply: (quad: Point[]) => Promise<void>;
  onDone: () => void;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<{ confirm: () => unknown; reset: () => void; destroy: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = useRef(false);
  // Read once per opened page: the editor must not be rebuilt (and its photo
  // reloaded) every time the tray behind it repaints.
  const [source] = useState(() => sourceOf?.(pageNumber) ?? null);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let copyUrl: string | null = null;
    const url = URL.createObjectURL(source.blob);
    const image = new Image();
    image.onload = async () => {
      if (cancelled || !host.current) return;
      try {
        const { createCornerEditor } = await import("scanic");
        if (cancelled || !host.current) return;
        const w = image.naturalWidth, h = image.naturalHeight;
        // The editor and its magnifier work in the pixels of the image they are
        // given, and scanic's magnifier never zooms below 1.1x of those. Handed
        // a 12 MP photo shown at phone width, it magnified the corner about
        // twenty times on screen: sensor noise, not a page corner (owner's
        // phone, 4 Oct 2026). So the editor gets a copy at the screen's own
        // resolution, and corners are scaled back to the photo on the way out.
        const scale = editScale(host.current, w, h);
        const shown = scale < 1 ? await scaledCopy(image, scale) : image;
        if (shown instanceof HTMLImageElement && shown !== image) copyUrl = shown.src;
        if (cancelled || !host.current) return;
        const inset = (f: number) => [
          { x: w * f, y: h * f }, { x: w * (1 - f), y: h * f },
          { x: w * (1 - f), y: h * (1 - f) }, { x: w * f, y: h * (1 - f) },
        ];
        const toShown = (q: Point[]) => q.map((p) => ({ x: p.x * scale, y: p.y * scale }));
        const toPhoto = (q: Point[]) => q.map((p) => ({ x: p.x / scale, y: p.y / scale }));
        editor.current = createCornerEditor({
          container: host.current,
          image: shown,
          corners: toCorners(toShown(source.quad ?? inset(0.08))),
          toolbar: { enabled: false },
          nudges: { enabled: false },
          theme: { accent: "#3A86FF", handleSize: 22 },
          magnifier: { size: 120, zoom: 2.5 },
          onConfirm: async (corners: Corners) => {
            if (confirmed.current) return;
            confirmed.current = true;
            setWorking(true); setError(null);
            try {
              await apply(toPhoto(toQuad(corners)));
              onDone(); onClose();
            } catch (cause) {
              confirmed.current = false;
              setError(cause instanceof Error ? cause.message : "Those edges could not be applied.");
            } finally { setWorking(false); }
          },
          onCancel: () => onDone(),
        });
        setReady(true);
      } catch {
        setError("The edge editor could not start. Retake the page instead.");
      }
    };
    image.onerror = () => setError("The original photo could not be opened. Retake the page instead.");
    image.src = url;
    return () => {
      cancelled = true;
      editor.current?.destroy();
      editor.current = null;
      URL.revokeObjectURL(url);
      if (copyUrl) URL.revokeObjectURL(copyUrl);
    };
    // The editor is created once per opened page; callbacks close over refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <Dialog title={`Page ${pageNumber} edges`} description="Drag each corner to the corner of the page."
            busy={working} onClose={onDone} className="sc-edge">
      {source ? <div className="sc-edge-host" ref={host} /> : (
        <p role="alert">The original photo is no longer on this device. Retake the page instead.</p>
      )}
      {error && <p role="alert" className="sc-edge-error">{error}</p>}
      <div className="acts sc-edge-acts">
        <button type="button" className="btn primary" disabled={!ready || working}
                aria-busy={working || undefined}
                onClick={() => { hapticFirm(); editor.current?.confirm(); }}>
          {working ? "Applying…" : "Use these edges"}
        </button>
        <button type="button" className="btn plain" disabled={!ready || working}
                onClick={() => editor.current?.reset()}>Reset</button>
        <button type="button" className="btn plain" disabled={working} onClick={onDone}>Back</button>
      </div>
    </Dialog>
  );
}

/** Scale (at most 1) that brings the photo to the editor box at device resolution. */
export function editScale(host: HTMLElement | null, width: number, height: number): number {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
  const boxW = (host?.clientWidth || 360) * dpr, boxH = (host?.clientHeight || 480) * dpr;
  return Math.min(1, Math.max(boxW / width, boxH / height));
}

async function scaledCopy(image: HTMLImageElement, scale: number): Promise<HTMLImageElement | HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return canvas;
  const copy = new Image();
  copy.src = URL.createObjectURL(blob);
  await copy.decode().catch(() => undefined);
  return copy;
}

/** Leaves the sheet with its exit motion. */
