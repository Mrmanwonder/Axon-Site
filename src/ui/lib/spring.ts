/* ═══════════════════════════════════════════════════════════════════════════
   SPRING

   Velocity remains part of the public contract because the tab pill uses it
   for squash-and-stretch and a re-target mid-flight inherits the current
   position/velocity. The shipping difference from the prototype is a hard
   duration ceiling: no interaction is allowed to keep visibly settling after
   the rest of the interface has already responded.
   ═══════════════════════════════════════════════════════════════════════════ */

type SpringState = { pos: number; vel: number };
type SpringLoop = { raf: number; state: SpringState };

const loops = new Map<string, SpringLoop>();

export type SpringOptions = {
  to: number;
  stiffness?: number;
  damping?: number;
  /** Absolute visible-motion budget for this spring. */
  maxDurationMs?: number;
  onUpdate: (pos: number, vel: number) => void;
};

export function spring(
  key: string,
  {
    to,
    stiffness = 260,
    damping = 28,
    maxDurationMs = 280,
    onUpdate,
  }: SpringOptions,
): void {
  const prev = loops.get(key);
  if (prev && prev.raf) cancelAnimationFrame(prev.raf);

  const s: SpringState = prev ? prev.state : { pos: to, vel: 0 };
  const dt = 1 / 60;
  const startedAt = performance.now();

  const step = (now: number) => {
    s.vel += (-stiffness * (s.pos - to) - damping * s.vel) * dt;
    s.pos += s.vel * dt;
    onUpdate(s.pos, s.vel);

    const stillMoving = Math.abs(s.vel) > .015 || Math.abs(s.pos - to) > .015;
    const insideBudget = now - startedAt < maxDurationMs;
    if (stillMoving && insideBudget) {
      loops.set(key, { raf: requestAnimationFrame(step), state: s });
    } else {
      s.pos = to;
      s.vel = 0;
      onUpdate(to, 0);
      loops.set(key, { raf: 0, state: s });
    }
  };

  loops.set(key, { raf: requestAnimationFrame(step), state: s });
}

/** Place a spring at a position without animating to it. */
export function seed(key: string, pos: number): void {
  loops.set(key, { raf: 0, state: { pos, vel: 0 } });
}

/** Stop a spring and forget it. Call on unmount so a stale rAF can't outlive
    the element it was writing transforms to. */
export function releaseSpring(key: string): void {
  const l = loops.get(key);
  if (l && l.raf) cancelAnimationFrame(l.raf);
  loops.delete(key);
}

/** Physics constants, kept next to the engine rather than in each caller. */
export const SPRING = {
  press: { stiffness: 420, damping: 34, maxDurationMs: 140 },
  tab: { stiffness: 360, damping: 32, maxDurationMs: 260 },
} as const;
