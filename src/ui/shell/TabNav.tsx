/* ═══════════════════════════════════════════════════════════════════════════
   TAB NAV — the glass, the lens and the pill

   One DOM serves both the bottom tab bar and the left rail. Everything below
   is axis-agnostic: x, y, w and h all come from measurement, so the same code
   drives horizontal travel on phones and vertical travel on tablets.

   Three things AGENTS.md warns about, all preserved here:

   · The highlight is a real feDisplacementMap. Not backdrop-filter. The
     refraction is the point of the design.

   · Geometry is MEASURED, never computed from division math. Flexbox rounds
     each item's width independently, so arithmetic drifts a pixel or two and
     the lens stops agreeing with the icons.

   · Measurement is against #refractlayer, not the bar. The refract layer is
     the filter's own reference box, so it is the only origin where the pill,
     the lens map and the icons agree.

   ── The React-specific hazard ──
   In the prototype, pick() measured synchronously because the DOM was already
   laid out. Here the active tab changes as a result of a route change, so the
   measurement has to happen after React has committed and the browser has laid
   out — useLayoutEffect, not useEffect. With useEffect the first frame of the
   pill's travel is computed against the previous layout, which reads as a
   one-frame jump on exactly the interaction the design spends most of its
   motion budget on.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { avatarStyleFor, initialFor } from "../data/modules";
import { destinations, activeIndex } from "../app/nav";
import { lensMapFor, PILL_R } from "../lib/lens";
import { spring, seed, releaseSpring, SPRING } from "../lib/spring";
import { hapticTick } from "../lib/haptics";
import PressBox from "../components/PressBox";

type Rect = { x: number; y: number; w: number; h: number };

export default function TabNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = Math.max(0, activeIndex(pathname));

  /* The Settings tab wears the student's face rather than an icon. It used to
     wear a hardcoded capital "M" — not the student's initial, not their
     gradient, just a letter left over from the prototype, which meant every
     account in the world had the same nav avatar. Both this and the disc at
     the top of Settings read `avatarStyleFor` now, so there is one definition
     of what a student looks like and no way for the two to disagree. */
  const { student, guardian } = useApp();
  const avatar = avatarStyleFor(student);
  const initial = initialFor(student?.first_name ?? guardian?.name);

  const layerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const feRef = useRef<SVGFEImageElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const offsets = useRef<Rect[]>([]);
  /* The spring animates between tab INDICES and interpolates the measured
     rects, rather than animating x/y directly — so travel across a rail and
     travel across a bar are the same motion in different axes. */
  const settled = useRef(current);

  const measureTabs = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const base = layer.getBoundingClientRect();
    offsets.current = tabRefs.current.filter(Boolean).map((t) => {
      const r = t!.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    });
  }, []);

  const lerpOffset = useCallback((p: number): Rect => {
    const o = offsets.current;
    const i0 = Math.max(0, Math.min(o.length - 1, Math.floor(p)));
    const i1 = Math.max(0, Math.min(o.length - 1, Math.ceil(p)));
    const t = p - i0;
    const a = o[i0];
    const b = o[i1];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      w: a.w + (b.w - a.w) * t,
      h: a.h + (b.h - a.h) * t,
    };
  }, []);

  const paintLens = useCallback((o: Rect) => {
    const fe = feRef.current;
    if (!fe || !o.w || !o.h) return;
    const map = lensMapFor(o.w, o.h, PILL_R);
    fe.setAttribute("width", String(o.w));
    fe.setAttribute("height", String(o.h));
    fe.setAttribute("href", map);
    fe.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", map);
  }, []);

  const applyPill = useCallback((o: Rect, sx = 1, sy = 1) => {
    const p = pillRef.current;
    const g = glowRef.current;
    const fe = feRef.current;
    if (!p || !g || !fe) return;
    const t = `translate(${o.x.toFixed(2)}px,${o.y.toFixed(2)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    p.style.width = g.style.width = o.w + "px";
    p.style.height = g.style.height = o.h + "px";
    p.style.transform = g.style.transform = t;
    fe.setAttribute("x", String(o.x));
    fe.setAttribute("y", String(o.y));
  }, []);

  /** Re-place the pill with no animation. Used on mount, on resize, and on
      every breakpoint crossing — the map is cached by size, so regenerating
      it freely is cheap, and NOT regenerating it leaves a stale bevel. */
  const layoutTabs = useCallback(() => {
    measureTabs();
    const o = offsets.current[settled.current];
    if (!o || !o.w || !o.h) return;
    paintLens(o);
    applyPill(o);
    if (layerRef.current) layerRef.current.style.filter = "url(#lensTab)";
  }, [measureTabs, paintLens, applyPill]);

  // Mount: seed the spring where the current route already is, so a deep link
  // paints the pill in place rather than flying it in from Home.
  useLayoutEffect(() => {
    seed("tab", current);
    settled.current = current;
    layoutTabs();
    return () => releaseSpring("tab");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change: spring the pill to the new destination.
  useLayoutEffect(() => {
    if (settled.current === current) return;
    settled.current = current;

    measureTabs();
    const target = offsets.current[current];
    if (!target) return;
    paintLens(target);

    const vertical = window.matchMedia("(min-width:768px)").matches;
    spring("tab", {
      to: current,
      ...SPRING.tab,
      onUpdate: (p, v) => {
        const o = lerpOffset(p);
        // squash-and-stretch along the axis of travel: X in the bar, Y in the
        // rail. Needs live velocity, which is why this is not a CSS transition.
        const a = Math.abs(Math.max(-.055, Math.min(.055, v * .011)));
        applyPill(o, vertical ? 1 - a * .5 : 1 + a, vertical ? 1 + a : 1 - a * .5);
      },
    });
  }, [current, measureTabs, paintLens, applyPill, lerpOffset]);

  // Resize and breakpoint crossings both change the pill's dimensions, and the
  // displacement map is a function of those dimensions.
  useEffect(() => {
    const onResize = () => layoutTabs();
    window.addEventListener("resize", onResize);
    const rail = window.matchMedia("(min-width:768px)");
    const railLg = window.matchMedia("(min-width:1024px)");
    rail.addEventListener("change", onResize);
    railLg.addEventListener("change", onResize);
    // The face loads block-display; when it swaps in, label widths change and
    // the rail's tab rects move.
    document.fonts?.ready.then(onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      rail.removeEventListener("change", onResize);
      railLg.removeEventListener("change", onResize);
    };
  }, [layoutTabs]);

  const go = (path: string) => {
    hapticTick();
    navigate(path);
  };

  return (
    <div className="tabdock">
      <div className="tabbar">
        <div className="refractlayer" ref={layerRef} role="tablist" aria-label="Sections">
          <div className="pill" ref={pillRef} aria-hidden="true" />

          {destinations.map((d, i) => (
            <PressBox
              key={d.path}
              as="button"
              type="button"
              className={"tab" + (i === current ? " on" : "")}
              role="tab"
              aria-selected={i === current}
              aria-current={i === current ? "page" : undefined}
              aria-label={d.label}
              ref={(el: HTMLButtonElement | null) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => go(d.path)}
            >
              {d.icon ? (
                <svg className={d.solid ? "solid" : undefined} viewBox="0 0 24 24" aria-hidden="true">
                  {d.icon}
                </svg>
              ) : (
                <div
                  className="pfp"
                  aria-hidden="true"
                  data-preset={avatar.preset}
                  style={{ background: avatar.background, color: avatar.color }}
                >
                  {initial}
                </div>
              )}
              <span className="lbl">{d.label}</span>
            </PressBox>
          ))}
        </div>

        <div className="lensglow" ref={glowRef} aria-hidden="true" />
        <div className="rim" aria-hidden="true" />
      </div>

      {/* The filter lives next to the thing it filters rather than at the
          document root, so the nav is self-contained. feImage's href is
          rewritten imperatively above; React must not own that attribute. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter
            id="lensTab"
            x="-15%"
            y="-15%"
            width="130%"
            height="130%"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodColor="rgb(128,128,128)" result="neutral" />
            <feImage ref={feRef} x="0" y="0" width="10" height="10" result="lensmap" preserveAspectRatio="none" />
            <feMerge result="dmap">
              <feMergeNode in="neutral" />
              <feMergeNode in="lensmap" />
            </feMerge>
            <feDisplacementMap in="SourceGraphic" in2="dmap" scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
