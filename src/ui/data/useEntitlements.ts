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
    try {
      setEntitlements(await getEntitlements());
      setState("ready");
    } catch {
      // Hold what we had, if anything. A failed read is not a lapsed account.
      setState("failed");
    }
  }, [guardian]);

  useEffect(() => { void reload(); }, [reload]);

  return { state, entitlements, reload };
}
