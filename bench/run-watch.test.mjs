import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchRun } from '../src/scan/run-watch.js';

function clock() {
  let time = 0;
  return { now: () => time, sleep: async ms => { time += ms; } };
}

test('long-running submission stays processing when foreground budget expires', async () => {
  let reads = 0;
  const result = await watchRun({ ...clock(), budgetMs: 300000, pollMs: 1500,
    read: async () => { reads++; return { status: 'structure' }; },
  });
  assert.equal(result.processing, true);
  assert.equal(result.status, 'structure');
  assert.equal(reads, 201);
});

test('completion at the deadline takes precedence over foreground expiry', async () => {
  let reads = 0;
  const result = await watchRun({ ...clock(), budgetMs: 1500,
    read: async () => ({ status: ++reads === 1 ? 'content' : 'needs_review' }),
  });
  assert.equal(result.processing, false);
  assert.equal(result.status, 'needs_review');
});

test('server failures remain failures with their actual reason', async () => {
  const result = await watchRun({ read: async () => ({ status: 'failed', status_reason: 'Service failed' }) });
  assert.equal(result.processing, false);
  assert.equal(result.status_reason, 'Service failed');
});

test('a resumed run already explaining is ready to open without another wait', async () => {
  const result = await watchRun({ read: async () => ({ status: 'explaining' }), sleep: () => assert.fail('must not wait') });
  assert.equal(result.processing, false);
});

test('database failure is not represented as a completed or background run', async () => {
  await assert.rejects(watchRun({ read: async () => { throw new Error('offline'); } }), /offline/);
});
