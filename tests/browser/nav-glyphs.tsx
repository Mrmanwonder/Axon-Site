import { createRoot } from "react-dom/client";
import { InsightsNavGlyph, LibraryNavGlyph } from "../../src/ui/components/NavGlyphs";

export function mountNavGlyphsTest(root: HTMLElement) {
  createRoot(root).render(
    <>
      {[0, 7, 12, 123].map((count) => (
        <div className="tab" data-paper-count={count} key={count}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <LibraryNavGlyph paperCount={count} />
          </svg>
        </div>
      ))}
      <div className="tab" data-nav-icon="insights">
        <svg viewBox="0 0 24 24" aria-hidden="true"><InsightsNavGlyph /></svg>
      </div>
    </>,
  );
}
