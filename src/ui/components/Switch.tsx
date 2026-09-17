/* ═══════════════════════════════════════════════════════════════════════════
   SWITCH

   Elongated Apple-like switch: a low, wide track with a rounded-rectangle
   white thumb, muted active green, no state glyphs, and an intentionally very
   fast snap between states. The thumb compresses only a touch while moving.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useId, useRef } from "react";
import { spring, seed, releaseSpring } from "../lib/spring";
import { hapticTick } from "../lib/haptics";

/* Reference geometry is deliberately much wider than it is tall. The white
   thumb is a capsule too — not a circle — and leaves a narrow inset around it. */
const TRACK_W = 58;
const TRACK_H = 26;
const THUMB_W = 32;
const THUMB_H = 22;
const INSET = 2;
const TRAVEL = TRACK_W - THUMB_W - INSET * 2;

/* Slightly restrained so the enabled state does not look neon in dark mode. */
const SWITCH_ON = "#55C86C";

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
  const key = "sw" + useId().replace(/:/g, "");
  const thumb = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const place = (p: number, v: number) => {
      if (!thumb.current) return;
      const x = p * TRAVEL;

      // Only a tiny compression while in flight. No squash/stretch wobble.
      const shrink = Math.min(.03, Math.abs(v) * .0016);
      const scale = 1 - shrink;
      thumb.current.style.transform =
        `translateX(${x.toFixed(2)}px) scale(${scale.toFixed(3)})`;
    };

    const reduced = document.documentElement.dataset.motion === "reduce"
      || matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (first.current || reduced) {
      first.current = false;
      seed(key, on ? 1 : 0);
      place(on ? 1 : 0, 0);
      return;
    }

    // Much faster than the rest of the shell motion: most of the travel is
    // completed in only a handful of frames, with effectively no visible
    // overshoot. This is what gives the control its sharp, tactile snap.
    spring(key, {
      to: on ? 1 : 0,
      stiffness: 1600,
      damping: 70,
      onUpdate: place,
    });
  }, [on, key]);

  useEffect(() => () => releaseSpring(key), [key]);

  return (
    <button
      type="button"
      className={"sw" + (on ? " on" : "")}
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      style={{ width: TRACK_W, height: TRACK_H }}
      onClick={() => {
        if (disabled) return;
        hapticTick();
        onChange(!on);
      }}
    >
      <span
        className="tr"
        aria-hidden="true"
        style={{
          borderRadius: TRACK_H / 2,
          background: on ? SWITCH_ON : "var(--track-off)",
          transition: "background 65ms ease-out",
        }}
      />
      <span
        className="th"
        ref={thumb}
        aria-hidden="true"
        style={{
          top: INSET,
          left: INSET,
          width: THUMB_W,
          height: THUMB_H,
          borderRadius: THUMB_H / 2,
        }}
      />
    </button>
  );
}
