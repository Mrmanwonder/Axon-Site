import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTrials } from './scanner-reliability.mjs';
const trial = (id, overrides = {}) => ({ id, scenario: 'portrait', expectation: 'auto', observationMs: 10000, firstLockMs: 1000, correctAutoCaptureMs: 2000, falseAutoCaptures: 0, ...overrides });
const input = (trials) => ({ schemaVersion: 1, source: 'synthetic', build: 'test', device: 'fixture', os: 'test', browser: 'test', trials });
test('timeouts stay in the rate denominator and out of latency samples', () => {
  const r = summarizeTrials(input([trial('a'), trial('b', { firstLockMs: null, correctAutoCaptureMs: null })])).scenarios[0];
  assert.equal(r.acquisitionP95Ms, 1000);
  assert.equal(r.acquisitionTimeouts, 1);
  assert.equal(r.autoCaptureTimeouts, 1);
  assert.equal(r.autoCaptureRate, 0.5);
  assert.equal(r.meetsProposedBudget, false);
});
test('late locks and late captures fail their respective budgets', () => {
  const r = summarizeTrials(input([trial('a', { observationMs: 12000, firstLockMs: 3500, correctAutoCaptureMs: 11000 })])).scenarios[0];
  assert.equal(r.acquisitionTimeouts, 1);
  assert.equal(r.autoCaptureTimeouts, 1);
});
test('negatives and distant pages are not counted as eligible Auto pages', () => {
  const r = summarizeTrials(input([trial('a', { expectation: 'reject', firstLockMs: null, correctAutoCaptureMs: null }), trial('b', { expectation: 'lock-only', correctAutoCaptureMs: null })]));
  assert.equal(r.scenarios.length, 2);
  r.scenarios.forEach((s) => { assert.equal(s.autoCaptureRate, null); assert.equal(s.eligiblePages, 0); });
});
test('false locks and captures fail even with enough trials', () => {
  const trials = Array.from({ length: 20 }, (_, i) => trial(`${i}`, { expectation: 'reject', firstLockMs: i === 0 ? 1000 : null, correctAutoCaptureMs: null, falseAutoCaptures: i === 0 ? 1 : 0 }));
  const r = summarizeTrials(input(trials)).scenarios[0];
  assert.equal(r.falseCaptures, 1);
  assert.equal(r.falseLocks, 1);
  assert.equal(r.meetsProposedBudget, false);
});
test('reports observed percentiles without treating synthetic results as physical acceptance', () => {
  const trials = Array.from({ length: 20 }, (_, i) => trial(`${i}`, { firstLockMs: (i + 1) * 100 }));
  const r = summarizeTrials(input(trials));
  assert.equal(r.scenarios[0].acquisitionP50Ms, 1000);
  assert.equal(r.scenarios[0].acquisitionP95Ms, 1900);
  assert.equal(r.scenarios[0].meetsProposedBudget, true);
  assert.equal(r.source, 'synthetic');
  assert.match(r.acceptance, /must be reviewed/);
});
test('rejects missing, duplicate, contradictory and incomplete observations', () => {
  for (const rows of [[], [trial('a'), trial('a')], [trial('a', { firstLockMs: undefined })], [trial('a', { firstLockMs: null })], [trial('a', { expectation: 'reject' })], [trial('a', { observationMs: 100 })], [trial('a', { falseAutoCaptures: -1 })], [trial('a', { droppedFrames: 3, totalFrames: 2 })]]) {
    assert.throws(() => summarizeTrials(input(rows)));
  }
});
