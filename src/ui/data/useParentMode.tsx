/* ═══════════════════════════════════════════════════════════════════════════
   PARENT MODE, ON SCREEN

   `guard(action)` runs an action only once a parent has proved they are here.
   If the window is already open it runs straight away; if not it opens the
   unlock sheet and runs the action afterwards.

   Callback-shaped rather than a promise on purpose. The sheet has no dismissal
   callback, so a promise-based `await ensureParentMode()` would leave a pending
   promise behind every time someone swiped the sheet away — a leak per
   dismissal, in a screen a student is expected to poke at.

   ── This is a prompt, not a confirmation ─────────────────────────────────

   The copy rules forbid "are you sure?", and this is not one. Nothing here asks
   the person to ratify a decision or prove their resolve to the machine. It
   asks a different question — is the account holder present — and it asks it of
   a different person than the one holding the phone. The consequence sheet
   still does the explaining; this only decides who gets to see it.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback } from "react";
import { useSheetControls } from "../components/SheetProvider";
import { useToast } from "../components/ToastProvider";
import { useApp } from "./AppProvider";
import { parentModeState, sendParentCode, unlockWithCode } from "./modules";
import { hapticFirm } from "../lib/haptics";

export function useParentMode() {
  const { guardian } = useApp();
  const { openSheet } = useSheetControls();
  const toast = useToast();

  const guard = useCallback((action: () => void | Promise<void>) => {
    const contact = guardian?.contact ?? "";

    const run = () => { void action(); };

    const askForCode = () => {
      sendParentCode(contact)
        .then(() => {
          openSheet({
            title: "Check your messages",
            body: `We've sent a code to ${contact}. Enter it to continue.`,
            input: { id: "parent-mode-code", placeholder: "Code" },
            primary: "Continue",
            onConfirm: async (value) => {
              const r = await unlockWithCode(contact, value);
              if (r.outcome === "unlocked") return run();
              if (r.outcome === "cancelled") return;
              toast(r.outcome === "failed" ? r.message : "That didn't work.", "warn");
            },
          });
        })
        .catch((e) => toast((e as Error).message || "We couldn't send a code.", "warn"));
    };

    const offerUnlock = () => {
      /* One route, because passkeys were removed from the product: a code to
         the contact on the account. Deliberately not a contact typed in here —
         a parent proving they are present does not get to nominate where the
         proof goes, or the check is one text field away from proving nothing. */
      openSheet({
        title: "This one's for a parent",
        body:
          "Scanning, reviewing and insights are the student's. Consent, billing " +
          "and anything that removes data are the account holder's, so we check " +
          "you're the one here.",
        choices: [{ label: `Send a code to ${contact}`, value: "code" }],
        onChoice: async (choice) => {
          if (choice !== "code") return;
          hapticFirm();
          askForCode();
        },
      });
    };

    parentModeState()
      .then((state) => {
        if (state.fresh) return run();
        if (!state.amrPresent) {
          // The token carries no `amr` claim, so the database cannot tell when
          // anyone last signed in and refuses everything. That is our bug, not
          // a parent who has been away, and saying "confirm it's you" would
          // send them round a loop that cannot end.
          console.error("parent mode: session carries no amr claim; re-auth cannot be proved");
          toast("We can't confirm this right now. Signing out and back in should fix it.", "warn");
          return;
        }
        offerUnlock();
      })
      .catch(() => {
        // The freshness read is advisory — the real check is on every guarded
        // write. Offering the unlock is the useful thing to do when we cannot
        // read it: at worst the parent confirms when they did not have to.
        offerUnlock();
      });
  }, [guardian, openSheet, toast]);

  return { guard };
}
