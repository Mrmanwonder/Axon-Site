/* ═══════════════════════════════════════════════════════════════════════════
   THE PAPER STACK

   Pages already taken, drawn as papers dropped on a table: up to four visible,
   each at a fixed slight angle, newest on top, real page images on them. A page
   that needs a look wears an amber dashed outline and the count turns amber;
   the shape differs from the others, so it does not rely on colour.

   The one motion: a new page drops onto the stack. 220 ms, transform and
   opacity only, none under reduced motion (see scanner.css).
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import type { TrayPage } from "./ScanProvider";

const TILT = [-7, 5, -3, 8, -5];
const VISIBLE = 4;

export function needsLook(page: TrayPage): boolean {
  return !!page.flag || !!page.retakeRequested;
}

export default function PaperStack({ pages, onOpen, disabled = false }: {
  pages: TrayPage[]; onOpen: () => void; disabled?: boolean;
}) {
  const previous = useRef(pages.length);
  const [landing, setLanding] = useState<number | null>(null);

  useEffect(() => {
    if (pages.length > previous.current && pages.length) {
      setLanding(pages[pages.length - 1].page_number);
      const timer = window.setTimeout(() => setLanding(null), 260);
      previous.current = pages.length;
      return () => window.clearTimeout(timer);
    }
    previous.current = pages.length;
  }, [pages]);

  if (!pages.length) return <span className="sc-stack-empty" aria-hidden="true" />;

  const flagged = pages.filter(needsLook).length;
  const shown = pages.slice(-VISIBLE);
  const label = `${pages.length} page${pages.length === 1 ? "" : "s"}`
    + (flagged ? `, ${flagged} ${flagged === 1 ? "needs" : "need"} a look` : "")
    + ". Review pages";

  return (
    <button type="button" className="sc-stack" data-flagged={flagged ? "true" : undefined}
            aria-label={label} disabled={disabled} onClick={onOpen}>
      {shown.map((page, i) => (
        <span
          key={page.page_number}
          className="sc-sheet"
          data-flagged={needsLook(page) ? "true" : undefined}
          data-landing={landing === page.page_number ? "true" : undefined}
          style={{
            transform: `rotate(${TILT[i % TILT.length]}deg) translate(${(i - 1) * 2}px, ${(shown.length - 1 - i) * -1}px)`,
            zIndex: i,
          }}
        >
          {page.thumb && <img src={page.thumb} alt="" draggable={false} />}
        </span>
      ))}
      <em className="sc-count">{pages.length}</em>
    </button>
  );
}

/** Done reads the paper; Review appears instead when any page needs a look. */
export function DoneButton({ pages, busy, onDone, onReview }: {
  pages: TrayPage[]; busy: boolean; onDone: () => void; onReview: () => void;
}) {
  const preparing = pages.some((p) => p.pending);
  const flagged = pages.filter(needsLook).length;
  if (!pages.length) {
    return <button type="button" className="sc-done" disabled aria-label="Done, no pages yet">Done</button>;
  }
  if (flagged) {
    return (
      <button type="button" className="sc-done" data-kind="review" disabled={busy || preparing}
              onClick={onReview}>
        Review · {pages.length}
      </button>
    );
  }
  return (
    <button type="button" className="sc-done" disabled={busy || preparing} aria-busy={busy || undefined}
            onClick={onDone}>
      Done · {pages.length}
    </button>
  );
}
