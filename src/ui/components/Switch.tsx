/* ═══════════════════════════════════════════════════════════════════════════
   SWITCH

   Compact Apple-like switch: a plain white thumb, a slightly muted active
   green, no state glyphs, and a very fast travel animation. While crossing,
   the thumb scales down only a few percent and snaps back to full size as the
   spring settles.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useId, useRef } from "react";
import { spring, seed, releaseSpring } from "../lib/spring";
import { hapticTick } from "../lib/haptics";

/* Keep the familiar iOS proportions while reducing the overall control size. */
const TRACK_W = 45;
const TRACK_H = 27;
const THUMB_W = 23;
const INSET = 2;
const TRAVEL = TRACK_W - THUMB_W - INSET * 2;

/* Softer than the design-system positive green so the switch does not read as
   fluorescent against the dark settings surface. */
const SWITCH_ON = "#55C86C";

export const SWITCH_METRICS = { TRACK_W, TRACK_H, THUMB_W, INSET, TRAVEL };

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

      // The reference does not visibly stretch. It compresses by only a few
      // percent during travel, then is perfectly round again on arrival.
      const shrink = Math.min(.045, Math.abs(v) * .0065);
      const scale = 1 - shrink;
      thumb.current.style.transform =
        `translateX(${x.toFixed(2)}px) scale(${scale.toFixed(3)})`;
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

    // Deliberately much quicker than the tab/navigation springs. The thumb is
    // nearly at the opposite edge in ~100ms and settles without a visible
    // bounce, which gives the switch the crisp Apple-like tap response.
    spring(key, { to: on ? 1 : 0, stiffness: 560, damping: 34, onUpdate: place });
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
          transition: "background 90ms ease-out",
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
          height: THUMB_W,
          borderRadius: "50%",
        }}
      />
    </button>
  );
}
