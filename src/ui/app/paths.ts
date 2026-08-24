/* ═══════════════════════════════════════════════════════════════════════════
   ADDRESSES

   Every URL in the app is built from here, so no route string is ever written
   twice and renaming a segment is one edit.

   This is deliberately a leaf module with no imports. The nav needs addresses
   and the router needs addresses, but the router also mounts the shell, which
   mounts the nav — so putting these in routes.tsx makes a cycle, and one of
   the two modules ends up reading the other's exports before they are
   initialised. Nothing here may import anything.
   ═══════════════════════════════════════════════════════════════════════════ */

export const paths = {
  home: "/",
  library: "/library",
  paper: (paperId: string) => `/library/${paperId}`,
  question: (paperId: string, qId: string) => `/library/${paperId}/${qId}`,
  scan: "/scan",
  review: (draftId: string) => `/scan/review/${draftId}`,
  insights: "/insights",
  settings: "/settings",
} as const;

/* ── Overlay convention ──
   A sheet is opened by pushing `?sheet=<name>` onto the current location, and
   dismissed with navigate(-1). The screen underneath keeps rendering, so there
   is no unmount, no scroll loss and no refetch — and Back closes the sheet
   rather than leaving the screen. Sheets that carry a subject take
   `?sheet=<name>&for=<id>`.

   Named here rather than as string literals at each call site, so the set of
   overlays in the app is enumerable. */
export const SHEET = {
  /* Destructive actions state what will happen. They never ask "are you
     sure?" — the consequence sheet is the alternative to that question. */
  consequence: "consequence",
  /* Transcription wrong: the alternatives picker is the landing state. */
  fixTranscription: "fix",
  /* Cause tag wrong. Accepted immediately, never called "disagree". */
  notWhyILostIt: "cause",
  /* Marks disputed: we do not adjudicate, we point back to the teacher. */
  marksQuery: "marks",
  textSize: "text-size",
} as const;

export type SheetName = (typeof SHEET)[keyof typeof SHEET];
