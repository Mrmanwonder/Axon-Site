import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Vite otherwise discovers every HTML file in the repository, including the
  // archived reference/prototype.html. That prototype still points at the old
  // src/app.js entry and makes a cold dev/CI server abandon dependency
  // pre-bundling. Playwright can then be reloaded mid-test when dependencies are
  // rediscovered on demand. Scan only the real application and the dedicated
  // browser-test harness so startup is deterministic on CI and on fresh clones.
  optimizeDeps: {
    entries: ["index.html", "tests/browser/index.html"],
  },
  build: {
    manifest: true,
    // The performance floor is 60fps on mid-tier Android, which starts with
    // not shipping more than is needed to paint the first screen.
    target: "es2022",
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
