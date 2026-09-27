#!/usr/bin/env node
// Drives the real capture controller against a camera we author frame by frame,
// and asserts that a held page actually gets photographed.
//
// This exists because auto-capture failed in the field in a way no unit test
// would have caught and no amount of reading did: the page was detected, the
// gate was clear, and the shutter never went. The decisions are unit-tested now
// (bench/capture.test.mjs), but the decisions were never the whole story — the
// loop that feeds them is, and the only honest way to check that is to run it
// against something moving.
//
// A fake webcam gives a rolling colour pattern, which proves the loop runs and
// nothing about whether it finds a page. bench/viewfinder.html paints a sheet on
// a dark desk into a canvas and streams it, hand-shake included.
//
// Run against Vite (npm run dev) or a static server:
//   node bench/viewfinder.mjs --url http://localhost:5173 --budget 12000
// Uses this repository's installed Playwright browser.

import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag('url', 'http://localhost:8765');
const shake = flag('shake', '2');
const budgetMs = Number(flag('budget', '6000'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
const failures = [];
page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));

await page.goto(`${base}/bench/viewfinder.html?shake=${shake}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__vf?.shots > 0, { timeout: budgetMs + 3000 })
  .catch(() => {});
const r = await page.evaluate(() => window.__vf);
await browser.close();

const found = r.states.filter((s) => s.hasPage).length;
console.log(`camera live        ${r.live}`);
console.log(`page found         ${found} of ${r.states.length} searches`);
console.log(`ever steady        ${r.states.some((s) => s.steady)}`);
console.log(`auto-captured      ${r.shots > 0 ? `yes, at ${r.firstShotMs}ms` : 'NO'}`);
if (r.lastShot) console.log(`shot               ${r.lastShot.size}, quad ${r.lastShot.hasQuad ? 'kept' : 'MISSING'}`);
if (r.lastShot) console.log(`capture overlay     ${r.lastShot.overlayPhase}`);

// AXO-90 deliberately removed display stabilisation. Pixel/overlay mapping
// must remain untransformed; the bench must not demand a removed feature.
const transforms = r.states.map((s) => s.videoTransform).filter(Boolean);
if (!r.live) failures.push('the camera never went live');
if (transforms.some((value) => value !== 'none')) {
  failures.push('the camera preview unexpectedly applies a transform');
}
if (!found) failures.push('the detector never found the page');
if (!r.states.some((s) => s.steady)) failures.push('the page was never called steady');
if (!r.shots) failures.push(`nothing was captured within ${budgetMs}ms of a held page`);
if (r.lastShot && !r.lastShot.hasQuad) failures.push('the shot carried no quad, so it cannot be deskewed');
if (r.lastShot && r.lastShot.overlayPhase !== 'captured-confirm') {
  failures.push(`accepted shot entered overlay state ${r.lastShot.overlayPhase}, not captured-confirm`);
}
if (r.firstShotMs > budgetMs) failures.push(`first capture took ${r.firstShotMs}ms, over the ${budgetMs}ms budget`);
r.errors.forEach((e) => failures.push(e));

console.log('');
if (failures.length) {
  failures.forEach((f) => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log('ok — a page held in front of the camera gets photographed');
