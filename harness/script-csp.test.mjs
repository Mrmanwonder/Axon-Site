import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const checker = fileURLToPath(new URL('../scripts/check-script-csp.mjs', import.meta.url));
const authorized = 'window.boot = true;';
const policy = `script-src 'self' 'sha256-${createHash('sha256').update(authorized).digest('base64')}'`;
function check(html, changedFile = 'index.html') {
  const cwd = mkdtempSync(join(tmpdir(), 'axon-csp-'));
  try {
    for (const dir of ['public', 'dist/share']) mkdirSync(join(cwd, dir), { recursive: true });
    writeFileSync(join(cwd, 'public/_headers'), `Content-Security-Policy: ${policy}\n`);
    writeFileSync(join(cwd, 'netlify.toml'), `Content-Security-Policy = "${policy}"\n`);
    for (const file of ['index.html', 'dist/index.html', 'dist/share/index.html']) {
      writeFileSync(join(cwd, file), file === changedFile ? html : `<script>${authorized}</script>`);
    }
    return spawnSync(process.execPath, [checker], { cwd, encoding: 'utf8' });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}
test('hash-authorized scripts and real external src attributes pass', () => {
  const result = check(`<SCRIPT data-note=">">${authorized}</SCRIPT ><script SRC = "/app.js"></script><!-- <script>not executable</script> -->`);
  assert.equal(result.status, 0, result.stderr);
});
for (const file of ['index.html', 'dist/index.html', 'dist/share/index.html']) {
  test(`unapproved mixed-case inline scripts are rejected in ${file}`, () => {
    const result = check('<ScRiPt>window.unapproved = true;</ScRiPt >', file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CSP does not authorize/);
  });
}
test('data-src and src-like quoted text cannot bypass an inline script hash', () => {
  for (const attrs of ['data-src="/app.js"', 'data-note="src=/app.js >"']) {
    const result = check(`<script ${attrs}>window.unapproved = true;</script>`);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CSP does not authorize/);
  }
});
