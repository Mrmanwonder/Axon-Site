import { Component, lazy, StrictMode, Suspense, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { needsApplication } from "./app/entryGate";
import Intro from "./onboarding/Intro";
import { Shell } from "./onboarding/chrome";
import "./onboarding/Onboarding.css";
import CookieConsent from "./components/CookieConsent";
import { isAcademicSharePath } from "./lib/shareRoute";
import { startPauseOffscreenMotion } from "./lib/pauseOffscreenMotion";
// Analytics is not started here. It waits until the app shell or onboarding
// declares who is using the page (setAnalyticsAudience), so it cannot start in
// a student session before the scope is known. The share route never mounts
// either, so it never starts analytics.
import "./styles/app.css";
import "./styles/system.css";
import "./styles/shell.css";
import "./styles/performance.css";
import "./styles/cookie-consent.css";
import "./components/EssentialButton.css";
import "./styles/review-2026-10.css";

startPauseOffscreenMotion();

const academicShareRoute = isAcademicSharePath(location.pathname);

const Application = lazy(() => import("./app/Application"));
class BootBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main><h1>Axon could not load</h1><p>Check your connection and try again.</p><button onClick={() => location.reload()}>Try again</button></main> : this.props.children;
  }
}
function Entry() {
  const [start, setStart] = useState(() => needsApplication(location));
  return start ? <BootBoundary><Suspense fallback={<main aria-busy="true"><p role="status">Loading your Axon workspace…</p></main>}><Application /></Suspense></BootBoundary> :
    <Shell variant="intro"><Intro onContinue={() => {
      history.replaceState(history.state, "", "/?start=account");
      setStart(true);
    }} /></Shell>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Entry />
    {!academicShareRoute && <CookieConsent />}
  </StrictMode>,
);
