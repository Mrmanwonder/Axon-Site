/* Empty-state illustrations carry no student data or invented marks.
   NoPapersArt is decorative: the neighbouring heading and action explain it.
   Static SVG only; no perpetual motion, external asset or filter. */

/** A paper framed for capture, with a teacher's annotation but no mark value. */
export function NoPapersArt() {
  return (
    <svg className="paper-empty-art" viewBox="0 0 240 184" aria-hidden="true" focusable="false">
      <rect className="back" x="63" y="29" width="104" height="136" rx="12" transform="rotate(-12 115 97)" />
      <rect className="middle" x="77" y="25" width="104" height="136" rx="12" transform="rotate(7 129 93)" />
      <g transform="rotate(-3 123 89)">
        <rect className="front" x="71" y="17" width="104" height="140" rx="12" />
        <g className="lines">
          <path d="M87 40h39M87 57h71M87 69h61M87 81h45M87 112h71M87 124h58M87 136h30" />
        </g>
        <g className="annotation">
          <ellipse cx="149" cy="81" rx="11" ry="9" transform="rotate(-8 149 81)" />
          <path d="m142 95 10-2" />
        </g>
      </g>
      <path className="corners" d="M48 46V28a8 8 0 0 1 8-8h8M181 20h7a8 8 0 0 1 8 8v18M48 136v18a8 8 0 0 0 8 8h8M196 136v18a8 8 0 0 1-8 8h-7" />
    </svg>
  );
}

/** The shape an answer will have, before there is one.

    An axis that exists and bars that do not. Always five, never a count of
    anything - see the header. */
export function NotEnoughDataArt() {
  return (
    <svg className="art" viewBox="0 0 168 128" role="img"
         aria-label="The outline of a chart, not yet filled in">
      {/* The frame of the thing being waited for. */}
      <g className="ghost">
        <rect x="16" y="14" width="136" height="100" rx="11" />
      </g>

      {/* The axis is real: it is the one part of this that does not depend on
          having any papers. */}
      <g className="axis">
        <path d="M32 96h104" />
      </g>

      {/* Five outlines. Uneven heights, so it reads as a chart rather than a
          progress bar - but categorically uneven, not ranked: the tallest is in
          the middle, because a left-to-right descent is a leaderboard and this
          app does not draw those. */}
      <g className="ghost bars">
        <rect x="38" y="72" width="14" height="24" rx="4" />
        <rect x="59" y="58" width="14" height="38" rx="4" />
        <rect x="80" y="44" width="14" height="52" rx="4" />
        <rect x="101" y="64" width="14" height="32" rx="4" />
        <rect x="122" y="78" width="14" height="18" rx="4" />
      </g>

      {/* Nothing here is filled in, and that is the point. A single solid bar
          would sit directly above a progress row reading "1 of 4" and would be
          read as that one paper - which is the whole failure this screen exists
          to prevent, drawn instead of written. */}
    </svg>
  );
}


