import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import "./styles/app.css";     /* tailwind theme, tokens, reset, font */
import "./styles/system.css";  /* the design system, verbatim */
import "./styles/shell.css";   /* what the port changed structurally */

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
