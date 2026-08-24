/* ═══════════════════════════════════════════════════════════════════════════
   APPEARANCE TOGGLE

   Dark is the default, not a fallback: students study at night. The stored
   preference wins over the OS setting, because a student may want this app
   dark without changing their whole phone.

   Shows the DESTINATION state, the way iOS and macOS do — the sun icon means
   "switch to light", not "you are in light".
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { hapticTick } from "../lib/haptics";

type Theme = "dark" | "light";
const KEY = "theme";

function initial(): Theme {
  const stored = localStorage.getItem(KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
    // The browser chrome follows the app, so the status bar doesn't sit at a
    // different brightness from the screen under it.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#000000" : "#F4F4F7");
  }, [theme]);

  const flip = () => {
    hapticTick();
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return (
    <button
      type="button"
      className="themebtn"
      onClick={flip}
      aria-label={theme === "dark" ? "Switch to light appearance" : "Switch to dark appearance"}
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
