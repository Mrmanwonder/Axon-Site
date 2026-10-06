import { useEffect } from "react";
import type { RefObject } from "react";

/*
 * Keep a bottom sheet above the on-screen keyboard.
 *
 * A sheet is attached to the bottom of the layout viewport. On Android Chrome
 * (whose default is to resize only the visual viewport) and on iOS Safari, the
 * keyboard covers the bottom of the layout viewport without moving it, so a
 * sheet with a text field ended up underneath the keyboard. The visual viewport
 * is the part of the page the student can actually see; whatever of the layout
 * viewport lies below it is keyboard. That height is published as `--kb` (the
 * sheet's bottom offset) and the visible height as `--vvh` (the sheet's height
 * cap, so a tall sheet scrolls inside instead of running off the top).
 *
 * The offset is a plain position change, never animated: motion stays on
 * transform and opacity (Axon.md §6).
 */

export type ViewportSample = {
  /** Height of the layout viewport, which the keyboard does not resize. */
  layoutHeight: number;
  /** visualViewport.height: what is left visible above the keyboard. */
  viewportHeight: number;
  /** visualViewport.offsetTop: how far the visible area is panned down. */
  offsetTop: number;
  /** visualViewport.scale: pinch-zoom, which also shrinks the visual viewport. */
  scale?: number;
};

/** Below this the difference is browser chrome settling, not a keyboard. */
const NOISE_PX = 1;

/** Pixels of the layout viewport hidden below the visible area. */
export function keyboardInset({ layoutHeight, viewportHeight, offsetTop, scale = 1 }: ViewportSample): number {
  if (![layoutHeight, viewportHeight, offsetTop].every(Number.isFinite)) return 0;
  // A pinch-zoomed page has a small visual viewport with no keyboard at all;
  // lifting the sheet then would strand it mid-screen.
  if (Math.abs(scale - 1) > 0.01) return 0;
  const hidden = layoutHeight - (viewportHeight + offsetTop);
  return hidden > NOISE_PX ? Math.round(hidden) : 0;
}

function sample(): ViewportSample | null {
  const viewport = window.visualViewport;
  if (!viewport) return null;
  return {
    // clientHeight is the layout viewport and is not shrunk by the iOS
    // keyboard; innerHeight is the fallback where it reads 0.
    layoutHeight: document.documentElement.clientHeight || window.innerHeight,
    viewportHeight: viewport.height,
    offsetTop: viewport.offsetTop,
    scale: viewport.scale,
  };
}

/**
 * While mounted, keep `--kb` and `--vvh` on `ref`'s element in step with the
 * visual viewport. Does nothing where `visualViewport` is not available.
 */
export function useKeyboardInset(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    const viewport = window.visualViewport;
    if (!element || !viewport) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const now = sample();
      if (!now) return;
      const inset = keyboardInset(now);
      element.style.setProperty("--kb", `${inset}px`);
      // Only cap the height to what is visible while a keyboard takes space;
      // otherwise (including pinch-zoom) the sheet keeps its normal cap.
      if (inset) element.style.setProperty("--vvh", `${Math.round(now.viewportHeight)}px`);
      else element.style.removeProperty("--vvh");
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
    apply();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
      element.style.removeProperty("--kb");
      element.style.removeProperty("--vvh");
    };
  }, [ref]);
}
