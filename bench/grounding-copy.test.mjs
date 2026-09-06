import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// grounding.ts is TypeScript with no runtime deps, so the assertions that
// matter here are about the copy itself. Read as source and checked as text —
// crude, but it pins the rules that actually protect the student, and it fails
// if someone reintroduces the vocabulary these states exist to keep off screen.
const src = readFileSync(new URL('../src/ui/data/grounding.ts', import.meta.url), 'utf8');

// Every string literal in the two functions that produce student-facing text.
// Taken from the function bodies rather than from `note:` lines, because the
// first version of this matched only one branch of a ternary and so silently
// checked four of the five states — a test that under-covers is worse than
// none, since it reads as coverage.
function literalsIn(fnName) {
  const start = src.indexOf(`export function ${fnName}`);
  if (start < 0) throw new Error(`${fnName} not found`);
  const after = src.slice(start);
  const end = after.indexOf('\n}\n');
  const body = after.slice(0, end < 0 ? undefined : end);
  return [...body.matchAll(/`([^`]*)`|"([^"]*)"/g)]
    .map((m) => m[1] ?? m[2])
    .filter((t) => /[a-z]/.test(t) && t.trim().split(/\s+/).length > 2);
}

const copy = [...literalsIn('withheldWorking'), ...literalsIn('diagnosisNote')];

test('every withheld state has copy, both ternary branches included', () => {
  assert.equal(copy.length, 8, `expected all eight strings, found ${copy.length}`);
});

test('internal vocabulary never reaches the student', () => {
  // These are field names and gate names. A student cannot be asked to know
  // what "off topic" meant to a check they cannot see.
  for (const term of [
    'off_topic', 'off topic', 'heuristic', 'grounding_status', 'model_answer',
    'missing_dependency', 'generation_failed', 'no_verified_answer_source',
    'unresolved_parts', 'null', 'pipeline', 'prompt', 'token', 'LLM', 'model',
  ]) {
    for (const line of copy) {
      assert.ok(
        !line.toLowerCase().includes(term.toLowerCase()),
        `"${term}" reached student-facing copy: ${line}`,
      );
    }
  }
});

test('the student is never asked to judge output we could not verify', () => {
  for (const term of ['may be inaccurate', 'might be wrong', 'use your judgement', 'check this yourself', 'verify']) {
    for (const line of copy) {
      assert.ok(!line.toLowerCase().includes(term), `"${term}" reached copy: ${line}`);
    }
  }
});

test('no exclamation marks, per the copy rules', () => {
  for (const line of copy) assert.ok(!line.includes('!'), `exclamation mark in: ${line}`);
});

test('only the actionable state promises an action', () => {
  // "Add that page" is a real thing the student can do. It must not appear on a
  // state where nothing they do would help — that would be busywork dressed as
  // recovery.
  const actionable = copy.filter((l) => /add that page/i.test(l));
  assert.equal(actionable.length, 2, 'both missing-dependency variants, and nothing else');
});
