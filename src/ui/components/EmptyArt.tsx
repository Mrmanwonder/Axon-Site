/* Original, data-free illustrations for Axon's first-use states.
   These are deliberately decorative; nearby headings and links carry meaning.
   No invented student work, marks, metrics, or animated dependencies. */

/** Home: a blank paper entering the scan frame, before any real work exists. */
export function NoPapersArt() {
  return (
    <svg className="axon-paper-art" viewBox="0 0 500 350" aria-hidden="true" focusable="false">
      <ellipse className="ground" cx="255" cy="298" rx="178" ry="19" />
      <path className="field-line" d="M42 300h416" />
      <g className="back-sheet" transform="rotate(-16 225 176)">
        <rect x="139" y="53" width="183" height="236" rx="10" />
        <path d="M161 87h58M161 101h113M161 115h97" />
      </g>
      <g className="second-sheet" transform="rotate(9 277 171)">
        <rect x="191" y="43" width="179" height="237" rx="9" />
        <path d="M214 78h62M214 92h115M214 106h96" />
      </g>
      <g className="front-sheet" transform="rotate(-4 264 162)">
        <rect x="177" y="32" width="182" height="245" rx="10" />
        <path className="rule" d="M209 49v209" />
        <path className="writing" d="M226 73h90M226 88h112M226 103h94M226 138h111M226 153h79M226 187h105M226 202h87M226 217h111" />
        <path className="ink" d="m229 125 17 5 18-10M276 174c19-11 39-10 55-2" />
        <circle className="ink-dot" cx="229" cy="125" r="3.5" />
        <path className="page-turn" d="M335 277v-26a5 5 0 0 1 5-5h19" />
      </g>
      <g className="scan-edges">
        <path d="M132 97V77a13 13 0 0 1 13-13h20M372 64h19a13 13 0 0 1 13 13v20M132 248v21a13 13 0 0 0 13 13h20M404 248v21a13 13 0 0 1-13 13h-19" />
      </g>
      <g className="fine-notes">
        <path d="M85 144h37M85 155h24M397 171h34M405 181h26" />
        <circle cx="95" cy="254" r="4" />
        <circle cx="425" cy="126" r="3" />
      </g>
    </svg>
  );
}

/** Library: a finely drawn archive drawer, open and genuinely empty. */
export function LibraryEmptyArt() {
  return (
    <svg className="axon-file-art" viewBox="0 0 440 350" aria-hidden="true" focusable="false">
      <ellipse className="ground" cx="218" cy="315" rx="142" ry="15" />
      <path className="field-line" d="M48 315h345" />
      <g className="cabinet">
        <path className="side" d="M314 86 353 49v203l-39 37Z" />
        <path className="top" d="M103 86 143 49h210l-39 37Z" />
        <path className="front" d="M103 86h211v203H103Z" />
        <path className="lip" d="M103 86h211v9H103Z" />
        <path className="feet" d="M126 289v15h23v-15M280 289v15h22v-15" />
        <path className="fixed-drawer" d="M120 110h177v71H120Z" />
        <rect className="label-frame" x="182" y="125" width="53" height="20" rx="2" />
        <path className="label-line" d="M193 135h31" />
        <path className="handle" d="M189 157v4c0 3 4 6 8 6h22c5 0 8-3 8-6v-4" />
        <path className="inner-shade" d="M121 198h176v76H121Z" />
        <path className="rear-rim" d="M128 199h162" />
        <path className="drawer-inner" d="M121 199h176l-27 32H94Z" />
        <path className="drawer-depth" d="m121 199-27 32v39m203-71-27 32v39" />
        <path className="drawer-front" d="M94 231h176v67H94Z" />
        <path className="drawer-trim" d="M94 231h176v7H94Z" />
        <rect className="label-frame" x="155" y="245" width="54" height="20" rx="2" />
        <path className="label-line" d="M167 255h30" />
        <path className="handle" d="M159 276v3c0 3 4 6 8 6h29c5 0 8-3 8-6v-3" />
        <path className="track" d="M278 209h19M279 222h18" />
        <circle className="screw" cx="304" cy="92" r="2.5" />
      </g>
      <g className="side-details">
        <path d="M331 109v105M340 95v86" />
        <path d="M359 264h24M359 276h13" />
      </g>
      <path className="accent-detail" d="M111 190h24" />
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
