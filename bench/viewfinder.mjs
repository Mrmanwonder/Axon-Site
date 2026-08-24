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
// Playwright is not a dependency of this repo — there is no package.json and
// AGENTS.md keeps it that way. Use an install you already have:
//
//   python3 -m http.server 8765 &
//   PLAYWRIGHT_HOME=/path/with/node_modules node bench/viewfinder.mjs [--shake 2]
//
// (NODE_PATH does not work here: it only ever applied to CommonJS require.)

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// A CJS entry imported by URL lands under `default`, so unwrap either shape.
const unwrap = (mod) => mod?.chromium ? mod : mod?.default;

async function loadPlaywright() {
  try { return unwrap(await import('playwright')); } catch { /* not resolvable from here */ }
  const home = process.env.PLAYWRIGHT_HOME;
  if (home) {
    try {
      const resolve = createRequire(home.endsWith('/') ? home : `${home}/`);
      return unwrap(await import(pathToFileURL(resolve.resolve('playwright')).href));
    } catch { /* fall through to the message */ }
  }
  console.error('\nThis needs Playwright, which this repo deliberately does not vendor.');
  console.error('Install it anywhere outside the repo and point PLAYWRIGHT_HOME at that folder:\n');
  console.error('  npm i playwright');
  console.error('  PLAYWRIGHT_HOME=$PWD node bench/viewfinder.mjs\n');
  process.exit(2);
}
const { chromium } = await loadPlaywright();

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag('url', 'http://localhost:8765');
const shake = flag('shake', '2');
const budgetMs = Number(flag('budget', '6000'));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
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

if (!r.live) failures.push('the camera never went live');
if (!found) failures.push('the detector never found the page');
if (!r.states.some((s) => s.steady)) failures.push('the page was never called steady');
if (!r.shots) failures.push(`nothing was captured within ${budgetMs}ms of a held page`);
if (r.lastShot && !r.lastShot.hasQuad) failures.push('the shot carried no quad, so it cannot be deskewed');
if (r.firstShotMs > budgetMs) failures.push(`first capture took ${r.firstShotMs}ms, over the ${budgetMs}ms budget`);
r.errors.forEach((e) => failures.push(e));

console.log('');
if (failures.length) {
  failures.forEach((f) => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log('ok — a page held in front of the camera gets photographed');
