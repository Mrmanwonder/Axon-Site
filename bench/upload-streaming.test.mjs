// The streaming send (AXO-211): bounded parallel PUTs, page order, no window
// barrier, per-file retry in place, and resume after an interruption.
import test from 'node:test';
import assert from 'node:assert/strict';
import { processingReady, backupComplete } from '../src/scan/upload-plan.js';
import { createLimiter } from '../src/scan/upload-runner.js';
import { booklet, fixture } from './fixtures/upload-model.mjs';

const tick = (ms = 1) => new Promise(resolve => setTimeout(resolve, ms));

/** Slow every PUT down so several are genuinely in flight at once. */
function slowPuts(model, ms = 3) {
  const actual = model.transport.putObject;
  model.transport.putObject = async (...args) => { await tick(ms); return actual(...args); };
}
const nameOf = (model, url) => model.issued.get(url).name;
const pageOf = name => Number(/^p(\d+)/.exec(name)[1]);
/** Names of the files whose bytes reached storage. */
const landedNames = model => new Set([...model.issued.values()].filter(c => model.arrived.has(c.key)).map(c => c.name));

test('limiter never runs more than its bound and starts work in the order given', async () => {
  for (const bound of [1, 2, 4, 6]) {
    const run = createLimiter(bound), started = [];
    let active = 0, max = 0;
    await Promise.all(Array.from({ length: 20 }, (_, i) => run(async () => {
      started.push(i); active++; max = Math.max(max, active); await tick(); active--;
    })));
    assert.equal(max, bound);
    assert.deepEqual(started, Array.from({ length: 20 }, (_, i) => i));
  }
  for (const bad of [0, 7, 1.5]) assert.throws(() => createLimiter(bad), RangeError);
});

test('a 13-page paper sends at most 4 files at once, never fewer than it could', async () => {
  for (const concurrency of [2, 4]) {
    const draft = booklet(13), model = fixture(draft), actual = model.transport.putObject;
    let active = 0, max = 0;
    model.transport.putObject = async (...args) => {
      active++; max = Math.max(max, active);
      try { await tick(3); return await actual(...args); } finally { active--; }
    };
    await model.run({ criticalOnly: true, concurrency });
    assert.equal(max, concurrency);
    assert.ok(draft.pages.every(processingReady));
  }
});

test('files start in page order across windows, thumb then page then mask', async () => {
  const draft = booklet(13), model = fixture(draft), order = [];
  const actual = model.transport.putObject;
  model.transport.putObject = async (url, ...rest) => { order.push(nameOf(model, url)); await tick(); return actual(url, ...rest); };
  await model.run({ criticalOnly: true });
  assert.equal(model.calls.filter(c => c[0] === 'intent').length, 2); // 39 files, 32 per window
  assert.equal(order.length, 39);
  const pages = order.map(pageOf);
  assert.deepEqual(pages, [...pages].sort((a, b) => a - b));
  assert.deepEqual(order.slice(0, 3), ['p1-thumb', 'p1', 'p1-mask']);
});

test('the next window is minted and files confirmed while the transfer is still running', async () => {
  const draft = booklet(13), model = fixture(draft), timeline = [];
  let inFlight = 0;
  const { putObject, uploadIntent, uploadComplete } = model.transport;
  model.transport.putObject = async (...args) => { inFlight++; try { await tick(3); return await putObject(...args); } finally { inFlight--; } };
  model.transport.uploadIntent = async body => { timeline.push(['intent', inFlight]); return uploadIntent(body); };
  model.transport.uploadComplete = async body => { timeline.push(['complete', inFlight, body.uploads.length]); return uploadComplete(body); };
  await model.run({ criticalOnly: true });
  const intents = timeline.filter(e => e[0] === 'intent');
  assert.equal(intents.length, 2);
  // The second window's links were asked for while the first window's files
  // were still moving: no barrier between windows.
  assert.ok(intents[1][1] > 0, 'second intent waited for the first window to drain');
  const completes = timeline.filter(e => e[0] === 'complete');
  assert.ok(completes.length > 1, 'confirmations were not streamed');
  assert.ok(completes.some(e => e[1] > 0), 'no confirmation overlapped a transfer');
  assert.ok(completes.every(e => e[2] <= 60));
  assert.equal(completes.reduce((n, e) => n + e[2], 0), 39); // each file confirmed once
});

