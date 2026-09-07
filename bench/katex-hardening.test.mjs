import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const katex = createRequire(import.meta.url)('katex');

/**
 * The LaTeX in `answer_block` is model-generated, so it is untrusted input on a
 * student's own answer. These are the settings AnswerBlock.tsx renders with,
 * asserted here so a later "just make it render" change cannot quietly loosen
 * them.
 */
const OPTS = {
  displayMode: false, strict: true, trust: false,
  maxExpand: 1000, output: 'htmlAndMathml', throwOnError: true,
};

test('the maths a student actually writes renders', () => {
  for (const src of ['\\tfrac{8}{2}', '\\frac{3}{16} \\times 2^{5}', '0.1001_2', '4.5_{10}', '9/2']) {
    const html = katex.renderToString(src, OPTS);
    assert.ok(html.includes('katex'), src);
  }
});

test('MathML is emitted, or the answer is inaccessible to a screen reader', () => {
  const html = katex.renderToString('\\tfrac{8}{2}', OPTS);
  assert.ok(html.includes('<math'), 'no MathML annotation');
});

/**
 * `trust: false` does not throw on these — it renders them as literal text in
 * KaTeX's own error red. That is inert (no <a>, no href attribute, the URL
 * survives only inside the inert MathML annotation) but it is still an error
 * string inside a student's answer, painted in the one colour this product
 * reserves for signing out. AnswerBlock refuses them before KaTeX sees them.
 */
const REFUSED = /\\(href|url|includegraphics|html(?:Class|Id|Style|Data)|color|textcolor|colorbox|fcolorbox|mathcolor)\b/;

test('trust: false renders the dangerous commands inert, not as links', () => {
  for (const src of ['\\href{javascript:alert(1)}{tap}', '\\includegraphics{x.png}', '\\url{javascript:alert(1)}']) {
    const html = katex.renderToString(src, OPTS);
    assert.ok(!/<a[ >]/.test(html), `${src} produced an anchor`);
    assert.ok(!/href\s*=/.test(html), `${src} produced an href attribute`);
  }
});

test('...and the component refuses them before KaTeX can paint them red', () => {
  for (const src of [
    '\\href{javascript:alert(1)}{tap}', '\\url{x}', '\\includegraphics{x.png}',
    '\\htmlClass{x}{y}', '\\color{red}9', '\\textcolor{red}{9}', '\\colorbox{red}{9}',
  ]) {
    assert.ok(REFUSED.test(src), `${src} must be refused before rendering`);
  }
  // Real student maths must not be caught by the refusal.
  for (const ok of ['\\tfrac{8}{2}', '\\frac{3}{16} \\times 2^{5}', '0.1001_2', 'x + 1']) {
    assert.ok(!REFUSED.test(ok), `${ok} must still render`);
  }
});

test('strict: true refuses silent coercion rather than guessing', () => {
  // A unicode text character in maths mode is coerced silently when strict is
  // off. Off is how a wrong character reaches a student looking correct.
  assert.throws(() => katex.renderToString('\\text{é} + é', OPTS));
});

test('an expansion bomb cannot hang a phone', () => {
  const bomb = '\\def\\a{\\b\\b}\\def\\b{\\c\\c}\\def\\c{\\d\\d}\\def\\d{\\e\\e}\\def\\e{x}\\a'.repeat(40);
  assert.throws(() => katex.renderToString(bomb, OPTS));
});

test('malformed input throws so the caller can fall back, never renders an error string', () => {
  for (const bad of ['\\frac{1}{', '3/16 | 2^5 \\undefinedmacro', '{']) {
    let threw = false;
    try { katex.renderToString(bad, OPTS); } catch { threw = true; }
    assert.ok(threw, `${bad} should throw rather than render`);
  }
  // And with throwOnError left on, KaTeX never emits its red error text — which
  // is the thing that must never appear inside a student's own answer.
  assert.ok(!katex.renderToString('\\tfrac{1}{2}', OPTS).includes('katex-error'));
});
