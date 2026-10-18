import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/build-email-templates.mjs', import.meta.url));
const out = new URL('../supabase/templates/', import.meta.url);
const files = ['magic_link.html', 'confirmation.html', 'recovery.html'];
const font = "'Onest','Helvetica Neue',Helvetica,Arial,sans-serif";
const googleFonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&amp;display=swap">';

test('Supabase auth emails match their generator and retain safe Onest fallback styles', () => {
  const check = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout);

  for (const name of files) {
    const html = readFileSync(new URL(name, out), 'utf8');
    assert.ok(html.includes(googleFonts), `${name} should link to Google Fonts`);
    assert.ok(html.includes(`<body style="margin:0;padding:0;background:#070A12;font-family:${font};">`));

    const stacks = [...html.matchAll(/font-family:([^;]*);/g)].map(match => match[1]);
    assert.ok(stacks.length >= 7, `${name} must style individual text elements inline`);
    assert.ok(stacks.every(stack => stack === font), `${name} has a mismatched font stack`);
  }
});
