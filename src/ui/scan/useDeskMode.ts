import { useEffect, useState } from "react";

/**
 * A laptop or desktop: a wide screen, a precise pointer that can hover, and no
 * touch screen. Those get the import screen instead of a webcam viewfinder: a
 * webcam looks at the student's face, not at a paper on the desk.
 *
 * Tablets keep the camera. An iPad with a trackpad or an Android tablet with a
 * stylus reports a fine, hovering pointer, so the media query alone sent them
 * to the laptop screen (owner, 4 Oct 2026). Touch points alone cannot tell a
 * tablet from a touch-screen Windows laptop (whose only camera faces the
 * student), so tablets are named: Android, iPad, and iPadOS (which reports
 * itself as a Mac with touch points; real Macs have none).
 */
const QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";

export function isTablet(ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
  touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0): boolean {
  if (/Android|iPad|Tablet|Silk|Kindle/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && touchPoints > 1;
}

export function isDesk(): boolean {
  if (typeof matchMedia !== "function") return false;
  return !isTablet() && matchMedia(QUERY).matches;
}

export function useDeskMode(): boolean {
  const [desk, setDesk] = useState(isDesk);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(QUERY);
    const sync = () => setDesk(isDesk());
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return desk;
}
