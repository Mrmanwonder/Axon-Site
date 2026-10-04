import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUploadPlan, pendingUploadPlan, processingReady, backupComplete, splitUploadPlanIntoWindows, revisionOf } from '../src/scan/upload-plan.js';
import { applyAssetUpdates, renumberPages } from '../src/scan/upload-state.js';
import { uploadDraftAssets, uploadPool } from '../src/scan/upload-runner.js';

import { booklet, fixture } from './fixtures/upload-model.mjs';
for (const count of [1, 5, 10, 25]) {
  test('deterministic ' + count + '-page planning and bounded reverse-order capabilities', async () => {
    const draft = booklet(count), before = buildUploadPlan(draft);
    assert.deepEqual(before, buildUploadPlan(draft)); assert.equal(before.length, count * 4);
    const windows = splitUploadPlanIntoWindows(before);
    assert.ok(windows.every(w => w.length <= 32));
    const model = fixture(draft); await model.run();
    assert.ok(model.max <= 3); assert.ok(model.max > 1);
    assert.equal(pendingUploadPlan(draft).length, 0);
    assert.ok(draft.pages.every(processingReady)); assert.ok(draft.pages.every(backupComplete));
    assert.ok(draft.pages.every(p => p.r2_key.includes('/page/') && p.mask_key.includes('/mask/') && p.thumb_key.includes('/thumb/') && p.original_key.includes('/raw/')));
    assert.equal(model.calls.filter(c => c[0] === 'intent').length, Math.ceil(count / 10) + Math.ceil(count / 32));
  });
}
test('mixed optional assets and old drafts never fabricate optional confirmation', async () => {
  const draft = booklet(10, true); const model = fixture(draft); await model.run();
  assert.ok(draft.pages.every(processingReady)); assert.ok(draft.pages.every(backupComplete));
  const old = { pages: [{ page_number: 1, uploaded: true, r2_key: 'server-page', blob: new Blob(['p']), mask: new Blob(['m']), thumb: new Blob(['t']), original: new Blob(['o']) }] };
  const plan = buildUploadPlan(old); assert.equal(plan.find(o => o.kind === 'page').state.status, 'confirmed');
  assert.ok(plan.filter(o => o.kind !== 'page').every(o => o.state.status === 'pending'));
  assert.equal(processingReady(old.pages[0]), false);
  old.pages[0].r2_key = null; assert.equal(buildUploadPlan(old)[0].state.status, 'pending');
});
test('partial PUT failure keeps successes and retries only unconfirmed assets', async () => {
  const draft = booklet(1), model = fixture(draft); model.fail('mask');
  await assert.rejects(model.run());
  assert.equal(draft.pages[0].upload_assets.page.status, 'confirmed');
  assert.equal(draft.pages[0].upload_assets.thumb.status, 'confirmed');
  assert.equal(draft.pages[0].upload_assets.mask.status, 'failed');
  const original = draft.pages[0].original; await model.run();
  assert.equal(model.puts.get('p1'), 1); assert.equal(model.puts.get('p1-thumb'), 1);
  assert.equal(model.puts.get('p1-mask'), 2); assert.equal(model.puts.get('p1-original'), 1);
  assert.equal(draft.pages[0].original, original); // No blob discarded before submission.
});
test('lost confirmation response resumes canonical bytes without a second PUT', async () => {
  const draft = booklet(1), model = fixture(draft); const actual = model.transport.uploadComplete; let fail = true;
  model.transport.uploadComplete = async body => { const r = await actual(body); if (fail) { fail = false; throw Object.assign(new Error('database unavailable'), { status: 500 }); } return r; };
  await assert.rejects(model.run()); assert.equal(draft.pages[0].upload_assets.page.status, 'uploaded');
  await model.run(); assert.equal(model.puts.get('p1'), 1); assert.equal(model.puts.get('p1-mask'), 1);
  assert.ok(model.calls.filter(c => c[0] === 'complete').length >= 3);
});
test('expiry recovery confirms failed capability before refreshing only missing objects', async () => {
  const draft = booklet(1), model = fixture(draft); model.fail('mask', 403); await model.run();
  assert.equal(model.puts.get('p1'), 1); assert.equal(model.puts.get('p1-mask'), 2);
  const intents = model.calls.filter(c => c[0] === 'intent'); assert.equal(intents[1][1].objects.length, 1);
  assert.equal(intents[1][1].objects[0].kind, 'mask');
});
test('cancellation leaves issued keys durable and resumes uncertain bytes first', async () => {
  const draft = booklet(1), model = fixture(draft), controller = new AbortController();
  model.onPut(() => controller.abort());
  await assert.rejects(model.run({ signal: controller.signal }), { name: 'AbortError' });
  const existing = [...model.arrived]; assert.ok(existing.length > 0);
  assert.ok(draft.pages[0].upload_assets.page.key);
  model.onPut(null); await model.run();
  for (const key of existing) {
    const object = [...model.issued.values()].find(c => c.key === key);
    assert.equal(model.puts.get(object.name), 1);
  }
});
test('stale revisions cannot install keys, while independent confirmations survive atomically', () => {
  const draft = booklet(2), plan = buildUploadPlan(draft), first = plan.find(o => o.page_number === 1 && o.kind === 'page'), second = plan.find(o => o.page_number === 2 && o.kind === 'page');
  draft.pages[0].upload_revision = 'retaken';
  const result = applyAssetUpdates(draft, [first, second].map(descriptor => ({ descriptor, state: { status: 'confirmed', key: descriptor.id, bucket: 'derived' } })));
  assert.deepEqual(result.stale, [first.id]); assert.equal(draft.pages[0].r2_key, undefined);
  assert.equal(draft.pages[1].r2_key, second.id);
  applyAssetUpdates(draft, [{ descriptor: second, state: { status: 'pending' } }]);
  assert.equal(draft.pages[1].upload_assets.page.status, 'confirmed');
  const reordered = renumberPages([draft.pages[1], draft.pages[0]]);
  assert.notEqual(revisionOf(reordered[0]), second.revision); assert.equal(reordered[0].r2_key, null);
});
test('byte windows prefer page boundaries, split oversized groups, and preserve every object', () => {
  const objects = buildUploadPlan(booklet(5)); objects.forEach(o => { o.bytes = 100; });
  const windows = splitUploadPlanIntoWindows(objects, 60, 500);
  assert.deepEqual(windows.map(w => w.length), [4, 4, 4, 4, 4]);
  assert.equal(windows.flat().length, objects.length);
  for (const cap of [0, 1, 61]) assert.throws(() => splitUploadPlanIntoWindows(objects, cap));
  assert.ok(splitUploadPlanIntoWindows(objects, 60).every(w => w.length <= 60));
});
test('critical-only handoff never transfers originals and reports actual confirmations', async () => {
  const draft = booklet(10), model = fixture(draft), progress = []; await model.run({ criticalOnly: true, onProgress: p => progress.push(p) });
  assert.equal([...model.puts.keys()].some(n => n.endsWith('-original')), false);
  assert.ok(draft.pages.every(processingReady)); assert.equal(draft.pages.every(backupComplete), false);
  assert.equal(progress.at(-1).confirmed, 30); assert.equal(progress.at(-1).total, 40);
});
test('pool enforces 2/3/4/6 in-flight limits and deterministic results', async () => {
  for (const limit of [2, 3, 4, 6]) {
    let active = 0, max = 0;
    const results = await uploadPool(Array.from({ length: 25 }, (_, i) => i), limit, async n => {
      active++; max = Math.max(max, active); await Promise.resolve(); active--; if (n === 7) throw new Error('seven'); return n * 2;
    });
    assert.equal(max, limit); assert.equal(results[7].ok, false); assert.equal(results[24].value, 48);
  }
});

test('reordering remints page-bound originals while preserving their local bytes', async()=>{
  const draft=booklet(2),model=fixture(draft);await model.run();
  const reordered=renumberPages([draft.pages[1],draft.pages[0]]);
  assert.ok(reordered.every(p=>p.original instanceof Blob&&!p.original_key&&!p.r2_key&&!p.uploaded));
  assert.deepEqual(await Promise.all(reordered.map(p=>p.original.text())),['original','original']);
});
