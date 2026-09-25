import { useCallback, useEffect, useState } from "react";
import {
  activeAcademicShare,
  academicShareUrl,
  createAcademicShare,
  presentAcademicShare,
  revokeAcademicShare,
} from "./modules";
import type { AcademicShareState } from "./modules";
import { useParentMode } from "./useParentMode";
import { useSheetControls } from "../components/SheetProvider";
import { useToast } from "../components/ToastProvider";

type ResourceType = "paper" | "question";

/**
 * Guardian-owned share flow for saved academic work.
 *
 * Tapping Share first mints a fresh capability after Parent Mode. Only then do
 * we open a second sheet with a real "Share link" button. That second tap is
 * intentional: Web Share requires a transient user activation, which would be
 * lost if navigator.share() were called after the network round-trip that
 * creates the capability.
 */
export function useAcademicShare({
  resourceType,
  resourceId,
  title,
}: {
  resourceType: ResourceType;
  resourceId: string | null | undefined;
  title: string;
}) {
  const [active, setActive] = useState<AcademicShareState | null>(null);
  const { guard } = useParentMode();
  const { openSheet } = useSheetControls();
  const toast = useToast();

  useEffect(() => {
    if (!resourceId) {
      setActive(null);
      return;
    }
    let cancelled = false;
    activeAcademicShare({ resourceType, resourceId })
      .then((share) => { if (!cancelled) setActive(share); })
      // Share status is helpful furniture, never a reason the paper itself
      // should fail to open.
      .catch(() => { if (!cancelled) setActive(null); });
    return () => { cancelled = true; };
  }, [resourceId, resourceType]);

  const requestShare = useCallback(() => {
    if (!resourceId) return;
    const replacing = active != null;

    guard(() => createAcademicShare({
      resourceType,
      resourceId,
      expiresMinutes: 24 * 60,
    })
      .then((created) => {
        setActive({
          share_id: created.share_id,
          resource_type: created.resource_type,
          expires_at: created.expires_at,
        });
        const url = academicShareUrl(created.token);

        // Parent Mode's OTP sheet dismisses itself after the guarded promise
        // resolves. Queue this result sheet for the next task so that dismissal
        // cannot immediately close the sheet we just opened.
        setTimeout(() => {
          const native = typeof navigator.share === "function";
          openSheet({
            title: `Share this ${resourceType}`,
            body:
              `${replacing ? "A fresh link replaced the previous one. " : ""}` +
              `Anyone with this link can read only this saved ${resourceType}. ` +
              "It expires in 24 hours and does not include the student's profile, contact details, other papers or page-image URLs.",
            choices: [
              {
                label: native ? "Share link" : "Copy link",
                value: "send",
                emphasis: "primary",
              },
              {
                label: "Stop sharing",
                value: "revoke",
                emphasis: "secondary",
              },
            ],
            onChoice: async (choice) => {
              if (choice === "revoke") {
                const stopped = await revokeAcademicShare(created.share_id);
                if (stopped) {
                  setActive(null);
                  toast("Sharing stopped.");
                }
                return;
              }
              if (choice !== "send") return;

              const outcome = await presentAcademicShare({
                url,
                title,
                text: `A read-only ${resourceType} shared from Axon.`,
                preferNative: true,
              });
              if (outcome === "copied") toast("Share link copied.");
              if (outcome === "shared") toast("Share sheet opened.");
            },
          });
        }, 0);
      })
      .catch((error) => {
        toast((error as Error).message || "The share link could not be created.", "warn");
      }));
  }, [active, guard, openSheet, resourceId, resourceType, title, toast]);

  return { activeShare: active, requestShare };
}
