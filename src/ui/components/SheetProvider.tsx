/* ═══════════════════════════════════════════════════════════════════════════
   THE CONSEQUENCE SHEET

   `__axonOpenSheet` as a React provider. The copy rules make this a specific
   kind of surface and not a generic modal:

   · It never asks "are you sure?". It states what will happen and offers the
     action. That is the whole reason it exists — CLAUDE.md rules the
     reassurance prompt out, so the alternative has to carry its weight.
   · Destructive rows do not turn red. Red is the sign-out row and nothing else,
     so a delete action uses the ordinary primary treatment and lets the stated
     consequences do the work.
   · When the sheet offers choices, the primary button is hidden rather than left
     on screen: the choices *are* the action, and a second way to do the same
     thing is a dead control.

   Opening pushes a history entry, so the back button and the hardware back
   gesture close the sheet instead of leaving the screen under it. Dismissing by
   scrim or Cancel pops that entry, which keeps the stack the length the user
   expects.
   ═══════════════════════════════════════════════════════════════════════════ */

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hapticTick, hapticFirm } from "../lib/haptics";
import Dialog from "./Dialog";

export type SheetChoice = { label: string; value: string };

export type SheetConfig = {
  title: string;
  body?: string;
  /** [lead, rest] — the lead is emphasised, the rest explains it. */
  items?: [string, string][];
  choices?: SheetChoice[];
  input?: { id: string; label: string; placeholder?: string };
  primary?: string;
  onConfirm?: (value: string) => void | Promise<void>;
  onChoice?: (value: string) => void | Promise<void>;
};

type SheetValue = { openSheet: (cfg: SheetConfig) => void; closeSheet: () => void };

const Ctx = createContext<SheetValue | null>(null);

export function useSheetControls(): SheetValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSheetControls called outside SheetProvider");
  return v;
}

export function SheetProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  locationRef.current = location;
  const entries = useRef(new Map<string, { cfg: SheetConfig; base: string; trigger: HTMLElement | null }>());
  const pointerTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const capture = (event: PointerEvent) => { pointerTrigger.current = (event.target as HTMLElement).closest("button, a, input, [tabindex]"); };
    document.addEventListener("pointerdown", capture, true);
    return () => document.removeEventListener("pointerdown", capture, true);
  }, []);
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const token = new URLSearchParams(location.search).get("sheet");
  const entry = token ? entries.current.get(token) : undefined;
  const openSheet = useCallback((cfg: SheetConfig) => {
    const current = locationRef.current;
    const params = new URLSearchParams(current.search);
    const replacing = params.has("sheet");
    params.delete("sheet");
    const base = current.pathname + (params.size ? `?${params}` : "") + current.hash;
    const id = crypto.randomUUID();
    const focused = document.activeElement as HTMLElement | null;
    entries.current.set(id, { cfg, base, trigger: focused && focused !== document.body ? focused : pointerTrigger.current });
    params.set("sheet", id);
    setInputValue(""); setError(null); setCompleted(null);
    navigate({ pathname: current.pathname, search: `?${params}`, hash: current.hash }, { replace: replacing });
  }, [navigate]);
  const closeSheet = useCallback(() => { if (!flight.current) navigate(-1); }, [navigate]);
  useEffect(() => {
    if (completed && token === completed && entry) navigate(entry.base, { replace: true });
  }, [completed, token, entry, navigate]);
  const value = useMemo(() => ({ openSheet, closeSheet }), [openSheet, closeSheet]);
  const act = async (choice?: string) => {
    if (!entry || !token || flight.current) return;
    flight.current = true; setBusy(true); setError(null);
    choice === undefined ? hapticFirm() : hapticTick();
    try {
      if (choice === undefined) await entry.cfg.onConfirm?.(inputValue);
      else await entry.cfg.onChoice?.(choice);
      // Router navigation is a transition. Commit dismissal at the same
      // priority so it cannot race ahead and replace the destination.
      startTransition(() => setCompleted(token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This could not be completed. Try again.");
    } finally { flight.current = false; setBusy(false); }
  };
  const cfg = entry?.cfg;
  return <Ctx.Provider value={value}>
    {children}
    {cfg && <Dialog key={token} title={cfg.title} description={cfg.body} busy={busy} onClose={closeSheet} restoreFocus={entry.trigger}>
      {!!cfg.items?.length && <ul>{cfg.items.map(([lead, rest], index) => <li key={index}><span className="d" aria-hidden="true" /><span><b>{lead}</b> {rest}</span></li>)}</ul>}
      {cfg.input && <div className="sh-input"><label htmlFor={cfg.input.id}>{cfg.input.label}</label><input id={cfg.input.id} value={inputValue} placeholder={cfg.input.placeholder} disabled={busy} onChange={event => setInputValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void act(); } }} /></div>}
      {error && <p role="alert">{error}</p>}
      {cfg.choices && <div className="sh-choices">{cfg.choices.map(choice => <button type="button" className="sh-choice" key={choice.value} disabled={busy} onClick={() => void act(choice.value)}>{choice.label}</button>)}</div>}
      <div className="acts">
        {!cfg.choices && <button type="button" className="btn primary" disabled={busy} onClick={() => void act()}>{busy ? "Working…" : cfg.primary ?? "Confirm"}</button>}
        <button type="button" className="btn plain" disabled={busy} onClick={closeSheet}>Cancel</button>
      </div>
    </Dialog>}
  </Ctx.Provider>;
}
