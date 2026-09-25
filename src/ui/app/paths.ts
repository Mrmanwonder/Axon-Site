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
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
  share: "/share",
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
*/
export const SHEET = {
  consequence: "consequence",
  fixTranscription: "fix",
  notWhyILostIt: "cause",
  marksQuery: "marks",
  textSize: "text-size",
} as const;

export type SheetName = (typeof SHEET)[keyof typeof SHEET];
