/* ═══════════════════════════════════════════════════════════════════════════
   APP SHELL

   The persistent frame. The nav and header live here and do not remount across
   route changes — which is what lets the navigation pill spring between
   destinations instead of being rebuilt at each one.

   Each screen renders into <Outlet /> inside its own scroll container. The
   container is keyed by pathname so a new screen starts at the top, rather
   than inheriting the previous screen's scroll offset.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useApp } from "../data/AppProvider";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigation } from "react-router-dom";
import TabNav from "./TabNav";
import Header from "./Header";
import { activeIndex, destinations } from "../app/nav";
import { paths } from "../app/paths";
import { preloadMainRoute } from "../app/mainRouteModules";
import ReviewSheet from "../scan/ReviewSheet";
import DocumentMeta from "../components/DocumentMeta";
import SkeletonLoader from "../components/SkeletonLoader";
import { skeletonVariantForPath } from "../components/PageSkeleton";

export default function AppShell() {
  const { profileStale } = useApp();
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const nextPath = navigation.location?.pathname;
  const changingPage = navigation.state === "loading" && !!nextPath && nextPath !== pathname;
  const displayedPath = changingPage ? nextPath! : pathname;
  const scrollRef = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  const i = activeIndex(displayedPath);
  const title = i >= 0 ? destinations[i].label : "";

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!navigator.onLine || connection?.saveData) return;
    // Warm the small reading/settings routes after the first screen has had
    // time to paint. Scan stays intent-only, including on touch devices.
    const warm = () => {
      for (const path of [paths.home, paths.library, paths.insights, paths.settings]) preloadMainRoute(path);
    };
    const timer = window.setTimeout(warm, 800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.focus();
  }, [pathname, title]);

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
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <DocumentMeta title={`${pathname.startsWith("/scan/review/") ? "Review paper" : title || "Axon"} · Axon`} description="Your private Axon study workspace." path={pathname} noIndex />

      <Header title={title} stuck={stuck} />

      {/* `.on` is not decorative: system.css hides `.view` by default and shows
          only the active one, which is how the pre-port app switched screens.
          The router does that job now, so exactly one view exists at a time and
          it is always the visible one — but the class still has to be there or
          the screen renders into a display:none box. */}
      <main
        id="main-content" tabIndex={-1}
        className="view on"
        data-screen={i >= 0 ? destinations[i].label.toLowerCase() : undefined}
        ref={scrollRef}
        key={pathname}
      >
        {profileStale && <p role="status" className="subnote">Offline profile. Last available data.</p>}
        {changingPage ? <SkeletonLoader label={`Opening ${title || "page"}`} variant={skeletonVariantForPath(displayedPath)} /> : <Outlet />}
      </main>

      {/* Stage 9 lives above the shell: it is a screen, not a sheet, and it has
          to survive the tab bar being tapped underneath it. */}
      <ReviewSheet />

      <TabNav />
    </div>
  );
}
