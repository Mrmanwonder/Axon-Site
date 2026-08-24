/* ═══════════════════════════════════════════════════════════════════════════
   SHEETS AS LOCATIONS

   An overlay held in component state is invisible to history, so the back
   button skips past it and leaves the screen underneath — the single most
   common way a web app feels wrong on a phone.

   Here a sheet is a search param on the current location. Opening pushes,
   dismissing pops. The screen underneath never unmounts, so it keeps its
   scroll position and refetches nothing.

   `openSheet` pushes; `closeSheet` calls navigate(-1) rather than removing the
   param, so the history stack stays the length the user expects — pushing and
   then replacing would leave a dead entry that back lands on.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { SheetName } from "../app/paths";

export function useSheet() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const open = params.get("sheet") as SheetName | null;
  const subject = params.get("for");

  const openSheet = useCallback(
    (name: SheetName, forId?: string) => {
      const next = new URLSearchParams(params);
      next.set("sheet", name);
      if (forId) next.set("for", forId);
      else next.delete("for");
      navigate({ search: `?${next}` });
    },
    [params, navigate],
  );

  const closeSheet = useCallback(() => navigate(-1), [navigate]);

  const isOpen = useCallback((name: SheetName) => open === name, [open]);

  return { open, subject, openSheet, closeSheet, isOpen };
}
