import { useCallback, useEffect, useState } from "react";
import {
  activeAcademicShare,
  academicShareUrl,
  createAcademicShare,
  presentAcademicShare,
  revokeAcademicShare,
} from "./modules";
import type { AcademicShareState, CreatedAcademicShare } from "./modules";
import { useParentMode } from "./useParentMode";
import { useSheetControls } from "../components/SheetProvider";
import { useToast } from "../components/ToastProvider";

type ResourceType = "paper" | "question";

/**
 * Guardian-owned share flow for saved academic work.
 *
 * A raw bearer token exists only at creation time. Axon stores only its hash,
 * so an existing link can be revoked but cannot be reconstructed or silently
 * re-shared later. Replacing it is therefore a distinct guardian action.
 *
 * Web Share needs a transient user activation. Capability creation necessarily
 * takes a network round-trip, so a freshly-created link is presented in a
 * second sheet with an explicit "Share link" / "Copy link" tap.
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
  // undefined = status not established; null = established and not shared.
  const [active, setActive] = useState<AcademicShareState | null | undefined>(undefined);
  const { guard } = useParentMode();
  const { openSheet } = useSheetControls();
  const toast = useToast();

  useEffect(() => {
    if (!resourceId) {
      setActive(null);
      return;
    }
    let cancelled = false;
    setActive(undefined);
    activeAcademicShare({ resourceType, resourceId })
      .then((share) => { if (!cancelled) setActive(share); })
      // A failed read is not evidence that sharing is off. Keep the state
      // unknown and re-check before the guardian can create/revoke anything.
      .catch(() => { if (!cancelled) setActive(undefined); });
    return () => { cancelled = true; };
  }, [resourceId, resourceType]);

  const openCreatedShare = useCallback((created: CreatedAcademicShare, replaced: boolean) => {
    setActive({
      share_id: created.share_id,
      resource_type: created.resource_type,
      expires_at: created.expires_at,
    });
    const url = academicShareUrl(created.token);

    // Parent Mode or a previous share-management sheet may dismiss itself after
    // the guarded promise resolves. Queue this result sheet for the next task so
    // that dismissal cannot immediately close the sheet we just opened.
    setTimeout(() => {
      const native = typeof navigator.share === "function";
      openSheet({
        title: `Share this ${resourceType}`,
        body:
          `${replaced ? "The previous link has been stopped and replaced. " : ""}` +
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
            if (!stopped) throw new Error("This share could not be stopped. Try again.");
            setActive(null);
            toast("Sharing stopped.");
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
  }, [openSheet, resourceType, title, toast]);

  const createFreshShare = useCallback(async (replaced: boolean) => {
    if (!resourceId) return;
    try {
      const created = await createAcademicShare({
        resourceType,
        resourceId,
        expiresMinutes: 24 * 60,
      });
      openCreatedShare(created, replaced);
    } catch (error) {
      toast((error as Error).message || "The share link could not be created.", "warn");
    }
  }, [openCreatedShare, resourceId, resourceType, toast]);

  const requestShare = useCallback(() => {
    if (!resourceId) return;

    guard(async () => {
      let current = active;
      if (current === undefined) {
        try {
          current = await activeAcademicShare({ resourceType, resourceId });
          setActive(current);
        } catch {
          toast(`We can’t check whether this ${resourceType} is already shared right now.`, "warn");
          return;
        }
      }

      if (!current) {
        await createFreshShare(false);
        return;
      }

      const expiry = new Date(current.expires_at).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      openSheet({
        title: `This ${resourceType} is already shared`,
        body:
          `The current read-only link is active until ${expiry}. ` +
          "Axon stores only the link's hash, so the original link cannot be shown again. " +
          "You can replace it with a fresh 24-hour link or stop sharing immediately.",
        choices: [
          {
            label: "Replace link",
            value: "replace",
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
            const stopped = await revokeAcademicShare(current.share_id);
            if (!stopped) throw new Error("This share could not be stopped. Try again.");
            setActive(null);
            toast("Sharing stopped.");
            return;
          }
          if (choice === "replace") {
            await createFreshShare(true);
          }
        },
      });
    });
  }, [active, createFreshShare, guard, openSheet, resourceId, resourceType, toast]);

  return {
    activeShare: active ?? null,
    shareStatusKnown: active !== undefined,
    requestShare,
  };
}
