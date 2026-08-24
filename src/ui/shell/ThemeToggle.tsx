/* ═══════════════════════════════════════════════════════════════════════════
   APPEARANCE TOGGLE

   Shows the DESTINATION state, the way iOS and macOS do — the sun icon means
   "switch to light", not "you are in light".

   It writes through `setPref`, so the corner button and Settings → Appearance
   are the same setting rather than two that can disagree. Tapping it from
   "system" resolves to the opposite of whatever the OS currently is, which is
   what a person tapping a toggle means by it.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useApp } from "../data/AppProvider";
import { hapticTick } from "../lib/haptics";

export default function ThemeToggle() {
  const { prefs, setPref } = useApp();

  const resolved = prefs.theme === "system"
    ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : prefs.theme;

  const flip = () => {
    hapticTick();
    void setPref({ theme: resolved === "dark" ? "light" : "dark" });
  };

  return (
    <button
      type="button"
      className="themebtn"
      onClick={flip}
      aria-label={resolved === "dark" ? "Switch to light appearance" : "Switch to dark appearance"}
    >
      <svg className="ic-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.6 12H2.4M21.6 12h-2.2M6.8 6.8 5.2 5.2M18.8 18.8l-1.6-1.6M17.2 6.8l1.6-1.6M5.2 18.8l1.6-1.6" />
      </svg>
      <svg className="ic-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.6 8.6 0 1 0 10.2 10.2Z" />
      </svg>
    </button>
  );
}
