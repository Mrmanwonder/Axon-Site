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
import Dialog from "../components/Dialog";
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
  const [busy, setBusy] = useState(false);

  const pages = useMemo(() => {
    const real = tray.filter((p) => !p.pending || p.thumb);
    return [...real.filter(needsLook), ...real.filter((p) => !needsLook(p))];
  }, [tray]);
  const flagged = pages.filter(needsLook);
  const clear = pages.length - flagged.length;
  const first = flagged[0];

  if (adjusting !== null) {
    return (
      <EdgeEditor
        pageNumber={adjusting}
        sourceOf={trayHandlers.onAdjustSource}
        apply={async (quad) => { await trayHandlers.onAdjustApply?.(adjusting, quad); }}
        onDone={() => { setAdjusting(null); }}
        onClose={onClose}
      />
    );
  }

  const act = async (fn: () => void | Promise<void>, close = true) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (close) onClose(); } finally { setBusy(false); }
  };

  const title = flagged.length
    ? `${flagged.length} page${flagged.length === 1 ? "" : "s"} ${flagged.length === 1 ? "needs" : "need"} a look`
    : `${pages.length} page${pages.length === 1 ? "" : "s"}`;
  const body = flagged.length
    ? (clear ? `The other ${clear} ${clear === 1 ? "is" : "are"} clear.` : undefined)
    : "Every page looks clear.";

  return (
    <Dialog title={title} description={body} busy={busy || submitting} onClose={onClose} className="sc-review">
      <div className="sc-review-grid">
        {pages.map((page) => (
          <ReviewCard key={page.page_number} page={page} disabled={busy || submitting}
            onRetake={() => act(() => trayHandlers.onRetake?.(page.page_number))}
            onAdjust={() => { hapticTick(); setAdjusting(page.page_number); }}
            onOptions={() => act(() => trayHandlers.onPage?.(page.page_number))} />
        ))}
      </div>
      <div className="acts sc-review-acts">
        {first ? (
          <>
            <button type="button" className="btn primary" disabled={busy || submitting}
                    onClick={() => { hapticFirm(); void act(() => trayHandlers.onRetake?.(first.page_number)); }}>
              Retake page {first.page_number}
            </button>
            <button type="button" className="btn plain" disabled={busy || submitting}
                    onClick={() => void act(async () => {
                      await trayHandlers.onKeepAll?.();
                      trayHandlers.onDone?.();
                    })}>
              Read as it is
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn primary" disabled={busy || submitting}
                    onClick={() => void act(() => trayHandlers.onDone?.())}>
              Done · {pages.length}
            </button>
            <button type="button" className="btn plain" onClick={onClose}>Keep scanning</button>
          </>
        )}
      </div>
    </Dialog>
  );
}

function ReviewCard({ page, disabled, onRetake, onAdjust, onOptions }: {
  page: TrayPage; disabled: boolean; onRetake: () => void; onAdjust: () => void; onOptions: () => void;
}) {
  const look = needsLook(page);
  const why = page.retakeRequested && !page.flag ? "Waiting for the new photo" : page.flag?.reason;
  return (
    <div className="sc-pg" data-flagged={look ? "true" : undefined}>
      <div className="th">{page.thumb && <img src={page.thumb} alt={`Page ${page.page_number}`} />}</div>
      <b>Page {page.page_number}</b>
      <span className="why">{look ? why : (page.note ?? "Clear")}</span>
      <div className="pgacts">
        <button type="button" disabled={disabled} onClick={onRetake}>Retake</button>
        {page.flag?.kind === "edges" && page.canAdjust && (
          <button type="button" disabled={disabled} onClick={onAdjust}>Adjust edges</button>
        )}
        {!look && <button type="button" disabled={disabled} onClick={onOptions}>Options</button>}
      </div>
    </div>
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
