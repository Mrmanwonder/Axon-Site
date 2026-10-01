// Manual verification (AXO-78): does the BUILT bundle mask replay text/inputs/images?
// Mocks only the PostHog API host (nothing reaches a real project) and serves SDK assets from disk.
//   mkdir .ph-static && for f in array.js lazy-recorder.js posthog-recorder.js; do
//     curl -sS -o .ph-static/$f https://us-assets.i.posthog.com/static/$f; done
//   npm run build && npx vite preview --port 5175 &   node scripts/verify-replay-masking.mjs http://127.0.0.1:5175
// Exits non-zero if any synthetic value is visible in the recorded payload.
// Loads the built Axon bundle, consents, mocks ONLY the PostHog API host (nothing reaches the real project),
// injects synthetic PII and records what the replay recorder tries to send.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import zlib from "node:zlib";
const base = process.argv[2] || "http://127.0.0.1:5175";
const SECRETS = { text: "SYNTH-NAME-Aarav-Verma", mark: "SYNTH-MARKS-7of9", input: "SYNTH-EMAIL-q@example.test", imgdata: "SYNTHIMGMARKER" };
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 380, height: 800 }, userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" });
await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => false }); });
const page = await ctx.newPage();
const apiHits = []; const bodies = [];
await ctx.route(/https:\/\/us\.i\.posthog\.com\/.*/, async (route) => {
  const req = route.request(); const u = new URL(req.url());
  apiHits.push(`${req.method()} ${u.pathname}`);
  const buf = req.postDataBuffer();
  if (buf) bodies.push({ path: u.pathname, buf });
  const rec = { endpoint: "/s/", consoleLogRecordingEnabled: false, recorderVersion: "v2", sampleRate: null, minimumDurationMilliseconds: null, linkedFlag: null, networkPayloadCapture: null, masking: null, urlTriggers: [], urlBlocklist: [], eventTriggers: [], triggerMatchType: null, scriptConfig: { script: "posthog-recorder" } };
  const json = { config: { enable_collect_everything: true }, toolbarParams: {}, isAuthenticated: false, supportedCompression: ["gzip", "gzip-js"], hasFeatureFlags: false, captureDeadClicks: true, autocapture_opt_out: false, sessionRecording: rec, surveys: false, heatmaps: false, defaultIdentifiedOnly: true, featureFlags: {}, featureFlagPayloads: {}, errorsWhileComputingFlags: false, quotaLimited: [], flags: {} };
  await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(json) });
});
const RC = { token: "x", supportedCompression: ["gzip", "gzip-js"], hasFeatureFlags: false, captureDeadClicks: true, capturePerformance: false, autocapture_opt_out: false, autocaptureExceptions: false, sessionRecording: { endpoint: "/s/", consoleLogRecordingEnabled: false, recorderVersion: "v2", sampleRate: null, minimumDurationMilliseconds: null, linkedFlag: null, networkPayloadCapture: null, masking: null, urlTriggers: [], urlBlocklist: [], eventTriggers: [], triggerMatchType: null }, surveys: false, heatmaps: false, defaultIdentifiedOnly: true, siteApps: [] };
await ctx.route(/https:\/\/us-assets\.i\.posthog\.com\/.*/, async (route) => {
  const u = new URL(route.request().url()); const h = { "access-control-allow-origin": "*" };
  if (/\/array\/.*\/config\.js$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: "application/javascript", headers: h, body: `(function(){window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG[${JSON.stringify(u.pathname.split("/")[2])}]={config:${JSON.stringify(RC)},siteApps:[]}})()` });
  if (/\/array\/.*\/config$/.test(u.pathname)) return route.fulfill({ status: 200, contentType: "application/json", headers: h, body: JSON.stringify(RC) });
  const f = u.pathname.split("/").pop();
  const p = (process.env.PH_STATIC_DIR || "./.ph-static") + "/" + f;
  if (fs.existsSync(p)) return route.fulfill({ status: 200, contentType: "application/javascript", headers: h, body: fs.readFileSync(p) });
  return route.fulfill({ status: 200, contentType: "application/javascript", headers: h, body: "" });
});
let preConsent = 0;
page.on("request", (r) => { if (/posthog\.com/.test(r.url()) && !/static\//.test(r.url())) preConsent++; });
await page.goto(base + "/privacy", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const before = apiHits.length + 0; const beforeAll = preConsent;
console.log("PRE-CONSENT posthog API/asset requests (non-static):", beforeAll, "api hits:", before);
await page.getByRole("button", { name: "Allow analytics" }).click();
await page.waitForFunction(() => document.documentElement.dataset.analytics === "ready", null, { timeout: 20000 }).catch(() => console.log("analytics never reached ready; state=", null));
console.log("data-analytics =", await page.evaluate(() => document.documentElement.dataset.analytics));
await page.evaluate(({ s, png }) => {
  const d = document.createElement("div"); d.id = "synth";
  d.innerHTML = `<p id="n">${s.text}</p><p id="m">${s.mark}</p><input id="i" value="${s.input}"><img id="im" alt="${s.imgdata}" src="data:image/png;base64,${png}" width="40" height="40">`;
  document.body.appendChild(d);
}, { s: SECRETS, png });
await page.evaluate(() => { window.posthog.on("eventCaptured", (e) => console.log("CAPTURED", JSON.stringify(e).slice(0,200))); window.posthog.capture("synthetic_probe", {}, { send_instantly: true }); });
await page.fill("#i", SECRETS.input);
await page.click("#n");
await page.waitForTimeout(1500);
await page.evaluate(() => { const p = document.querySelector("#n"); p.textContent = p.textContent + " edited"; });
await page.waitForTimeout(2500);
await page.goto(base + "/terms"); await page.waitForTimeout(2500);
await ctx.close(); await browser.close();
const decode = (b) => { let out = b; try { out = zlib.gunzipSync(b); } catch {} return out.toString("utf8"); };
const all = bodies.map(({ path, buf }) => ({ path, text: decode(buf) }));
let expanded = all.map((x) => x.text).join("\n");
const walk = (o) => { if (typeof o === "string") { if (o.charCodeAt(0) === 0x1f) { try { expanded += "\n" + zlib.gunzipSync(Buffer.from(o, "latin1")).toString("utf8"); } catch {} } } else if (o && typeof o === "object") for (const v of Object.values(o)) walk(v); };
for (const x of all) { try { walk(JSON.parse(x.text)); } catch {} }
const paths = [...new Set(apiHits)];
console.log("API paths hit after consent:", paths.join(", "));
console.log("snapshot (/s/) requests:", all.filter((x) => x.path === "/s/").length, "| event (/e/) requests:", all.filter((x) => x.path === "/e/").length);
for (const [k, v] of Object.entries(SECRETS)) console.log(`leak check ${k}:`, v, "=>", expanded.includes(v) ? "LEAKED" : "not present");
const hasEditedPlain = expanded.includes(" edited");
console.log("mutation text ' edited' visible in payload:", hasEditedPlain);
console.log("positive control — synthetic node (id=synth) decoded from snapshot/mutation:", /"id":"synth"/.test(expanded));
const i = expanded.indexOf('"id":"synth"'); if (i >= 0) console.log("excerpt:", expanded.slice(Math.max(0,i-60), i+700).replace(/\s+/g," "));

if (Object.values(SECRETS).some((v) => expanded.includes(v)) || !/"id":"synth"/.test(expanded) || beforeAll !== 0) process.exit(1);
