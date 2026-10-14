import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const toml = readFileSync("netlify.toml", "utf8");
const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)![1];
test("detector worker + wasm start and Auto captures under the production CSP", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Canvas camera fixture and ONNX Runtime harness are Chromium-only, like the other viewfinder specs; CSP behaviour in WebKit is not covered here");
  const violations: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  await page.route("**/bench/viewfinder.html*", async (route) => {
    const res = await route.fetch();
    // Vite's development-only React refresh preamble is not part of the
    // production scanner. Remove only that injected inline script; the actual
    // viewfinder harness is an external module and runs under the exact CSP.
    const body = (await res.text()).replace(/<script type="module">import \{ injectIntoGlobalHook \} from "\/@react-refresh";[\s\S]*?<\/script>/, "");
    await route.fulfill({ response: res, body, headers: { ...res.headers(), "content-security-policy": csp } });
  });
  await page.goto("/bench/viewfinder.html?shake=2");
  await page.waitForFunction(() => (window as any).__vf?.shots > 0, { timeout: 25000 });
  const r = await page.evaluate(() => { const v = (window as any).__vf; v.stop(); return { shots: v.shots, errors: v.errors, live: v.live }; });
  
  expect(violations).toEqual([]);
  expect(r.errors).toEqual([]);
});
