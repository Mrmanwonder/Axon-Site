/* ═══════════════════════════════════════════════════════════════════════════
   THE CONSEQUENCE SHEET

   Choice rows are neutral by default. Callers may explicitly mark one choice as
   primary or secondary when the two actions do not have equal product weight;
   existing sheets keep their current appearance because emphasis is opt-in.
   ═══════════════════════════════════════════════════════════════════════════ */

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hapticTick, hapticFirm } from "../lib/haptics";
import Dialog from "./Dialog";

export type SheetChoice = {
  label: string;
  value: string;
  emphasis?: "primary" | "secondary";
};

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
      {cfg.choices && <div className="sh-choices">{cfg.choices.map(choice => <button type="button" className={"sh-choice" + (choice.emphasis ? ` ${choice.emphasis}` : "")} data-emphasis={choice.emphasis} key={choice.value} disabled={busy} onClick={() => void act(choice.value)}>{choice.label}</button>)}</div>}
      <div className="acts">
        {!cfg.choices && <button type="button" className="btn primary" disabled={busy} onClick={() => void act()}>{busy ? "Working…" : cfg.primary ?? "Confirm"}</button>}
        <button type="button" className="btn plain" disabled={busy} onClick={closeSheet}>Cancel</button>
      </div>
    </Dialog>}
  </Ctx.Provider>;

}
