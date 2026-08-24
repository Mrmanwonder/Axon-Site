/* ═══════════════════════════════════════════════════════════════════════════
   IMPERATIVE BRIDGE

   Two globals that the not-yet-ported modules still reach for, re-published from
   the React side so those modules keep working unchanged while they are
   migrated one at a time.

   `src/onboarding.js` calls exactly two: `__masteryHaptic` and
   `__masteryRebindPress`. Both are optional-chained there, so a module that
   loads before this does not throw — it simply goes quiet, which is the correct
   failure for a haptic and merely cosmetic for a press spring.

   This is scaffolding with a defined end. It exists so each imperative surface
   can be replaced by a React one on its own commit instead of all at once, and
   the last removal should delete this file. Do not add to it: a new entry here
   is a new thing to remember to undo, and the old `__mastery*` bridge grew to
   ten entries exactly that way.
   ═══════════════════════════════════════════════════════════════════════════ */

import { spring, seed, SPRING } from "./spring";
import { hapticTick, hapticFirm } from "./haptics";

declare global {
  interface Window {
    __masteryHaptic?: { tick: () => void; firm: () => void };
    __masteryRebindPress?: (scope: ParentNode) => void;
  }
}

let bound = 0;

/** Bind the press spring to every `.press` inside a subtree that React did not
    render. Idempotent per element — a second call skips what it already did. */
function rebindPress(scope: ParentNode) {
  scope.querySelectorAll<HTMLElement>(".press").forEach((el) => {
    if (el.dataset.pressBound) return;
    el.dataset.pressBound = "1";
    const key = "legacy-press-" + (bound++);
    seed(key, 1);
    const go = (to: number) => spring(key, {
      to,
      ...SPRING.press,
      onUpdate: (p) => { el.style.transform = `scale(${p.toFixed(4)})`; },
    });
    el.addEventListener("pointerdown", () => go(.988));
    ["pointerup", "pointerleave", "pointercancel"].forEach((e) =>
      el.addEventListener(e, () => go(1)));
  });
}

export function installImperativeBridge() {
  window.__masteryHaptic = { tick: hapticTick, firm: hapticFirm };
  window.__masteryRebindPress = rebindPress;
}
