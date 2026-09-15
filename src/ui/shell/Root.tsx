/* ═══════════════════════════════════════════════════════════════════════════
   ROOT

   The providers, and the gate that decides whether there is an app to show yet.

   The gate has four states. A failed account read is never substituted with an
   onboarding conclusion: infrastructure failure and account absence are
   different facts.
   ═══════════════════════════════════════════════════════════════════════════ */

import { lazy, Suspense } from "react";
import { AppProvider, useApp } from "../data/AppProvider";
import { ToastProvider } from "../components/ToastProvider";
import { SheetProvider } from "../components/SheetProvider";
import { IngestionProvider } from "../data/useIngestion";
import { ScanProvider } from "../scan/ScanProvider";
import AppShell from "./AppShell";
import PressBox from "../components/PressBox";

/* Split out for the same reason the scanner is: a returning student is signed
   in and will never load this, and onboarding drags the whole eight-step flow
   and its notice text onto a critical path it has no business being on. */
const Onboarding = lazy(() => import("../onboarding/Onboarding"));

/**
 * A truthful first frame while Supabase restores identity.
 *
 * The old gate returned null. That made a fast document/React boot look like a
 * slow site because the browser had nothing useful to paint until account I/O
 * completed. This shell contains no account-derived claims and uses the final
 * page geometry, so it can appear immediately without a layout jump.
 */
function BootShell() {
  return (
    <div className="app" aria-busy="true" aria-label="Loading Axon">
      <div className="view on">
        <div className="greet">
          <div className="d">Axon</div>
          <h1>Opening your workspace</h1>
        </div>
        <div className="card nextstep" aria-hidden="true">
          <div className="skel" style={{ width: "38%" }} />
          <div className="skel" style={{ width: "82%", marginTop: 12 }} />
          <div className="skel" style={{ width: "62%", marginTop: 8 }} />
        </div>
      </div>
    </div>
  );
}

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

  if (gate === "loading") return <BootShell />;
  if (gate === "boot_error") return <BootError />;
  if (gate === "onboarding") {
    return <Suspense fallback={<BootShell />}><Onboarding /></Suspense>;
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
