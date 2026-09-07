#!/usr/bin/env node
// Does the scanner keep hold of a page that is moving?
//
// bench/viewfinder.mjs asks whether a page held still gets photographed, which
// is the question auto-capture failed in the field. This asks the other one:
// while the page is being moved — framed, adjusted, swung back and forth the
// way anyone does before they settle — does the overlay stay on it, or does it
// blink out and come back?
//
// That is the whole claim of the tracker, and it is not visible in a still
// scene. A detector that re-searches the whole frame twelve times a second
// looks perfect standing still and loses the page the moment it moves, because
// between two searches there is nothing but the last answer, and the last
// answer is eighty milliseconds stale at best.
//
// Two numbers come out, and both are about the student's experience rather
// than about the algorithm:
//
//   held        the share of published frames that had a page in them, while
//               the page was in shot the whole time. Anything under 100% is
//               the overlay blinking.
//   refresh     how often the pose is updated, in hertz. This is what "the
//               border lags" is a description of.
//
// Run it against the same local server bench/viewfinder.mjs uses:
//
//   python3 -m http.server 8765 &
//   PLAYWRIGHT_HOME=/path/with/node_modules node bench/tracking-continuity.mjs
//
// Headless Chromium on a container is not a phone, so read the two runs
// against each other rather than either as an absolute.

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const unwrap = (mod) => (mod?.chromium ? mod : mod?.default);

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
  console.error('  npm i playwright   (anywhere outside the repo)');
  console.error('  PLAYWRIGHT_HOME=$PWD node bench/tracking-continuity.mjs\n');
  process.exit(2);
}
const { chromium } = await loadPlaywright();

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag('url', 'http://localhost:8765');
const seconds = Number(flag('seconds', '10'));
// Big enough to be real movement — about a fifth of the frame — and small
// enough that the page never actually leaves the shot, so a lost page is the
// tracker losing it rather than the page having gone.
const sweep = flag('sweep', '90');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// autoCapture off: a shot mid-run disarms the gate and re-frames the scene,
// and this run is about the frames, not the shutter.
await page.goto(`${base}/bench/viewfinder.html?shake=2&sweep=${sweep}&auto=0`, { waitUntil: 'load' });
await page.waitForTimeout(seconds * 1000);
const r = await page.evaluate(() => window.__vf);
await browser.close();

const states = r.states ?? [];
// The first second is the scanner starting up, not the thing being measured.
const settled = states.filter((s) => s.at > 1000);
if (settled.length < 5) {
  console.error(`only ${settled.length} frames published in ${seconds}s — nothing to measure`);
  errors.forEach((e) => console.error(`  page error: ${e}`));
  process.exit(1);
}

const span = settled[settled.length - 1].at - settled[0].at;
const held = settled.filter((s) => s.hasPage).length;
const refresh = span > 0 ? (settled.length - 1) / (span / 1000) : 0;

// The longest run of consecutive published frames with no page in them. One
// dropped frame is invisible; six in a row is the overlay blinking off.
let gap = 0, worstGap = 0;
for (const s of settled) {
  gap = s.hasPage ? 0 : gap + 1;
  if (gap > worstGap) worstGap = gap;
}

const byState = {};
for (const s of settled) byState[s.trackState ?? 'n/a'] = (byState[s.trackState ?? 'n/a'] ?? 0) + 1;

console.log('\nTracking continuity · a page moving in front of the camera\n');
console.log(`  window            ${(span / 1000).toFixed(1)}s, ${settled.length} published frames`);
console.log(`  held              ${(held / settled.length * 100).toFixed(1)}%  (${held}/${settled.length})`);
console.log(`  longest blink     ${worstGap} frames`);
console.log(`  refresh           ${refresh.toFixed(1)} Hz`);
console.log(`  tracker states    ${Object.entries(byState).map(([k, v]) => `${k}:${v}`).join('  ')}`);
if (errors.length) {
  console.log('');
  errors.forEach((e) => console.log(`  page error: ${e}`));
}
console.log('');
