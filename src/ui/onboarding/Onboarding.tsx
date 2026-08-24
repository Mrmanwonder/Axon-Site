/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING — interim mount

   `src/onboarding.js` is 1,100 lines and the order of its steps is legally
   load-bearing: no student data before consent, consent itemised per purpose
   with the optional ones off by default, payment only after consent. Under
   India's DPDP Act that sequence is the compliance story, not a UX preference.

   So it is mounted here rather than rewritten in the same pass as everything
   else. It keeps working exactly as it does on main — same DOM, same order,
   same consent ledger writes — while the rest of the app moves to React, and it
   is replaced on its own commit where the diff is reviewable as a flow rather
   than buried in a 4,000-line port.

   The two globals it reaches for are published before it mounts. The rows it
   creates are handed straight to the app context rather than re-fetched:
   re-reading re-runs the boot gate, and on a read replica that has not caught up
   the student is not there yet — which drops someone who has just finished
   onboarding back to the start of it.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import { useApp } from "../data/AppProvider";
import { installImperativeBridge } from "../lib/imperativeBridge";
import type { OnboardingResult, ProviderError } from "../data/modules";

type StartOnboarding = (
  root: HTMLElement,
  opts: {
    session: unknown;
    providerError: ProviderError | null;
    onComplete: (r: OnboardingResult) => void | Promise<void>;
  },
) => void;

export default function Onboarding() {
  const ref = useRef<HTMLDivElement>(null);
  const { session, providerError, finishOnboarding } = useApp();
  const started = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in development; onboarding builds its
    // own DOM and would otherwise be built twice into the same node.
    if (started.current || !ref.current) return;
    started.current = true;

    installImperativeBridge();

    // Imported here rather than through data/modules so it stays in this lazy
    // chunk. A static import in the facade hoists the whole flow back onto the
    // critical path, which is the opposite of why this component is split.
    const root = ref.current;
    void import("../../onboarding.js").then((m) => {
      (m.startOnboarding as StartOnboarding)(root, {
        session,
        providerError,
        onComplete: async (r) => { await finishOnboarding(r); },
      });
    });
    // Deliberately runs once. Re-running on a session change would restart a
    // flow the guardian is halfway through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id="obroot" ref={ref} aria-label="Set up your account" />;
}
