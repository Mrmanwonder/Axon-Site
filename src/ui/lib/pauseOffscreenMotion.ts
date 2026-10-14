/**
 * Pause decorative infinite animations when they cannot be seen (review #3).
 *
 * - Tab hidden: <html data-motion-paused> pauses every ambient animation.
 * - Scrolled offscreen: each ambient host gets [data-offscreen] via one
 *   shared IntersectionObserver.
 * CSS in performance.css turns both into animation-play-state: paused.
 */
const AMBIENT = ".avatar-ambient, .paperwork-visual, .ob-loop";

let started = false;
export function startPauseOffscreenMotion(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const root = document.documentElement;
  const sync = () => root.toggleAttribute("data-motion-paused", document.hidden);
  document.addEventListener("visibilitychange", sync);
  sync();

  if (typeof IntersectionObserver === "undefined" || typeof MutationObserver === "undefined") return;
  const seen = new WeakSet<Element>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.toggleAttribute("data-offscreen", !e.isIntersecting);
  });
  const scan = () => {
    document.querySelectorAll(AMBIENT).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      io.observe(el);
    });
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.body, { childList: true, subtree: true });
  scan();
}
