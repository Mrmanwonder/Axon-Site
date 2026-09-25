import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

test("app shell no longer mounts the floating theme toggle", async () => {
  const source = await readFile(new URL("../src/ui/shell/AppShell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ThemeToggle/);
  assert.doesNotMatch(source, /<ThemeToggle\s*\/?>/);
});

test("Insights filter rail sticks below the shell header and centers chips", async () => {
  const css = await readFile(new URL("../src/ui/styles/system.css", import.meta.url), "utf8");
  const rule = css.match(/\.insightfilters\{[\s\S]*?\}/)?.[0] ?? "";

  assert.match(rule, /top:calc\(var\(--top-inset\) \+ 52px - var\(--view-top\)\)/);
  assert.match(rule, /align-items:center/);
  assert.match(rule, /min-height:56px/);
  assert.match(rule, /padding:9px var\(--gutter\)/);
  assert.doesNotMatch(rule, /top:var\(--view-top\)/);
  assert.match(rule, /background:var\(--bg\)/);
});
