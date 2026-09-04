/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY-STATE ART

   Home and Insights both open on nothing, for good reasons that are not going
   to change: Home refuses to invent a paper count, and Insights refuses to draw
   a chart before `student_analytics_readiness` says there is one worth drawing.
   Both were then anchored by a 24px line icon in a 52px tile, which is the
   affordance for a row, not the subject of a screen — so the honest state read
   as an unfinished one.

   These are the same drawings at the size the screen actually needs. Nothing
   about the constraint moved: there is still no number here, no headline and no
   sample of somebody else's data.

   ── Why both illustrations are made of dashed outlines ──

   The design language already has a vocabulary for "this is not established":
   confirmed is a solid fill, likely is a light fill with a border, unsure is a
   dashed outline. That is a rule about confidence badges, but it is the right
   grammar here too — an empty state is the app being unsure at the largest
   possible scale. So the paper that exists is drawn solid and the papers that
   do not are dashed; the axis is drawn solid and the bars that have not been
   earned are dashed.

   It also survives what the copy rules care about. It carries no quantity a
   student could read as theirs: five dashed bars are not five papers, and the
   Insights art draws the same five whether you have one paper or three. If the
   drawing counted, it would be data, and inventing data is what the empty state
   exists to avoid.

   ── Colour ──

   Strokes are `currentColor` against `--label-3`, with one accent element each.
   No red, which is reserved for signing out and would read as a rebuke on the
   first screen a new student sees. No cause hues either: those mean something
   specific in this app, and spending them on decoration would teach the wrong
   association before the student has ever seen the real thing.

   ── Motion ──

   None. These sit on the first screen of the app, which is not a task
   completing, and the performance floor is a real one — a decorative animation
   on the empty state is a compositor running forever for no information.
   ═══════════════════════════════════════════════════════════════════════════ */

/** A marked paper, and the ones that aren't here yet.

    The solid sheet carries ruled answer lines and one circled annotation in the
    margin — the shape of a teacher's mark, deliberately with no number in it.
    A number would be a mark, and the model does not get to write one of those.
    See hard rule 1. */
export function NoPapersArt() {
  return (
    <svg className="art" viewBox="0 0 168 128" role="img"
         aria-label="A marked paper, with space for more">
      {/* The two that aren't here yet, behind and dashed. */}
      <g className="ghost">
        <rect x="36" y="18" width="84" height="100" rx="9" transform="rotate(-9 78 68)" />
        <rect x="41" y="16" width="84" height="100" rx="9" transform="rotate(-4.5 83 66)" />
      </g>

      {/* The one you'd add. Filled with the card's own surface rather than left
          transparent — three overlapping outlines in the same grey read as a
          tangle, and the point of the drawing is that one of these sheets is
          real and the others are not. */}
      <g className="sheet">
        <rect x="46" y="14" width="84" height="100" rx="9" />
      </g>

      {/* Ruled answer lines. Uneven on purpose — a paragraph, not a form — and
          kept clear of the annotation so nothing crosses it. */}
      <g className="rule">
        <path d="M58 36h58" />
        <path d="M58 50h46" />
        <path d="M58 64h34" />
        <path d="M58 88h54" />
        <path d="M58 102h28" />
      </g>

      {/* The teacher's hand: something circled on the third line, and a tick
          near the end. Both are marks of attention. Neither is a number, and
          that is deliberate — a number here would be a mark, and marks come
          from a teacher's pen or an official scheme, never from us. */}
      <g className="pen">
        <circle cx="110" cy="64" r="10" />
        <path d="M96 101l5 5 11-12" />
      </g>
    </svg>
  );
}

/** The shape an answer will have, before there is one.

    An axis that exists and bars that do not. Always five, never a count of
    anything — see the header. */
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
          progress bar — but categorically uneven, not ranked: the tallest is in
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
          read as that one paper — which is the whole failure this screen exists
          to prevent, drawn instead of written. */}
    </svg>
  );
}
