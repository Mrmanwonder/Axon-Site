/* ═══════════════════════════════════════════════════════════════════════════
   SPRING

   Ported verbatim from reference/prototype.html. The integration is a fixed
   1/60 step rather than a delta-timed one, and the rest thresholds are the
   prototype's exact values — this is deliberate. Retuning it "properly" would
   change the feel of every press, tab and sheet in the app, and the feel is
   the thing the prototype was built to prove.

   Not a CSS transition, and not replaceable by one: the tab pill's velocity
   drives its own squash-and-stretch, which needs the live velocity term, and
   a re-target mid-flight has to inherit the current position and velocity
   rather than restarting from rest.

   Keyed rather than instance-based, again as in the prototype, so a component
   that unmounts and remounts across a route change picks the spring back up
   where it left off instead of snapping.
   ═══════════════════════════════════════════════════════════════════════════ */

type SpringState = { pos: number; vel: number };
type SpringLoop = { raf: number; state: SpringState };

const loops = new Map<string, SpringLoop>();

export type SpringOptions = {
  to: number;
  stiffness?: number;
  damping?: number;
  onUpdate: (pos: number, vel: number) => void;
};

export function spring(key: string, { to, stiffness = 200, damping = 25, onUpdate }: SpringOptions): void {
  const prev = loops.get(key);
  if (prev && prev.raf) cancelAnimationFrame(prev.raf);

  const s: SpringState = prev ? prev.state : { pos: to, vel: 0 };
  const dt = 1 / 60;

  const step = () => {
    s.vel += (-stiffness * (s.pos - to) - damping * s.vel) * dt;
    s.pos += s.vel * dt;
    onUpdate(s.pos, s.vel);

    if (Math.abs(s.vel) > .015 || Math.abs(s.pos - to) > .015) {
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
  press: { stiffness: 320, damping: 27 },
  tab: { stiffness: 210, damping: 24 },
} as const;
