import { paths } from "./paths";

// Routing and preloading share the same imports. The browser's module cache
// deduplicates them; preloading evaluates code without mounting a screen or
// starting its account reads, camera or scanner.
export const mainRouteModules = {
  [paths.home]: () => import("../pages/Home"),
  [paths.library]: () => import("../pages/Library"),
  [paths.scan]: () => import("../pages/Scan"),
  [paths.insights]: () => import("../pages/Insights"),
  [paths.settings]: () => import("../pages/Settings"),
};

export function preloadMainRoute(path: string) {
  const load = mainRouteModules[path as keyof typeof mainRouteModules];
  // A failed speculative load must not interrupt the current screen. Actual
  // navigation still uses the router's normal error/recovery boundary.
  if (load) void load().catch(() => {});
}
