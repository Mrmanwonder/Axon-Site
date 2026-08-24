/* ═══════════════════════════════════════════════════════════════════════════
   SWITCH — the glass thumb

   The thumb is a lens, not a disc. It sits proud of the track, and the track
   refracts through it: the green bends at the thumb's edge instead of being
   covered by it.

   This is built from the material the design system already has. The nav's
   highlight is a real `feDisplacementMap` fed by `generateLensMap()`, and
   AGENTS.md is explicit that the refraction is the point and must not be
   swapped for a blur. Reusing that engine here keeps one kind of glass in the
   interface rather than adding a second one that only looks similar.

   Three things that keep it inside the project's constraints:

   · **The map is a pure function of size and is cached.** Every switch is the
     same size, so all of them share one generated canvas — the sixth switch on
     Settings costs nothing the first one did not already pay.

   · **Only `transform` animates.** The glass itself — the rim, the specular,
     the shadow — is static. Animating a filter or a shadow is what the motion
     rules forbid and what would actually cost frames on a mid-tier Android.

   · **State survives without colour.** The track still changes colour, but the
     thumb's position, the `I` glyph and the ring glyph all encode it too, and
     `role="switch"` with `aria-checked` carries it for anything that cannot see
     the glass at all. A glass thumb has less contrast against its track than a
     solid white one did, so the non-colour cues are doing real work here.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useId, useRef } from "react";
import { spring, seed, releaseSpring } from "../lib/spring";
import { hapticTick } from "../lib/haptics";
import { lensMapFor } from "../lib/lens";

/* Geometry, taken from the proportions of the reference rather than from the
   flat switch this replaces.

   The lens is large relative to its track and overhangs it generously — about a
   fifth of the track's width past the end, and a third of its height above and
   below. That is what makes it read as a piece of glass resting ON the track
   instead of a disc running inside it, and it is why the track is thinner than
   the control's own height: the glass needs room to sit proud of it.

   A big thumb means short travel. That is the look, not a compromise.

   Kept here rather than in CSS because the displacement map must be generated at
   exactly these dimensions — if the two disagree the refraction detaches from
   the glass and the whole illusion goes with it. */
const TRACK_W = 56;
const TRACK_H = 28;
const THUMB_W = 46;
const THUMB_H = 38;
const OVERHANG = 5;
const TRAVEL = TRACK_W - THUMB_W + OVERHANG * 2;

/** Corner radius the displacement map is built for. A capsule, so half the
    short side — the same relationship PILL_R has to the nav pill. */
const THUMB_R = THUMB_H / 2;

/** Published so the stylesheet and this file cannot drift on the numbers the
    lens depends on. */
export const SWITCH_METRICS = { TRACK_W, TRACK_H, THUMB_W, THUMB_H, OVERHANG, TRAVEL };

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
  const uid = useId().replace(/:/g, "");
  const filterId = `swlens-${uid}`;
  const key = `sw-${uid}`;

  const thumb = useRef<HTMLSpanElement>(null);
  const glass = useRef<HTMLSpanElement>(null);
  const fe = useRef<SVGFEImageElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const map = lensMapFor(THUMB_W, THUMB_H, THUMB_R);
    const el = fe.current;
    if (!el) return;
    el.setAttribute("width", String(THUMB_W));
    el.setAttribute("height", String(THUMB_H));
    el.setAttribute("href", map);
    el.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", map);
    if (glass.current) glass.current.style.filter = `url(#${filterId})`;
  }, [filterId]);

  useEffect(() => {
    /* p runs 0 -> 1. The thumb and the displacement map travel together; if
       they ever disagree the refraction detaches from the glass and the whole
       illusion goes with it. */
    const place = (p: number) => {
      const x = -OVERHANG + p * TRAVEL;
      if (thumb.current) thumb.current.style.transform = `translateX(${x.toFixed(2)}px)`;
      // The map's own box is in the filtered layer's coordinates, which start
      // at the track's edge rather than the thumb's.
      fe.current?.setAttribute("x", String(x));
    };

    const reduced = document.documentElement.dataset.motion === "reduce"
      || matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (first.current || reduced) {
      // Mount in position rather than animating from off, or every switch on
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
      {/* The track, and the layer the thumb refracts. Clipped to the capsule so
          the displacement cannot smear past the switch's own edge. */}
      <span className="swglass" ref={glass} aria-hidden="true">
        <span className="tr" />
      </span>

      <span className="th" ref={thumb} aria-hidden="true">
        <span className="gI" />
      </span>
      <span className="gO" aria-hidden="true" />

      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <filter
            id={filterId}
            x="-20%" y="-40%" width="140%" height="180%"
            colorInterpolationFilters="sRGB"
          >
            {/* Neutral grey is "no displacement", so everything outside the
                thumb's own box passes through untouched. */}
            <feFlood floodColor="rgb(128,128,128)" result="neutral" />
            <feImage ref={fe} x="0" y="0" width={THUMB_W} height={THUMB_H} result="lensmap" preserveAspectRatio="none" />
            <feMerge result="dmap">
              <feMergeNode in="neutral" />
              <feMergeNode in="lensmap" />
            </feMerge>
            {/* Scale is bounded by the overhang. Push it further and the lens
                samples past the clipped track, pulling transparency into the
                green and tearing the edge — which reads as an artifact rather
                than as refraction. */}
            <feDisplacementMap in="SourceGraphic" in2="dmap" scale="8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
    </button>
  );
}
