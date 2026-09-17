/* ═══════════════════════════════════════════════════════════════════════════
   THE CONSEQUENCE SHEET

   Choice rows are neutral by default. Callers may explicitly mark one choice as
   primary or secondary when the two actions do not have equal product weight;
   existing sheets keep their current appearance because emphasis is opt-in.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import { spring, seed, releaseSpring } from "../lib/spring";
import { hapticTick, hapticFirm } from "../lib/haptics";
import PressBox from "./PressBox";

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
  input?: { id: string; placeholder?: string };
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

const SHEET_STATE = "axon.sheet";

export function SheetProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<SheetConfig | null>(null);
  const [inputValue, setInputValue] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const key = "sheet" + useId();
  const pushed = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const place = useCallback((p: number) => {
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${(p * 115).toFixed(2)}%)`;
  }, []);

  const openSheet = useCallback((next: SheetConfig) => {
    setCfg(next);
    setInputValue("");
    seed(key, 1);
    place(1);
    if (!pushed.current) {
      history.pushState({ [SHEET_STATE]: true }, "");
      pushed.current = true;
    }
    requestAnimationFrame(() => {
      spring(key, { to: 0, stiffness: 230, damping: 26, onUpdate: place });
    });
  }, [key, place]);

  const dismiss = useCallback(() => {
    spring(key, {
      to: 1,
      stiffness: 230,
      damping: 26,
      onUpdate: (p) => {
        place(p);
        if (p > .98) setCfg(null);
      },
    });
  }, [key, place]);

  const closeSheet = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else {
      dismiss();
    }
  }, [dismiss]);

  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      dismiss();
    };
    addEventListener("popstate", onPop);
    return () => {
      removeEventListener("popstate", onPop);
      releaseSpring(key);
    };
  }, [dismiss, key]);

  useEffect(() => {
    if (!cfg) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    addEventListener("keydown", onKey);
    (cfg.input ? inputRef.current : sheetRef.current)?.focus();
    return () => removeEventListener("keydown", onKey);
  }, [cfg, closeSheet]);

  const value = useMemo(() => ({ openSheet, closeSheet }), [openSheet, closeSheet]);

  const confirm = () => {
    hapticFirm();
    const fn = cfg?.onConfirm;
    const v = inputValue;
    closeSheet();
    void fn?.(v);
  };

  const choose = (v: string, emphasis?: SheetChoice["emphasis"]) => {
    if (emphasis === "primary") hapticFirm();
    else hapticTick();
    const fn = cfg?.onChoice;
    closeSheet();
    void fn?.(v);
  };

  return (
    <Ctx.Provider value={value}>
      {children}

      <div
        className={"scrim" + (cfg ? " on" : "")}
        onClick={closeSheet}
        aria-hidden="true"
      />

      {cfg && (
        <div
          className="sheet"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={cfg.title}
          tabIndex={-1}
        >
          <h4>{cfg.title}</h4>
          {cfg.body && <div className="body">{cfg.body}</div>}

          {!!cfg.items?.length && (
            <ul>
              {cfg.items.map(([lead, rest], i) => (
                <li key={i}>
                  <span className="d" aria-hidden="true" />
                  <span><b>{lead}</b> {rest}</span>
                </li>
              ))}
            </ul>
          )}

          {cfg.input && (
            <div className="sh-input">
              <input
                ref={inputRef}
                id={cfg.input.id}
                placeholder={cfg.input.placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
              />
            </div>
          )}

          {cfg.choices && (
            <div className="sh-choices">
              {cfg.choices.map((c) => (
                <PressBox
                  as="button"
                  type="button"
                  key={c.value}
                  className={"sh-choice" + (c.emphasis ? ` ${c.emphasis}` : "")}
                  data-emphasis={c.emphasis}
                  onClick={() => choose(c.value, c.emphasis)}
                >
                  {c.label}
                </PressBox>
              ))}
            </div>
          )}

          <div className="acts">
            {!cfg.choices && (
              <>
                <PressBox as="button" type="button" className="btn primary" onClick={confirm}>
                  {cfg.primary ?? "Confirm"}
                </PressBox>
                <button type="button" className="btn plain" onClick={closeSheet}>Cancel</button>
              </>
            )}
            {cfg.choices && (
              <button type="button" className="btn plain" onClick={closeSheet}>Cancel</button>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
