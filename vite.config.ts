import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The performance floor is 60fps on mid-tier Android, which starts with
    // not shipping more than is needed to paint the first screen.
    target: "es2022",
    // Production maps are not requested during a normal page load, but they add
    // deployment weight and expose source artifacts we do not currently upload
    // to an error-monitoring service. Turn this to "hidden" if that changes.
    sourcemap: false,
    cssCodeSplit: true,
  },
  server: {
    port: 5173,
  },
});
