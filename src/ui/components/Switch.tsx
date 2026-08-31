/* ═══════════════════════════════════════════════════════════════════════════
   SWITCH

   A plain opaque thumb, not the glass lens the previous pass built. That was
   built from a text description; the actual reference — a screen recording of
   the stock iOS toggle — shows a solid white capsule with no tint, no
   refraction, no specular rim. It nearly fills its track, and the only thing
   remarkable about it is the elastic squash-stretch it does while crossing:
   the thumb stretches wide in the direction of travel and snaps back round on
   arrival.

   That motion is not new to this codebase. `TabNav` already derives a
   squash-stretch `transform: scale()` from a spring's velocity for the tab
   pill's travel; this is the same technique on a second control, not a new
   kind of motion. Only `transform` and `background` animate, which is what
   the design system's motion rules allow.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useId, useRef } from "react";
import { spring, seed, releaseSpring } from "../lib/spring";
import { hapticTick } from "../lib/haptics";

/* Track and thumb sizes match the reference's proportions (iOS's own
   51x31 / 27x27 with 2px inset) rather than the wider, shorter geometry the
   glass version invented. */
const TRACK_W = 51;
const THUMB_W = 27;
const INSET = 2;
const TRAVEL = TRACK_W - THUMB_W - INSET * 2;

export const SWITCH_METRICS = { TRACK_W, THUMB_W, INSET, TRAVEL };

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
      // Squash-stretch along the axis of travel, exactly as TabNav derives it
      // for the tab pill: proportional to velocity, clamped, and gone the
      // instant the spring settles because v is then 0.
      const s = Math.abs(Math.max(-.16, Math.min(.16, v * .1)));
      thumb.current.style.transform =
        `translateX(${x.toFixed(2)}px) scale(${(1 + s).toFixed(3)}, ${(1 - s).toFixed(3)})`;
    };

    const reduced = document.documentElement.dataset.motion === "reduce"
      || matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (first.current || reduced) {
      // Mount in position rather than animating from off, or every switch on
      // Settings slides on at once when the screen opens.
      first.current = false;
      seed(key, on ? 1 : 0);
      place(on ? 1 : 0, 0);
      return;
    }
    spring(key, { to: on ? 1 : 0, stiffness: 300, damping: 22, onUpdate: place });
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
      onClick={() => {
        if (disabled) return;
        hapticTick();
        onChange(!on);
      }}
    >
      <span className="tr" aria-hidden="true" />
      <span className="th" ref={thumb} aria-hidden="true">
        <span className="gI" />
      </span>
      <span className="gO" aria-hidden="true" />
    </button>
  );
}
