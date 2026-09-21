import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import SkeletonLoader from "./components/SkeletonLoader";
import { initAnalytics } from "./lib/analytics";
import "./styles/app.css";     /* tailwind theme, tokens, reset, font */
import "./styles/system.css";  /* the design system, verbatim */
import "./styles/shell.css";   /* what the port changed structurally */

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} fallbackElement={<SkeletonLoader label="Loading Axon" />} />
  </StrictMode>,
);
