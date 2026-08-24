/* ═══════════════════════════════════════════════════════════════════════════
   ROOT

   The providers, and the gate that decides whether there is an app to show yet.

   The gate has three states and no fourth. `src/app.js` returned early to
   onboarding from four different places — no session, no guardian, no student,
   or a boot that threw — and every one of them lands on the same destination
   here, because onboarding is the only surface that can re-establish who this
   is. There is deliberately no error screen: an error screen a student cannot
   act on is worse than the flow that can fix the problem.

   While loading, this renders nothing rather than a spinner. The document is
   already painted in the right theme by the inline script in index.html, and a
   spinner that appears for 80ms and vanishes is worse than a still frame.
   ═══════════════════════════════════════════════════════════════════════════ */

import { lazy, Suspense } from "react";
import { AppProvider, useApp } from "../data/AppProvider";
import { ToastProvider } from "../components/ToastProvider";
import { SheetProvider } from "../components/SheetProvider";
import { IngestionProvider } from "../data/useIngestion";
import { ScanProvider } from "../scan/ScanProvider";
import AppShell from "./AppShell";

/* Split out for the same reason the scanner is: a returning student is signed
   in and will never load this, and onboarding drags the whole eight-step flow
   and its notice text onto a critical path it has no business being on. The
   performance floor is 60fps on a mid-tier Android, which starts with not
   shipping what this session cannot use. */
const Onboarding = lazy(() => import("../onboarding/Onboarding"));

function Gate() {
  const { gate } = useApp();

  // Nothing, not a spinner: the document is already painted in the right theme
  // by the inline script in index.html, and a spinner that appears for 80ms and
  // vanishes is worse than a still frame.
  if (gate === "loading") return null;
  if (gate === "onboarding") {
    return <Suspense fallback={null}><Onboarding /></Suspense>;
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
