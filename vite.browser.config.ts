import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({ optimizeDeps: { entries: ["tests/browser/index.html"] }, plugins: [{ name: "test-only-data", enforce: "pre", resolveId(source, importer) {
  if (!importer?.replaceAll("\\", "/").includes("/src/ui/")) return;
  if (source.endsWith("/modules")) return resolve("tests/browser/modules.ts");
  if (source.endsWith("/useIngestion")) return resolve("tests/browser/ingestion.ts");
  if (source.endsWith("/ScanProvider")) return resolve("tests/browser/scan.ts");
} }, react()], server: { host: "127.0.0.1", port: 5174, strictPort: true } });
