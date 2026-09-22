import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "tests/e2e", fullyParallel: true, workers: 4, use: { baseURL: "http://127.0.0.1:5174", trace: "retain-on-failure" }, projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "webkit-mobile", use: { ...devices["iPhone 13"], browserName: "webkit" } },
], webServer: [{ command: "npx vite --config vite.browser.config.ts", url: "http://127.0.0.1:5174/tests/browser/index.html", reuseExistingServer: !process.env.CI }, { command: "npx vite preview --host 127.0.0.1 --port 5175 --strictPort", url: "http://127.0.0.1:5175", reuseExistingServer: !process.env.CI }] });

