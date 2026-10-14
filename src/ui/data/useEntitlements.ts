/* ═══════════════════════════════════════════════════════════════════════════
   THE BILLING STATE READ

   One RPC — `get_entitlements()` — read for the guardian's own account surface.

   The same rule the analytics reads hold applies here, for a sharper reason:
   "loading" is not "free", and a failed read is not "past due". Billing state
   is a claim about someone's money. Rendering "the last payment didn't go
   through" because a request timed out would be the most alarming lie this
   interface could tell, so a failure reports `failed` and the surface says it
   could not check — never a state.

   Entitlements gate nothing from here. Every gate is RLS, server-side (see
   `src/entitlements.js`). This exists so the account surface can EXPLAIN what
   the server has already decided.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { getEntitlements } from "./modules";
import type { Entitlements } from "./modules";
import { useApp } from "./AppProvider";
import { withDeadline } from "../lib/deadline";

// Settings showed "Plan: Checking…" until reload when this read hung (#301).
const ENTITLEMENTS_DEADLINE_MS = 12000;

export type BillingRead = {
  state: "loading" | "ready" | "failed";
  entitlements: Entitlements | null;
  reload: () => Promise<void>;
};

export function useEntitlements(): BillingRead {
  const { guardian } = useApp();
  const [state, setState] = useState<BillingRead["state"]>("loading");
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  const reload = useCallback(async () => {
    if (!guardian) {
      // Signed out is not a billing state at all. Report nothing rather than
      // a tier, so no caller can read "free" out of "we don't know who this is".
      setEntitlements(null);
      setState("ready");
      return;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        setEntitlements(await withDeadline(getEntitlements(), ENTITLEMENTS_DEADLINE_MS));
        setState("ready");
        return;
      } catch {
        // One quiet retry: a single slow or dropped request is common on a
        // phone and is not worth saying "we couldn't check" over.
      }
    }
    // Hold what we had, if anything. A failed read is not a lapsed account.
    setState("failed");
  }, [guardian]);

  useEffect(() => { void reload(); }, [reload]);
  // A failed read retries itself when the tab comes back, rather than staying
  // failed until a full reload.
  useEffect(() => {
    if (state !== "failed") return;
    const retry = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", retry);
    addEventListener("online", retry);
    return () => { document.removeEventListener("visibilitychange", retry); removeEventListener("online", retry); };
  }, [state, reload]);

  return { state, entitlements, reload };
}
