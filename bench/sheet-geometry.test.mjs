import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('modal sheets are attached to the viewport bottom with square lower corners', async () => {
  const css = await readFile(new URL('../src/ui/styles/system.css', import.meta.url), 'utf8');
  const sheet = css.match(/\.sheet\{[^}]+\}/)?.[0] ?? '';
  assert.match(sheet, /bottom:0/);
  assert.match(sheet, /border-radius:32px 32px 0 0/);
  assert.match(sheet, /border-bottom:0/);
  assert.doesNotMatch(sheet, /bottom:max\(/);
});
