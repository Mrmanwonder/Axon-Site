/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE TABLE

   Real routing, real history. Three rules hold across the whole table:

   1 · Every screen is addressable. A deep link to a question resolves to that
       question, on a cold load, with no prior navigation.

   2 · Every overlay is a location. Sheets, modals and the fullscreen review
       are pushed onto history, not held in component state — so the browser
       back button closes them instead of leaving the screen underneath them.

   3 · Nothing that is a filter or a tab state gets its own path segment.

   Home, the persistent shell and the tiny NotFound safety surface stay eager.
   Every substantive non-Home screen is a separate chunk so a cold Home visit
   does not parse Settings, Scan, review, legal pages or QuestionDetail's KaTeX
   dependency before the student asks for them.
   ═══════════════════════════════════════════════════════════════════════════ */

import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import Root from "../shell/Root";
import Home from "../pages/Home";
import NotFound from "../pages/NotFound";

const Library = lazy(() => import("../pages/Library"));
const PaperOverview = lazy(() => import("../pages/PaperOverview"));
const QuestionDetail = lazy(() => import("../pages/QuestionDetail"));
const Scan = lazy(() => import("../pages/Scan"));
const PaperReview = lazy(() => import("../pages/PaperReview"));
const Insights = lazy(() => import("../pages/Insights"));
const Settings = lazy(() => import("../pages/Settings"));
const Privacy = lazy(() => import("../pages/Privacy"));
const Terms = lazy(() => import("../pages/Terms"));

export { paths, SHEET } from "./paths";
export type { SheetName } from "./paths";

function RouteFallback() {
  return (
    <div className="greet" aria-busy="true" aria-label="Opening screen">
      <div className="skel" style={{ width: "42%" }} aria-hidden="true" />
      <div className="skel" style={{ width: "70%", marginTop: 12 }} aria-hidden="true" />
    </div>
  );
}

function deferred(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  { path: "/privacy", element: deferred(<Privacy />) },
  { path: "/terms", element: deferred(<Terms />) },
  {
    path: "/",
    element: <Root />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },

      { path: "library", element: deferred(<Library />) },
      { path: "library/:paperId", element: deferred(<PaperOverview />) },
      { path: "library/:paperId/:qId", element: deferred(<QuestionDetail />) },

      { path: "scan", element: deferred(<Scan />) },
      { path: "scan/review/:draftId", element: deferred(<PaperReview />) },

      { path: "insights", element: deferred(<Insights />) },
      { path: "settings", element: deferred(<Settings />) },

      { path: "index.html", element: <Navigate to="/" replace /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
