import { createBrowserRouter, Navigate } from "react-router-dom";
import Root from "../shell/Root";
import AppRouteErrorBoundary from "../pages/AppRouteErrorBoundary";

import NotFound from "../pages/NotFound";

export { paths, SHEET } from "./paths";
export type { SheetName } from "./paths";

export const router = createBrowserRouter([
  { path: "/privacy", lazy: async () => ({ Component: (await import("../pages/Privacy")).default }) },
  { path: "/terms", lazy: async () => ({ Component: (await import("../pages/Terms")).default }) },
  { path: "/cookies", lazy: async () => ({ Component: (await import("../pages/Cookies")).default }) },
  { path: "/share", lazy: async () => ({ Component: (await import("../pages/SharedAcademic")).default }) },
  {
    path: "/",
    element: <Root />,
    errorElement: <AppRouteErrorBoundary />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import("../pages/Home")).default }) },
      { path: "library", lazy: async () => ({ Component: (await import("../pages/Library")).default }) },
      { path: "library/:paperId", lazy: async () => ({ Component: (await import("../pages/PaperOverview")).default }) },
      { path: "library/:paperId/:qId", lazy: async () => ({ Component: (await import("../pages/QuestionDetail")).default }) },
      { path: "scan", lazy: async () => ({ Component: (await import("../pages/Scan")).default }) },
      { path: "scan/review/:draftId", lazy: async () => ({ Component: (await import("../pages/PaperReview")).default }) },
      { path: "insights", lazy: async () => ({ Component: (await import("../pages/Insights")).default }) },
      { path: "settings", lazy: async () => ({ Component: (await import("../pages/Settings")).default }) },
      { path: "index.html", element: <Navigate to="/" replace /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
