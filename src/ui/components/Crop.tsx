/* ═══════════════════════════════════════════════════════════════════════════
   CROP — one region of one page, shown against the pixels it was read from.

   Both surfaces that show a student their own handwriting use this: the review
   screen, where the crop is how they judge whether we read the mark right, and
   QuestionDetail, where it is the question they are being told about.

   The cut is CSS, not canvas — see src/scan/crops.js for why that distinction
   is load-bearing rather than a style preference. The short version: a canvas
   has to fetch the bytes, a fetch is a cross-origin read, and a cross-origin
   read of the asset was failing on a missing header. An <img> just displays.

   Hard rule 4: a crop that cannot be shown says so. It never collapses to
   nothing and it never shows a different part of the page instead.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";

export interface CropBox { x: number; y: number; w: number; h: number }

type Styles = { frame: React.CSSProperties; image: React.CSSProperties } | null;

export default function Crop({
  paperId,
  pageNumber,
  box,
  missing = "We could not show this part of the page.",
  alt = "The part of your paper this came from",
  highlight = null,
}: {
  paperId: string | null | undefined;
  pageNumber: number | null | undefined;
  box: CropBox | null | undefined;
  missing?: string;
  alt?: string;
  /**
   * A box inside `box`, in the same 0–1000 page grid, drawn over the crop.
   *
   * This is what turns "the app misread me" from an argument into a two-second
   * check: tap a segment of the transcription and see the handwriting it was
   * read from, in the student's own hand.
   */
  highlight?: CropBox | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [styles, setStyles] = useState<Styles>(null);
  // Three states, not two: "still resolving" must not render the failure copy,
  // or every crop flashes "we could not show this" before it shows.
  const [failed, setFailed] = useState(false);
  // A signed URL outlives its signature if a student sits here long enough. One
  // silent re-sign on error is the difference between a crop that comes back
  // and one that reads as a scan that went wrong.
  const resigned = useRef(false);

  useEffect(() => {
    if (!paperId || pageNumber == null || !box) { setFailed(true); return; }
    let cancelled = false;
    setSrc(null); setStyles(null); setFailed(false);
    resigned.current = false;
    import("../../scan/crops.js")
      .then(({ pageImageUrl }) => pageImageUrl(paperId, pageNumber))
      .then((url: string | null) => {
        if (cancelled) return;
        if (url) setSrc(url); else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [paperId, pageNumber, box?.x, box?.y, box?.w, box?.h]);

  // The page's real pixel size is only known once the image has loaded, and it
  // is what the box coordinates are in — so the geometry is computed here
  // rather than guessed upstream.
  async function measure(el: HTMLImageElement) {
    if (!box) return;
    const { cropStyles } = await import("../../scan/crops.js");
    const next = cropStyles(box, el.naturalWidth, el.naturalHeight);
    if (next) setStyles(next as NonNullable<Styles>); else setFailed(true);
  }

  async function recover() {
    if (resigned.current || !paperId || pageNumber == null) { setFailed(true); return; }
    resigned.current = true;
    const { pageImageUrl } = await import("../../scan/crops.js");
    const url = await pageImageUrl(paperId, pageNumber, { force: true });
    if (url) setSrc(url); else setFailed(true);
  }

  if (failed) return <div className="missing">{missing}</div>;

  return (
    <div className="cropframe" style={styles?.frame}>
      {src && (
        <img
          src={src}
          alt={alt}
          style={styles?.image}
          // Hidden rather than unmounted until measured: the load is what
          // provides the measurement, so it has to happen on screen.
          data-ready={styles ? "1" : undefined}
          onLoad={(e) => void measure(e.currentTarget)}
          onError={() => void recover()}
        />
      )}
      {/* The highlight is positioned relative to the crop's own box, so a
          segment's page-grid coordinates land in the right place inside a frame
          that is already showing only part of the page. Drawn only once the
          image has been measured, or it would sit over nothing. */}
      {styles && highlight && box && (
        <div
          className="crophl"
          aria-hidden="true"
          style={{
            left: `${((highlight.x - box.x) / box.w) * 100}%`,
            top: `${((highlight.y - box.y) / box.h) * 100}%`,
            width: `${(highlight.w / box.w) * 100}%`,
            height: `${(highlight.h / box.h) * 100}%`,
          }}
        />
      )}
    </div>
  );
}
