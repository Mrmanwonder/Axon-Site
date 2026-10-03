import { useEffect, useState } from "react";

/**
 * A laptop or desktop: a precise pointer that can hover, on a wide screen.
 * Those get the import screen instead of a webcam viewfinder. A webcam looks
 * at the student's face, not at a paper on the desk, so it is not offered.
 * Phones and tablets (coarse pointer) keep the camera.
 */
const QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";

export function useDeskMode(): boolean {
  const [desk, setDesk] = useState(() =>
    typeof matchMedia === "function" ? matchMedia(QUERY).matches : false);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(QUERY);
    const sync = () => setDesk(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return desk;
}
