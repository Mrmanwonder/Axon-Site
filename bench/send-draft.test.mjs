import test from 'node:test';
import assert from 'node:assert/strict';
import { sendDraft } from '../src/scan/send-draft.js';
import { applyAssetUpdates } from '../src/scan/upload-state.js';
import { backupComplete, processingReady } from '../src/scan/upload-plan.js';
import { booklet, fixture } from './fixtures/upload-model.mjs';
function setup(count = 1) {
  const draft = booklet(count), model = fixture(draft), submitted = [], events = [];
  draft.paper_id = null; draft.paper_type = 'test';
  let created = 0, lease;
  const services = {
    newId: () => 'owner', tierForType: () => 1,
    async createPaper(body) { created++; assert.equal(body.requestId, draft.id); return { id: 'paper', type: 'test' }; },
    async mutateDraft(d, fn) { return fn(d); },
    async claimSendLease(d, owner) { if (lease && lease !== owner) throw new Error('leased'); lease = owner; },
    async touchSendLease(d, owner) { assert.equal(lease, owner); },
    async releaseSendLease(d, owner) { assert.equal(lease, owner); lease = null; },
    assertLease(d, owner) { assert.equal(lease, owner); },
    async updateAssets(d, updates) { return applyAssetUpdates(d, updates); },
    transport: { ...model.transport, async submitPaper(body) { submitted.push(structuredClone(body)); return { run_id: 'run', queued: true }; } },
  };
  const run = options => sendDraft({ draft, studentId: 'student', mode: 'batch', onTelemetry: (...event) => events.push(event), ...options }, services);
  return { draft, model, services, run, submitted, events, get created() { return created; } };
}
test('one durable paper, exact manifest and telemetry on accepted send; retries do not reupload', async () => {
  const f = setup(5); const result = await f.run();
  assert.equal(result.paperId, 'paper'); assert.equal(f.created, 1); assert.equal(f.submitted.length, 1);
  assert.ok(f.draft.pages.every(processingReady)); assert.ok(f.draft.pages.every(backupComplete));
  assert.equal(f.draft.pages[0].original, null);
  assert.equal(f.submitted[0].pages[0].conditioning_meta.upload_revision, 'r1');
  const puts = [...f.model.puts.values()].reduce((a,b) => a+b,0);
  await f.run(); assert.equal(f.created, 1); assert.equal(f.submitted.length, 1);
  assert.equal([...f.model.puts.values()].reduce((a,b) => a+b,0), puts);
  assert.deepEqual(f.events.map(e => e[0]), ['paper_send_completed','paper_send_completed']);
});
test('early submit confirms critical files and retains every original until attachment', async () => {
  const f = setup(10); await f.run({ earlySubmit: true });
  assert.ok(f.draft.pages.every(processingReady));
  assert.ok(f.draft.pages.every(p => !backupComplete(p) && p.original instanceof Blob && p.original_requires_attachment));
  assert.ok(f.submitted[0].pages.every(p => p.original_key === null));
  assert.equal(f.model.puts.size, 30);
});
test('lost submit response freezes exact date, keys and idempotency body on retry', async () => {
  const f = setup(); let fail = true;
  f.services.transport.submitPaper = async body => { f.submitted.push(structuredClone(body)); if (fail) { fail=false; throw new Error('lost response'); } return { run_id: 'same-run', queued: true }; };
  await assert.rejects(f.run({ dateTaken: '2026-10-04' }), /lost/);
  assert.ok(f.draft.submission_started); assert.equal(f.draft.submission, undefined);
  const puts = f.model.puts.size;
  await f.run({ dateTaken: '2026-10-05' });
  assert.deepEqual(f.submitted[1], f.submitted[0]); assert.equal(f.model.puts.size, puts); assert.equal(f.created,1);
  assert.deepEqual(f.events.map(e=>e[0]), ['paper_send_failed','paper_send_completed']);
});
test('queued=false retries the same submission without minting or transferring again', async () => {
  const f=setup();
  f.services.transport.submitPaper=async body=> {f.submitted.push(structuredClone(body));return {run_id:'run',queued:f.submitted.length>1};};
  await f.run(); const puts=f.model.puts.size;
  assert.equal(f.events[0][1].queued,false); await f.run();
  assert.equal(f.events[1][1].queued,true); assert.equal(f.created,1); assert.equal(f.model.puts.size,puts); assert.deepEqual(f.submitted[0],f.submitted[1]);
});
test('wrong-student and cancelled sends cannot create papers or transfer assets', async () => {
  const f=setup(); await assert.rejects(sendDraft({draft:f.draft,studentId:'other'},f.services),/student/);
  const controller=new AbortController(); controller.abort(); await assert.rejects(f.run({signal:controller.signal}));
  assert.equal(f.created,0); assert.equal(f.model.puts.size,0);
});
