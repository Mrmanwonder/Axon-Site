// Production configuration check — INV-01, "no production development bypasses".
//
// The remediation spec asks for a build assertion that *fails* rather than
// logs, and for a deployment smoke test proving the shipped bundle does not
// select a development adapter. The runtime guard in src/verification.js is
// necessary but not sufficient on its own: Vite never executes the module
// during `vite build`, so a stub-configured build succeeds and only throws
// once it reaches a browser. That is a loud failure in the wrong place — after
// deploy, in front of whoever loaded the page.
//
// So this runs as part of `npm run build` and again in CI. It reads the source
// rather than importing it, deliberately: importing src/config.js pulls in the
// Supabase client, and a config check that needs a network-capable dependency
// tree is a check that will be disabled the first time it is inconvenient.
//
//   node scripts/check-production-config.mjs          before/after a build
//   node scripts/check-production-config.mjs --dist   also inspect dist/

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];

// ── which adapter does the build select? ───────────────────────────────────

const configSrc = readFileSync('src/config.js', 'utf8');
const configured = configSrc.match(
  /export\s+const\s+VERIFICATION_ADAPTER\s*=\s*['"]([^'"]+)['"]/,
)?.[1];

if (!configured) {
  problems.push('src/config.js does not export a literal VERIFICATION_ADAPTER.');
}

// ── which adapters are development-only? ───────────────────────────────────
//
// Read from verification.js rather than hardcoded here, so adding a second
// dev adapter cannot leave this check silently pointing at a stale list.

const verificationSrc = readFileSync('src/verification.js', 'utf8');
const devOnly = new Set();
for (const block of verificationSrc.split(/\bconst\s+\w+Adapter\s*=\s*\{/).slice(1)) {
  const body = block.slice(0, block.indexOf('\n};'));
  const id = body.match(/\bid:\s*['"]([^'"]+)['"]/)?.[1];
  if (id && /\bdevOnly:\s*true\b/.test(body)) devOnly.add(id);
}

if (devOnly.size === 0) {
  problems.push(
    'No devOnly adapter was found in src/verification.js. Either the flag was ' +
    'removed or this check can no longer parse the file — both make it useless.',
  );
}

if (configured && devOnly.has(configured)) {
  problems.push(
    `VERIFICATION_ADAPTER is '${configured}', which is development-only. ` +
    'A build must not ship it: the screen would claim to verify a guardian ' +
    'and verify nobody. Set a real adapter in src/config.js.',
  );
}

// ── did the runtime guard survive the build? ───────────────────────────────
//
// A guard that a minifier drops is not a guard. This looks for the assertion's
// own message in the emitted chunks; if the check ever legitimately needs a
// different string, change both together.

if (process.argv.includes('--dist')) {
  const assetsDir = join('dist', 'assets');
  if (!existsSync(assetsDir)) {
    problems.push('dist/assets does not exist — run the build before --dist.');
  } else {
    const chunks = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    const needle = 'guardian verification adapter';
    const guarded = chunks.some((f) =>
      readFileSync(join(assetsDir, f), 'utf8').includes(needle));
    if (!guarded) {
      problems.push(
        `No chunk in dist/assets contains the verification build guard ` +
        `("...${needle}"). It was tree-shaken or renamed, so the shipped ` +
        'bundle no longer refuses a development adapter at boot.',
      );
    }
  }
}

// ── report ─────────────────────────────────────────────────────────────────

if (problems.length) {
  console.error('\nProduction configuration check failed:\n');
  for (const p of problems) console.error(`  · ${p}\n`);
  process.exit(1);
}

console.log(
  `Production configuration OK — verification adapter '${configured}'` +
  `${process.argv.includes('--dist') ? ', build guard present in dist/' : ''}.`,
);
