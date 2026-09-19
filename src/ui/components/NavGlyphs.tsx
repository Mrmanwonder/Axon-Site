/** Library's document stays recognisable while its contents report a real count. */
export function LibraryNavGlyph({ paperCount }: { paperCount: number }) {
  const hasPapers = paperCount > 0;
  const label = paperCount > 99 ? "99+" : String(paperCount);

  return (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      {hasPapers ? (
        <text className="library-count" x="12" y="12.4" textAnchor="middle" dominantBaseline="middle"
              textLength={paperCount > 9 ? 11 : undefined} lengthAdjust="spacingAndGlyphs">
          {label}
        </text>
      ) : (
        <>
          <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4.5" />
        </>
      )}
    </>
  );
}

/** One clean rising trace reads more clearly than four disconnected bars. */
export function InsightsNavGlyph() {
  return (
    <>
      <path d="M4 19.5h16M4 19.5V5" />
      <path d="m6.5 15.5 4-4 3.2 2.3 5-6.3" />
      <circle cx="18.7" cy="7.5" r=".8" className="insights-endpoint" />
    </>
  );
}
