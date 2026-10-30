import { createBrowserRouter, Navigate } from "react-router-dom";
import Root from "../shell/Root";
import AppRouteErrorBoundary from "../pages/AppRouteErrorBoundary";

import NotFound from "../pages/NotFound";
import { paths } from "./paths";
import { mainRouteModules } from "./mainRouteModules";

export { paths, SHEET } from "./paths";
export type { SheetName } from "./paths";

/* Lazy routes resolve before the first render, and React Router 7 warns
   ("No `HydrateFallback` element provided") on every route that has none
   (issue #301). index.html has already painted the themed frame and Root
   paints its own skeleton, so the fallback is deliberately nothing. */
function HydrateFallback() { return null; }

export const router = createBrowserRouter([
  { path: "/design-system", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/DesignSystem")).default }) },
  { path: "/privacy", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/Privacy")).default }) },
  { path: "/terms", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/Terms")).default }) },
  { path: "/cookies", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/Cookies")).default }) },
  { path: "/share", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/SharedAcademic")).default }) },
  {
    path: "/",
    element: <Root />,
    HydrateFallback,
    errorElement: <AppRouteErrorBoundary />,
    children: [
      { index: true, HydrateFallback, lazy: async () => ({ Component: (await mainRouteModules[paths.home]()).default }) },
      { path: "library", HydrateFallback, lazy: async () => ({ Component: (await mainRouteModules[paths.library]()).default }) },
      { path: "library/:paperId", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/PaperOverview")).default }) },
      { path: "library/:paperId/:qId", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/QuestionDetail")).default }) },
      { path: "scan", HydrateFallback, lazy: async () => ({ Component: (await mainRouteModules[paths.scan]()).default }) },
      { path: "scan/review/:draftId", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/PaperReview")).default }) },
      { path: "insights", HydrateFallback, lazy: async () => ({ Component: (await mainRouteModules[paths.insights]()).default }) },
      { path: "insights/journal", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/ErrorJournal")).default }) },
      { path: "practice/:sessionId", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/Practice")).default }) },
      { path: "insights/syllabus/:offeringId", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/SyllabusDetail")).default }) },
      { path: "tutor", HydrateFallback, lazy: async () => ({ Component: (await import("../pages/Tutor")).default }) },
      { path: "settings", HydrateFallback, lazy: async () => ({ Component: (await mainRouteModules[paths.settings]()).default }) },
      { path: "index.html", element: <Navigate to="/" replace /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
