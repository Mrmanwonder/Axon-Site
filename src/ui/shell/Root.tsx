/* ═══════════════════════════════════════════════════════════════════════════
   ROOT

   The providers, and the gate that decides whether there is an app to show yet.

   The gate has four states. A failed account read is never substituted with an
   onboarding conclusion: infrastructure failure and account absence are
   different facts.
   ═══════════════════════════════════════════════════════════════════════════ */

import ProfileChooser from "../components/ProfileChooser";

import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { AppProvider, useApp } from "../data/AppProvider";
import { ToastProvider } from "../components/ToastProvider";
import { SheetProvider } from "../components/SheetProvider";
import { IngestionProvider } from "../data/useIngestion";
import { ScanProvider } from "../scan/ScanProvider";
import AppShell from "./AppShell";
import PressBox from "../components/PressBox";
import SkeletonLoader from "../components/SkeletonLoader";
import { skeletonVariantForPath } from "../components/PageSkeleton";

/* Split out for the same reason the scanner is: a returning student is signed
   in and will never load this, and onboarding drags the whole eight-step flow
   and its notice text onto a critical path it has no business being on. */
const Onboarding = lazy(() => import("../onboarding/Onboarding"));

/* The recovery screen. Deliberately not the onboarding flow, and deliberately
   not a blank page. */
function BootError() {
  const { bootError, retryBoot, online } = useApp();
  return (
    <div className="greet" style={{ padding: "24px 20px" }}>
      <h1>We can&rsquo;t reach your account</h1>
      <div className="note" style={{ marginTop: 12 }}>
        {online
          ? "Something on our side didn't answer. Nothing has been lost — your papers and everything we worked out from them are still here."
          : "You appear to be offline. Nothing has been lost; this needs a connection to load."}
      </div>
      <div className="list" style={{ marginTop: 16 }}>
        <PressBox
          as="button" type="button" className="srow noicon" data-interactive=""
          onClick={() => retryBoot()}
        >
          <div className="lbl">Try again</div>
        </PressBox>
      </div>
      {bootError && (
        <div className="note" style={{ marginTop: 12, opacity: 0.6 }}>{bootError}</div>
      )}
    </div>
  );
}

function Gate() {
  const { gate } = useApp();
  const { pathname } = useLocation();
  const skeletonVariant = skeletonVariantForPath(pathname);
  const cleanupError = sessionStorage.getItem("axon.cleanup-error");
  if (cleanupError) return <main><h1>Local cleanup needs attention</h1><p>{cleanupError}</p><button onClick={async () => { try { const { LocalDataService } = await import("../../local-data.js"); await LocalDataService.clearAll(); sessionStorage.removeItem("axon.cleanup-error"); location.reload(); } catch { /* Keep the recovery message visible. */ } }}>Retry local cleanup</button></main>;

  // Nothing, not a spinner: the document is already painted in the right theme
  // by the inline script in index.html, and a spinner that appears for 80ms and
  // vanishes is worse than a still frame.
  if (gate === "loading") return <SkeletonLoader label="Loading your Axon workspace" variant={skeletonVariant} />;
  if (gate === "choose_profile") return <main><ProfileChooser /></main>;
  if (gate === "boot_error") return <BootError />;
  if (gate === "onboarding") {
    return <Suspense fallback={<SkeletonLoader label="Loading setup" variant="onboarding" />}><Onboarding /></Suspense>;

  }
  return <AppShell />;
}

export default function Root() {
  return (
    <AppProvider>
      <ToastProvider>
        <SheetProvider>
          {/* ScanProvider is outside IngestionProvider because ingestion asks it
              for the loader: an upload started from Home has to go through the
              same door as the shutter, or it reaches the flow before the flow
              has been handed the student and is dropped in silence. */}
          <ScanProvider>
            <IngestionProvider>
              <Gate />
            </IngestionProvider>
          </ScanProvider>
        </SheetProvider>
      </ToastProvider>
    </AppProvider>
  );
}
