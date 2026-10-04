/* ═══════════════════════════════════════════════════════════════════════════
   THE IMPORT SCREEN (laptops and desktops)

   A laptop webcam looks at the student, not at a paper on the desk, so there is
   no viewfinder here. This screen is for what a laptop can really do: take
   photos the student already has (drag, drop, choose, paste), take a link, or
   hand over to the phone, which is the better scanner.

   Images only today. A PDF is not turned into pages yet, and the screen says so
   instead of accepting a file it would then fail on.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import PressBox from "../components/PressBox";
import { useToast } from "../components/ToastProvider";
import { useIngestion } from "../data/useIngestion";
import { useScan } from "./ScanProvider";
import { DoneButton, needsLook } from "./PaperStack";
import { paths } from "../app/paths";
import { hapticTick } from "../lib/haptics";

function PhoneQr({ url }: { url: string }) {
  const { path, size } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
    return { path: d, size: n + quiet * 2 };
  }, [url]);
  return (
    <svg className="sc-qr" viewBox={`0 0 ${size} ${size}`} role="img"
         aria-label="QR code that opens the Scan page of this site on your phone"
         shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
}

export default function ImportDesk({ onReview }: { onReview: () => void }) {
  const toast = useToast();
  const { addPaper, addLink, ingestFiles } = useIngestion();
  const { tray, trayHandlers, drafts, draftsHandlers, submitting } = useScan();
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const phoneUrl = `${location.origin}${paths.scan}`;

  const take = (files: File[]) => {
    if (!files.length) return;
    const images = files.filter((f) => /^image\//.test(f.type));
    if (images.length < files.length) {
      toast("Only photos can be added for now. Save each page as an image, or add a link.", "warn");
    }
    if (images.length) void ingestFiles(images);
  };

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      const files = [...(event.clipboardData?.files ?? [])];
      if (!files.length) return;
      event.preventDefault();
      take(files);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
    // `take` only reads stable callbacks from the providers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestFiles]);

  const flagged = tray.filter(needsLook).length;

  return (
    <div className="sc-desk">
      <h1>Add a paper</h1>
      <p className="sc-desk-sub">
        Scanning works best on a phone. Add photos you already have, or carry on from your phone.
      </p>

      <div className="sc-desk-cols">
        <div
          className="sc-drop"
          data-over={over ? "true" : undefined}
          onDragEnter={(e) => { e.preventDefault(); depth.current++; setOver(true); }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
          onDrop={(e) => {
            e.preventDefault(); depth.current = 0; setOver(false);
            take([...e.dataTransfer.files]);
          }}
        >
          <div className="sc-pile" aria-hidden="true"><b /><b /><b /></div>
          <h2>{over ? "Let go to add these pages" : "Drop photos here"}</h2>
          <p>One page per photo works best.</p>
          <PressBox as="button" type="button" className="sc-btn" disabled={submitting}
                    onClick={addPaper}>Choose files</PressBox>
          <p className="sc-fine">Photos only · you can also paste an image</p>
        </div>

        <div className="sc-desk-side">
          {tray.length > 0 && (
            <section className="sc-card" aria-label="This paper">
              <h3>This paper</h3>
              <div className="sc-thumbs">
                {tray.map((p) => (
                  <button type="button" key={p.page_number} className="sc-thumb"
                          data-flagged={needsLook(p) ? "true" : undefined}
                          aria-label={`Page ${p.page_number}${needsLook(p) ? ", needs a look" : ""}`}
                          onClick={onReview}>
                    {p.thumb && <img src={p.thumb} alt="" />}
                    <span>{p.page_number}</span>
                  </button>
                ))}
              </div>
              <div className="sc-card-row">
                <span>{tray.length} page{tray.length === 1 ? "" : "s"}
                  {flagged ? ` · ${flagged} ${flagged === 1 ? "needs" : "need"} a look` : ""}</span>
                <DoneButton pages={tray} busy={submitting}
                            onDone={() => { trayHandlers.onDone?.(); }} onReview={onReview} />
              </div>
            </section>
          )}

          <section className="sc-card">
            <div className="sc-phone">
              <PhoneQr url={phoneUrl} />
              <div>
                <h3>Scan with your phone</h3>
                <p>Open Axon on your phone, sign in, and tap Scan. Your papers appear in this account.</p>
              </div>
            </div>
          </section>

          <section className="sc-card">
            <h3>Add a link</h3>
            <p>A paper shared as a link, or a hosted PDF.</p>
            <PressBox as="button" type="button" className="sc-btn ghost" onClick={addLink}>Add a link</PressBox>
          </section>

          {drafts.length > 0 && (
            <section className="sc-card">
              <h3>Saved drafts</h3>
              <p>Stored on this device until you send them.</p>
              <ul className="sc-drafts">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <span>{d.title} · {d.pages} page{d.pages === 1 ? "" : "s"}</span>
                    <button type="button" disabled={submitting}
                            onClick={() => { hapticTick(); draftsHandlers.onResume?.(d.id); }}>Resume</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
