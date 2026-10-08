import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import CookieConsent from "./components/CookieConsent";
import { isAcademicSharePath } from "./lib/shareRoute";
// Analytics is not started here. It waits until the app shell or onboarding
// declares who is using the page (setAnalyticsAudience), so it cannot start in
// a student session before the scope is known. The share route never mounts
// either, so it never starts analytics.
import "./styles/app.css";
import "./styles/system.css";
import "./styles/shell.css";
import "./styles/performance.css";
import "./styles/cookie-consent.css";

const academicShareRoute = isAcademicSharePath(location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    {!academicShareRoute && <CookieConsent />}
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(error => console.error('Offline shell could not be installed', error)); });
}
