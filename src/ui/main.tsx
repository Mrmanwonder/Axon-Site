import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import CookieConsent from "./components/CookieConsent";
import { getAnalyticsConsent, initAnalytics } from "./lib/analytics";
import "./styles/app.css";
import "./styles/system.css";
import "./styles/shell.css";
import "./styles/performance.css";
import "./styles/cookie-consent.css";

const academicShareRoute = location.pathname === "/share";
if (!academicShareRoute && getAnalyticsConsent() === "granted") initAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    {!academicShareRoute && <CookieConsent />}
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(error => console.error('Offline shell could not be installed', error)); });
}
