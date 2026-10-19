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

test('password recovery matches the confirmation code panel without changing the secure recovery link', () => {
  const confirmation = readFileSync(new URL('confirmation.html', out), 'utf8');
  const recovery = readFileSync(new URL('recovery.html', out), 'utf8');
  const panel = 'background:#161E36;border:1px solid #2C3B68;border-radius:14px;';

  assert.ok(confirmation.includes(panel), 'confirmation has the verification-code panel');
  assert.ok(recovery.includes(panel), 'recovery uses the same panel surface and border');
  assert.ok(!recovery.includes('background:#3A86FF;border-radius:14px;'), 'no old solid-blue reset button');
  assert.ok(recovery.includes('padding:22px 12px'), 'the reset link uses the same panel spacing');
  assert.ok(recovery.includes('margin:12px 0 0 0'), 'matching explanatory text under the panel');
  assert.ok(recovery.includes('href="{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=recovery"'), 'one-time recovery link is preserved');
  assert.ok(recovery.includes('Choose a new password'), 'action stays understandable');
  assert.ok(confirmation.includes('{{ .Token }}'), 'confirmation still displays the code');
});
