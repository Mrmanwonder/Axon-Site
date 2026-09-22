/* ═══════════════════════════════════════════════════════════════════════════
   NAV DESTINATIONS

   Five destinations, in CLAUDE.md's order:

     Home · Library · Scan · Insights · Settings

   Note this is NOT the prototype's order, which runs Home · Insights · Scan ·
   Library · Settings. CLAUDE.md and reference/prototype.html disagree, and
   CLAUDE.md's own arbitration clause ("where this document and index.html
   disagree, index.html wins") is scoped to the design system — tokens, type,
   the lens, the springs — not to information architecture. Nav order is IA,
   so CLAUDE.md governs. Flagged in the port report.

   `solid` marks the glyph that fills rather than strokes when active, which
   is Home only. Library draws its live count in TabNav from the paper list.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { InsightsNavGlyph } from "../components/NavGlyphs";
import { paths } from "./paths";

export type Destination = {
  path: string;
  label: string;
  icon: ReactNode;
  /** Fills rather than strokes when active. */
  solid?: boolean;
  /** Marks the elevated centre action rather than a peer tab. */
  elevated?: boolean;
  /** Matches child routes too, so a question detail keeps Library lit. */
  matchPrefix?: string;
};

export const destinations: Destination[] = [
  {
    path: paths.home,
    label: "Home",
    solid: true,
    icon: (
      <path d="M3.6 10.3 12 3.2l8.4 7.1c.3.3.5.7.5 1.1v8a1.6 1.6 0 0 1-1.6 1.6h-4.2v-5.6a1 1 0 0 0-1-1h-4.2a1 1 0 0 0-1 1V21H4.7a1.6 1.6 0 0 1-1.6-1.6v-8c0-.4.2-.8.5-1.1Z" />
    ),
  },
  {
    path: paths.library,
    label: "Library",
    matchPrefix: "/library",
    icon: null, // TabNav renders the document with the current paper count.
  },
  {
    path: paths.scan,
    label: "Scan",
    elevated: true,
    matchPrefix: "/scan",
    icon: (
      <>
        <path d="M3 8.6V6.4A1.9 1.9 0 0 1 4.9 4.5H7M17 4.5h2.1A1.9 1.9 0 0 1 21 6.4v2.2M21 15.4v2.2a1.9 1.9 0 0 1-1.9 1.9H17M7 19.5H4.9A1.9 1.9 0 0 1 3 17.6v-2.2" />
        <path d="M7 12h10" />
      </>
    ),
  },
  {
    path: paths.insights,
    label: "Insights",
    icon: <InsightsNavGlyph />,
  },
  {
    path: paths.settings,
    label: "Settings",
    icon: null, // renders the profile avatar instead of a glyph
  },
];

/** Which destination a location belongs to. Returns -1 for none, which is
    what the 404 and any future off-nav screen get. */
export function activeIndex(pathname: string): number {
  return destinations.findIndex((d) =>
    d.matchPrefix
      ? pathname === d.matchPrefix || pathname.startsWith(d.matchPrefix + "/")
      : pathname === d.path,
  );
}
