/* ═══════════════════════════════════════════════════════════════════════════
   TOAST

   Reuses the draft-toast furniture rather than inventing a new surface.

   `tone` is neutral or warn — never an error red. Amber carries attention here
   as it does everywhere else; red is the sign-out row alone, and a failed save
   is not a rebuke.

   Announced with role="status" and aria-live="polite" so a screen reader hears
   it without being interrupted mid-sentence.
   ═══════════════════════════════════════════════════════════════════════════ */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export type Tone = "neutral" | "warn";
type ToastValue = (message: string, tone?: Tone) => void;

const Ctx = createContext<ToastValue | null>(null);

export function useToast(): ToastValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast called outside ToastProvider");
  return v;
}

const DWELL = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback<ToastValue>((text, tone = "neutral") => {
    setMsg({ text, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), DWELL);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        id="appToast"
        className={msg ? "show" : undefined}
        data-tone={msg?.tone ?? "neutral"}
        role="status"
        aria-live="polite"
      >
        <div className="t1">{msg?.text ?? ""}</div>
      </div>
    </Ctx.Provider>
  );
}
