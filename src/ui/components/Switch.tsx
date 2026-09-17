/* ═══════════════════════════════════════════════════════════════════════════
   SWITCH

   Elongated Apple-like switch: a low, wide track with a rounded-rectangle
   white thumb, muted active green, no state glyphs, and immediate pointer-down
   feedback. The visual state is optimistic so the control never waits for a
   parent/network round trip before moving.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { hapticTick } from "../lib/haptics";

const TRACK_W = 58;
const TRACK_H = 26;
const THUMB_W = 32;
const THUMB_H = 22;
const INSET = 2;
const TRAVEL = TRACK_W - THUMB_W - INSET * 2;

const SWITCH_ON = "#55C86C";
const MOTION_MS = 120;
const MOTION_CURVE = "cubic-bezier(0.1, 0.9, 0.2, 1)";

export const SWITCH_METRICS = {
  TRACK_W,
  TRACK_H,
  THUMB_W,
  THUMB_H,
  INSET,
  TRAVEL,
};

export default function Switch({
  on,
  onChange,
  label,
  disabled,
  busy,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. The visible row label is usually separate. */
  label: string;
  disabled?: boolean;
  /** In flight — the ledger has not answered yet. */
  busy?: boolean;
}) {
  /*
   * Do not drive the thumb directly from the controlled `on` prop. Some switch
   * owners persist their value before feeding it back, which made a tap feel
   * delayed. `visualOn` flips immediately, then reconciles with the canonical
   * value when it arrives.
   */
  const [visualOn, setVisualOn] = useState(on);
  const [pressed, setPressed] = useState(false);
  const pointerActivated = useRef(false);
  const wasBusy = useRef(Boolean(busy));

  useEffect(() => {
    setVisualOn(on);
  }, [on]);

  /* If persistence finishes without changing `on`, treat that as a rejected
     optimistic update and restore the canonical state. */
  useEffect(() => {
    if (wasBusy.current && !busy) setVisualOn(on);
    wasBusy.current = Boolean(busy);
  }, [busy, on]);

  const activate = () => {
    if (disabled || busy) return;

    const next = !visualOn;
    setVisualOn(next);
    hapticTick();
    onChange(next);
  };

  return (
    <button
      type="button"
      className={"sw" + (visualOn ? " on" : "")}
      role="switch"
      aria-checked={visualOn}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      style={{ width: TRACK_W, height: TRACK_H }}
      onPointerDown={(event) => {
        if (disabled || busy || event.button !== 0) return;

        /* Pointer-down, not click: movement begins on the same interaction
           frame instead of waiting for pointer-up + a controlled state round
           trip. The following click is suppressed so one tap toggles once. */
        pointerActivated.current = true;
        setPressed(true);
        activate();
      }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => {
        if (pointerActivated.current) {
          pointerActivated.current = false;
          return;
        }

        /* Keyboard activation still follows the button's native click path. */
        activate();
      }}
    >
      <span
        className="tr"
        aria-hidden="true"
        style={{
          borderRadius: TRACK_H / 2,
          background: visualOn ? SWITCH_ON : "var(--track-off)",
          transition: `background ${MOTION_MS}ms ${MOTION_CURVE}`,
        }}
      />
      <span
        className="th"
        aria-hidden="true"
        style={{
          top: INSET,
          left: INSET,
          width: THUMB_W,
          height: THUMB_H,
          borderRadius: THUMB_H / 2,
          transform: `translateX(${visualOn ? TRAVEL : 0}px) scale(${pressed ? .97 : 1})`,
          transition: `transform ${MOTION_MS}ms ${MOTION_CURVE}`,
          willChange: "transform",
        }}
      />
    </button>
  );
}
