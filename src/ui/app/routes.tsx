/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE TABLE

   Real routing, real history. Three rules hold across the whole table:

   1 · Every screen is addressable. A deep link to a question resolves to that
       question, on a cold load, with no prior navigation.

   2 · Every overlay is a location. Sheets, modals and the fullscreen review
       are pushed onto history, not held in component state — so the browser
       back button closes them instead of leaving the screen underneath them.
       The convention is the `?sheet=` search param (see paths.ts); the
       fullscreen review is a route proper because it is a screen, not a sheet.

   3 · Nothing that is a filter or a tab state gets its own path segment. Those
       are search params on the screen they belong to, so a shared link carries
       the filter and back steps through filter changes the way a user expects.

   ── The Insights empty state ──
   The prototype has two Insights views: the populated one and an honest
   "not enough papers yet" state. That is not a second route — it is one route
   rendering from `student_analytics_readiness`. Giving it a URL would make it
   linkable, and a link to "you don't have enough data" is not a thing anyone
   should be able to send.
   ═══════════════════════════════════════════════════════════════════════════ */

import { createBrowserRouter, Navigate } from "react-router-dom";
import Root from "../shell/Root";
import NotFound from "../pages/NotFound";

export { paths, SHEET } from "./paths";
export type { SheetName } from "./paths";

export const router = createBrowserRouter([
  { path: "/privacy", lazy: async () => ({ Component: (await import("../pages/Privacy")).default }) },
  { path: "/terms", lazy: async () => ({ Component: (await import("../pages/Terms")).default }) },
  {
    path: "/",
    element: <Root />,
    errorElement: <NotFound />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import("../pages/Home")).default }) },

      { path: "library", lazy: async () => ({ Component: (await import("../pages/Library")).default }) },
      { path: "library/:paperId", lazy: async () => ({ Component: (await import("../pages/PaperOverview")).default }) },
      { path: "library/:paperId/:qId", lazy: async () => ({ Component: (await import("../pages/QuestionDetail")).default }) },

      { path: "scan", lazy: async () => ({ Component: (await import("../pages/Scan")).default }) },
      /* The fullscreen paper review is a screen, not a sheet: it has its own
         header, its own scroll and a save action, and it must survive a
         reload mid-review. It slides in over the shell the way the prototype's
         .reviewsheet did, but it is a real location. */
      { path: "scan/review/:draftId", lazy: async () => ({ Component: (await import("../pages/PaperReview")).default }) },

      { path: "insights", lazy: async () => ({ Component: (await import("../pages/Insights")).default }) },
      { path: "settings", lazy: async () => ({ Component: (await import("../pages/Settings")).default }) },

      /* The prototype's tab indices are not addresses. Anyone who bookmarked
         one gets sent home rather than a 404. */
      { path: "index.html", element: <Navigate to="/" replace /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
