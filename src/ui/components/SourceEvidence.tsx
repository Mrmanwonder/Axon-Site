import { useEffect, useRef, useState } from "react";
import Crop from "./Crop";
import type { CropBox } from "./Crop";
import MaterialSymbol from "./MaterialSymbol";
import "../styles/source-evidence.css";

type Props = {
  paperId: string | null | undefined;
  pageNumber: number | null | undefined;
  box: CropBox | null | undefined;
  highlight?: CropBox | null;
  missing?: string;
  alt?: string;
  pageNumbers?: number[];
  label?: string;
  /** The caller already shows the crops; offer only the full saved page. */
  inspectOnly?: boolean;
};

function SavedPage({ paperId, page, alt }: { paperId: string; page: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const resigned = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setSrc(null); setLoaded(false); setFailed(false);
    resigned.current = false;
    import("../../scan/crops.js")
      .then(({ pageImageUrl }) => pageImageUrl(paperId, page, { force: attempt > 0 }))
      .then(url => { if (!cancelled) { setSrc(url); setFailed(!url); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; alive.current = false; };
  }, [paperId, page, attempt]);
  async function recover() {
    setLoaded(false);
    if (resigned.current) { setFailed(true); return; }
    resigned.current = true;
    try {
      const { pageImageUrl } = await import("../../scan/crops.js");
      const url = await pageImageUrl(paperId, page, { force: true });
      if (!alive.current) return;
      if (url && url !== src) setSrc(url); else setFailed(true);
    } catch { if (alive.current) setFailed(true); }
  }
  return <div className="source-page">
    <div className="source-tools" aria-label="Saved page zoom">
      <button type="button" disabled={zoom <= 1 || !loaded || failed} onClick={() => setZoom(v => Math.max(1, v - .5))}>Zoom out</button>
      <output aria-live="polite">{zoom * 100}%</output>
      <button type="button" disabled={zoom >= 3 || !loaded || failed} onClick={() => setZoom(v => Math.min(3, v + .5))}><MaterialSymbol name="zoom" size={20} />Zoom in</button>
      <button type="button" disabled={zoom === 1} onClick={() => setZoom(1)}>Reset zoom</button>
    </div>
    {failed ? <div className="source-unavailable"><p>We could not show saved page {page}. No replacement image has been inferred.</p><button type="button" onClick={() => { setZoom(1); setAttempt(v => v + 1); }}>Try page again</button></div>
      : <>
        {!loaded && <p role="status">Loading saved page {page}…</p>}
        <div className="source-page-frame" tabIndex={0} role="region" aria-label={`Saved page ${page}. Use arrow keys to scroll when zoomed.`}>
          {src && <img src={src} alt={alt} style={{ width: `${zoom * 100}%`, visibility: loaded ? "visible" : "hidden" }} onLoad={() => setLoaded(true)} onError={() => void recover()} />}
        </div>
      </>}
  </div>;
}

/** Uses the existing owner-authorized page asset path; never publishes source pixels. */
export default function SourceEvidence({ paperId, pageNumber, box, highlight, missing, alt, pageNumbers, label = "Source on your paper", inspectOnly = false }: Props) {
  const pages = Array.from(new Set([...(pageNumber != null ? [pageNumber] : []), ...(pageNumbers ?? [])])).filter(p => Number.isInteger(p) && p > 0);
  const [full, setFull] = useState(!box);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(pageNumber ?? pages[0]);
  useEffect(() => { setFull(!box); setSelected(pageNumber ?? pages[0]); }, [paperId, pageNumber, box?.x, box?.y, box?.w, box?.h, pages.join(",")]);
  const valid = paperId && selected != null;
  if (inspectOnly) {
    if (!valid) return null;
    return <section className="source-evidence inspect" aria-label="Full saved page">
      <div className="source-tools">
        <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? "Hide the saved page" : "Inspect the full saved page"}</button>
        {open && pages.length > 1 && <label>Page<select aria-label="Source page" value={selected} onChange={event => setSelected(Number(event.target.value))}>{pages.map(p => <option key={p} value={p}>{p}</option>)}</select></label>}
      </div>
      {open && <SavedPage key={`${paperId}:${selected}`} paperId={paperId} page={selected} alt={alt ?? `Saved page ${selected} of your paper`} />}
    </section>;
  }
  return <section className="source-evidence" aria-label={label}>
    <div className="source-heading"><h3>{label}</h3>{pageNumber != null && <span>Page {pageNumber}{pages.length > 1 ? ` · ${pages.length} source pages` : ""}</span>}</div>
    {valid && <div className="source-tools">
      {box && <button type="button" aria-pressed={!full} onClick={() => setFull(false)}>Question crop</button>}
      <button type="button" aria-pressed={full} onClick={() => setFull(true)}>Full saved page</button>
      {full && pages.length > 1 && <label>Page<select aria-label="Source page" value={selected} onChange={event => setSelected(Number(event.target.value))}>{pages.map(p => <option key={p} value={p}>{p}</option>)}</select></label>}
    </div>}
    {valid && full ? <SavedPage key={`${paperId}:${selected}`} paperId={paperId} page={selected} alt={alt ?? `Saved page ${selected} of your paper`} />
      : <Crop paperId={paperId} pageNumber={pageNumber} box={box} highlight={highlight} missing={missing} alt={alt} />}
    <p className="source-caption">Inspect the printed question, your working and the teacher’s annotations. The saved page is the reference for this reading.</p>
  </section>;
}
