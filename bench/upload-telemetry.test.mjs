import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { uploadTiming, sanitizeUploadTelemetry } from '../src/scan/upload-telemetry.js';
test('send telemetry has one terminal event and a numeric property allowlist', async () => {
  let clock = 10; const events = [];
  const timing = uploadTiming({ startedAt: 0, now: () => clock, emit: (...e) => events.push(e) });
  timing.count([{ kind: 'page', bytes: 42, key: 'private' }], 1);
  await timing.measure('intent', () => { clock += 5; });
  timing.retry(); timing.finish(null, false); timing.finish(new Error('secret'));
  assert.equal(events.length, 1);
  assert.equal(events[0][1].intent_ms, 5);
  assert.equal(events[0][1].send_to_ingest_ms, 10);
  assert.equal(events[0][1].send_to_submit_ms, 15);
  assert.equal(events[0][1].retry_count, 1);
  assert.equal(events[0][1].queued, false);
  assert.deepEqual(sanitizeUploadTelemetry({ token: 'private', page_count: Infinity, total_bytes: -1, error: 'secret', mode: 'untrusted' }), {});
});
test('failure reports its stage without copying error content; analytics errors never affect sending', async () => {
  const events = []; const t = uploadTiming({ emit: (...e) => events.push(e) });
  await assert.rejects(t.measure('confirmation', () => { throw new Error('private signed url'); }));
  t.finish(new Error('private')); assert.equal(events[0][0], 'paper_send_failed');
  assert.equal(events[0][1].failure_stage, 'confirmation'); assert.ok(!JSON.stringify(events).includes('private'));
  const broken = uploadTiming({ emit: () => { throw new Error('analytics offline'); } });
  assert.doesNotThrow(() => broken.finish());
});
test('aggregate counts include separate page, mask, thumbnail and original bytes', () => {
  const t = uploadTiming(); t.count([{ kind: 'page', bytes: 5 }, { kind: 'mask', bytes: 2 }, { kind: 'raw', bytes: 10 }, { kind: 'thumb', bytes: 1 }], 1);
  assert.equal(t.data.total_bytes, 18); assert.equal(t.data.object_count, 4);
  assert.equal(t.data.raw_bytes, 10); assert.equal(t.data.page_count, 1);
});
test('real ingest records acceptance before the processing watch, and never emits a second failure for processing errors', async () => {
  const source = fs.readFileSync(new URL('../src/scan/pipeline.js', import.meta.url), 'utf8');
  const begin = source.indexOf('export async function ingest('), end = source.indexOf('\n/**', begin);
  const body = source.slice(begin, end).replace('export async function', 'async function');
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  let clock = 0; const events = []; let watched = false;
  const createTiming = options => uploadTiming({ ...options, now: () => clock });
  const run = new AsyncFunction('uploadTiming','pendingPages','createPaper','saveDraft','uploadScannedPage','markUploaded','submitPaper','tierForType','CAPTURE','waitForReview','sb','args',
    body + '\nreturn ingest(args);');
  const draft = { id: 'private-draft', pages: [{ page_number: 1, blob: new Blob(['abc']), source_kind: 'camera' }] };
  const args = { studentId: 'private-student', draft, paperType: 'school', sendStartedAt: -3, onTelemetry: (...e) => events.push(e) };
  const result = await run(createTiming, d => d.pages,
    async () => { clock += 2; return { id: 'private-paper', type: 'school' }; },
    async () => { clock += 1; },
    async ({ timing }) => {
      await timing.measure('intent', async () => { clock += 4; });
      await timing.measure('transfer', async () => { clock += 6; });
      await timing.measure('confirmation', async () => { clock += 3; });
      return { r2_key: 'private-key', r2_bucket: 'derived' };
    },
    async (d, n, keys) => { clock += 1; Object.assign(d.pages[0], keys); },
    async () => { clock += 2; return { run_id: 'private-run', queued: false }; },
    () => 'one', { UPLOAD_EXTENSIONS: { 'image/jpeg': 'jpg' } },
    async () => { watched = true; assert.equal(events.length, 1); clock += 50000; return { processing: true, status: 'queued' }; },
    {}, args);
  assert.equal(result.processing, true); assert.equal(watched, true);
  assert.equal(events.length, 1); assert.equal(events[0][1].send_to_submit_ms, 23);
  assert.equal(events[0][1].persistence_ms, 3); assert.equal(events[0][1].object_count, 1);
  assert.equal(events[0][1].queued, false);
  assert.ok(!JSON.stringify(events).includes('private'));
});

test('validation failures between stages still identify their stage without claiming submission acceptance', async () => {
  const events = []; let clock = 0;
  const t = uploadTiming({ now: () => clock, emit: (...e) => events.push(e) });
  await t.measure('intent', () => { clock += 7; });
  clock += 2; t.finish(new Error('invalid capability'));
  assert.equal(events[0][1].failure_stage, 'intent');
  assert.equal(events[0][1].send_to_failure_ms, 9);
  assert.equal('send_to_submit_ms' in events[0][1], false);
});

test('offline rejection before intent is classified as upload preparation, not local persistence', async () => {
  const source = fs.readFileSync(new URL('../src/papers.js', import.meta.url), 'utf8');
  const begin = source.indexOf('export async function uploadScannedPage('), end = source.indexOf('\n/**', begin);
  const body = source.slice(begin, end).replace('export async function', 'async function');
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const invoke = new AsyncFunction('requireOnline', 'args', body + '\nreturn uploadScannedPage(args);');
  const events = []; const t = uploadTiming({ emit: (...e) => events.push(e) });
  await t.measure('persistence', () => {});
  let failure;
  try { await invoke(() => { throw new Error('offline'); }, { timing: t }); }
  catch (error) { failure = error; }
  assert.ok(failure); t.finish(failure);
  assert.equal(events[0][1].failure_stage, 'intent');
});