test('progress reports pages as they are confirmed, not all at the end', async () => {
  const draft = booklet(13), model = fixture(draft), sent = [];
  slowPuts(model);
  await model.run({ criticalOnly: true, onProgress: p => sent.push(p.pagesSent) });
  const distinct = [...new Set(sent)];
  assert.equal(distinct.at(-1), 13);
  assert.ok(distinct.length > 3, 'progress jumped straight to done');
  for (let i = 1; i < sent.length; i++) assert.ok(sent[i] >= sent[i - 1]);
});

test('a dropped connection on one file is retried in place without re-minting', async () => {
  const draft = booklet(5), model = fixture(draft); model.fail('mask', undefined, 2);
  await model.run({ criticalOnly: true });
  assert.ok(draft.pages.every(processingReady));
  const masks = [...model.puts].filter(([n]) => n.endsWith('-mask')).map(([, c]) => c);
  assert.equal(masks.reduce((a, b) => a + b, 0), 5 + 2); // two retries, one file
  assert.ok([...model.puts].filter(([n]) => !n.endsWith('-mask')).every(([, c]) => c === 1));
  assert.equal(model.calls.filter(c => c[0] === 'intent').length, 1);
});

test('server errors and rate limits retry; other client errors do not', async () => {
  for (const status of [500, 503, 408, 429]) {
    const draft = booklet(1), model = fixture(draft); model.fail('page', status, 1);
    await model.run({ criticalOnly: true });
    assert.equal(model.puts.get('p1'), 2, 'status ' + status);
  }
  const draft = booklet(1), model = fixture(draft); model.fail('page', 400, 1);
  await assert.rejects(model.run({ criticalOnly: true }));
  assert.equal(model.puts.get('p1'), 1);
});

test('a file that keeps failing stops the send; every other page stays confirmed and only it is sent again', async () => {
  const draft = booklet(4), model = fixture(draft);
  const actual = model.transport.putObject; let broken = true;
  model.transport.putObject = async (url, ...rest) => {
    if (broken && nameOf(model, url) === 'p3') { model.puts.set('p3', (model.puts.get('p3') || 0) + 1); throw new Error('interrupted'); }
    return actual(url, ...rest);
  };
  await assert.rejects(model.run({ criticalOnly: true }), /interrupted/);
  assert.equal(model.puts.get('p3'), 3); // first try and two retries
  assert.equal(draft.pages[2].upload_assets.page.status, 'failed');
  assert.ok([1, 2, 4].every(n => processingReady(draft.pages[n - 1])));
  broken = false;
  const before = new Map(model.puts);
  await model.run({ criticalOnly: true });
  assert.ok(draft.pages.every(processingReady));
  for (const [name, count] of model.puts) assert.equal(count, (before.get(name) ?? 0) + (name === 'p3' ? 1 : 0), name);
});

test('an interrupted send resumes without sending a landed file twice', async () => {
  const draft = booklet(13), model = fixture(draft), controller = new AbortController();
  slowPuts(model, 2);
  let count = 0;
  model.onPut(() => { if (++count === 10) controller.abort(); });
  await assert.rejects(model.run({ criticalOnly: true, signal: controller.signal }), { name: 'AbortError' });
  const landed = landedNames(model), before = new Map(model.puts);
  assert.ok(landed.size >= 10 && landed.size < 39);
  model.onPut(null);
  await model.run({ criticalOnly: true });
  assert.ok(draft.pages.every(processingReady));
  for (const name of landed) assert.equal(model.puts.get(name), before.get(name), name + ' was sent twice');
  assert.equal([...model.puts.keys()].length, 39);
});

test('a lost confirmation does not leave later files unsent or resent', async () => {
  const draft = booklet(13), model = fixture(draft);
  slowPuts(model, 2);
  const actual = model.transport.uploadComplete; let calls = 0;
  model.transport.uploadComplete = async body => { const r = await actual(body); if (++calls === 3) throw Object.assign(new Error('lost'), { status: 502 }); return r; };
  await assert.rejects(model.run({ criticalOnly: true }), /lost/);
  const landed = landedNames(model), before = new Map(model.puts);
  await model.run({ criticalOnly: true });
  assert.ok(draft.pages.every(processingReady));
  for (const name of landed) assert.equal(model.puts.get(name), before.get(name), name + ' was sent twice');
  assert.equal([...model.puts.keys()].length, 39);
});

test('originals in the same send still queue behind every page file', async () => {
  const draft = booklet(13), model = fixture(draft), order = [];
  const actual = model.transport.putObject;
  model.transport.putObject = async (url, ...rest) => { order.push(model.issued.get(url).kind); await tick(); return actual(url, ...rest); };
  await model.run();
  const firstRaw = order.indexOf('raw');
  assert.equal(firstRaw, 39);
  assert.ok(draft.pages.every(backupComplete));
});
