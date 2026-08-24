/* ═══════════════════════════════════════════════════════════════════════════
   HAPTICS

   navigator.vibrate only, always feature-detected, always wrapped — some
   browsers throw when called without a user gesture. Silently absent on
   anything without a motor, which is every desktop.

   Weight is matched to consequence: a light tick for selection, a firmer
   pulse for something that cannot be casually undone. Nothing at all for
   passive or read-only interaction — no buzz on scrolling, no buzz on row
   taps.
   ═══════════════════════════════════════════════════════════════════════════ */

const CAN_VIBRATE = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

function haptic(ms: number): void {
  if (!CAN_VIBRATE) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* no motor, or no gesture yet */
  }
}

/** Selection: tab bar, switches, the shutter. */
export const hapticTick = () => haptic(10);

/** Consequential: the consequence sheet's primary action, save to Library. */
export const hapticFirm = () => haptic(18);
