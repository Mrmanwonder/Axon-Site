/* ═══════════════════════════════════════════════════════════════════════════
   APP SHELL

   The persistent frame. The nav, header and appearance toggle live here and do
   not remount across route changes — which is what lets the pill spring
   between destinations instead of being rebuilt at each one.

   Each screen renders into <Outlet /> inside its own scroll container. The
   container is keyed by pathname so a new screen starts at the top, rather
   than inheriting the previous screen's scroll offset.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TabNav from "./TabNav";
import Header from "./Header";
import ThemeToggle from "./ThemeToggle";
import { activeIndex, destinations } from "../app/nav";

export default function AppShell() {
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  const i = activeIndex(pathname);
  const title = i >= 0 ? destinations[i].label : "";

  // The header plate fades in once the screen's own heading has scrolled past.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setStuck(false);
    const onScroll = () => setStuck(el.scrollTop > 24);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <div className="app">
      <ThemeToggle />
      <Header title={title} stuck={stuck} />

      {/* `.on` is not decorative: system.css hides `.view` by default and shows
          only the active one, which is how the pre-port app switched screens.
          The router does that job now, so exactly one view exists at a time and
          it is always the visible one — but the class still has to be there or
          the screen renders into a display:none box. */}
      <div className="view on" ref={scrollRef} key={pathname}>
        <Outlet />
      </div>

      <TabNav />
    </div>
  );
}
