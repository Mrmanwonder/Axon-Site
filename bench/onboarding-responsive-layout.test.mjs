import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const curriculumCssUrl = new URL("../src/ui/components/CurriculumEditor.css", import.meta.url);
const systemCssUrl = new URL("../src/ui/styles/system.css", import.meta.url);

test("curriculum stage controls never recreate the narrow-screen overflow rule", async () => {
  const css = await readFile(curriculumCssUrl, "utf8");

  assert.match(css, /grid-template-columns:\s*40px minmax\(58px,1fr\) minmax\(150px,180px\)/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*grid-column:\s*2 \/ -1/);
  assert.doesNotMatch(css, /width:\s*100%;\s*margin-left:\s*50px/);
});

test("subject pills stay single-line and allow long labels to shrink", async () => {
  const css = await readFile(curriculumCssUrl, "utf8");

  assert.match(css, /\.curriculum-subject-chip\s*>\s*span\s*\{[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(css, /\.curriculum-subject-chip\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /\.curriculum-chip-wrap\s*\{[\s\S]*max-width:\s*100%/);
});

test("tablet sheets are bottom attached just like phone sheets", async () => {
  const css = await readFile(systemCssUrl, "utf8");
  const tablet = css.match(/@media \(min-width:768px\)\{[\s\S]*?\/\* Home —/u)?.[0] ?? "";

  assert.match(tablet, /\.sheet\{[^}]*bottom:0/);
  assert.match(tablet, /border-radius:32px 32px 0 0/);
  assert.match(tablet, /border-bottom:0/);
  assert.doesNotMatch(tablet, /\.sheet\{[^}]*bottom:16px/);
});

test("student identity row can shrink below the old fixed avatar width", async () => {
  const css = await readFile(systemCssUrl, "utf8");

  assert.match(css, /grid-template-columns:clamp\(64px,18vw,76px\) minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:360px\)[\s\S]*grid-template-columns:62px minmax\(0,1fr\)/);
});
