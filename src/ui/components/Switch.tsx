/* ═══════════════════════════════════════════════════════════════════════════
   SWITCH

   The design system's switch, with its spring-driven thumb.

   In the pre-port app every switch carried `data-managed` so index.html's
   generic `.sw` handler would skip the ones whose state belonged to the app
   layer. Two handlers on one switch race: whichever ran second read a class the
   first had already flipped, and that once turned a consent grant into a
   withdrawal. There is no generic handler any more and no attribute to
   remember — this component is the only thing that moves a thumb, and its state
   is always the caller's.

   It is a real `<button role="switch">`, so it is keyboard-operable and
   announces its own state, which the `<div role="switch" tabindex="0">` it
   replaces did not do reliably.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useId, useRef } from "react";
import { spring, seed, releaseSpring } from "../lib/spring";
import { hapticTick } from "../lib/haptics";

const TRAVEL = 22;

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
  const thumb = useRef<HTMLDivElement>(null);
  const key = "sw" + useId();
  const first = useRef(true);

  useEffect(() => {
    const place = (p: number) => {
      if (thumb.current) thumb.current.style.transform = `translateX(${p * TRAVEL}px)`;
    };
    if (first.current) {
      // Mount in position rather than animating from off, or every switch in
      // Settings slides on at once when the screen opens.
      first.current = false;
      seed(key, on ? 1 : 0);
      place(on ? 1 : 0);
      return;
    }
    spring(key, { to: on ? 1 : 0, stiffness: 340, damping: 30, onUpdate: place });
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
      <div className="tr" />
      <div className="th" ref={thumb}><span className="gI" /></div>
      <span className="gO" />
    </button>
  );
}
