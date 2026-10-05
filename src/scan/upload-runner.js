import { buildUploadPlan, splitUploadPlanIntoWindows, assertUploadSnapshot } from './upload-plan.js';
const checkAbort = signal => signal?.throwIfAborted();
export async function uploadPool(items, concurrency, work, signal) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) throw new RangeError('Upload concurrency must be 1–6.');
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length && !signal?.aborted) {
      const i = next++;
      try { results[i] = { ok: true, value: await work(items[i], i) }; }
      catch (error) { results[i] = { ok: false, error }; }
    }
  }));
  return results;
}
const absent = reason => reason === 'that file did not arrive' || reason === 'that file arrived incomplete';
export async function uploadDraftAssets({ draft, studentId, paperId, criticalOnly = false,
  mode = 'batch', concurrency = 3, maxObjects = 32, signal, timing, onProgress,
  transport, persist, guard = async () => {}, expiryRetries = 1 }) {
  const snapshot = draft.pages.map(p => ({ page_number: p.page_number, upload_revision: p.upload_revision }));
  const measure = (stage, work) => timing ? timing.measure(stage, work) : work();
  // Progress is told in pages, the unit the student took. A page counts as sent
  // once every file the reader needs for it is confirmed; the original photo is
  // a backup and finishes later. (Owner, 5 Oct 2026: "48 files" for 12 pages.)
  const report = () => {
    const plan = buildUploadPlan(draft), confirmed = plan.filter(o => o.state.status === 'confirmed').length;
    const pages = new Map();
    for (const o of plan) if (o.critical) pages.set(o.page_number, (pages.get(o.page_number) ?? true) && o.state.status === 'confirmed');
    const total = draft.pages.length;
    const sentPages = [...pages.entries()].filter(([, ok]) => ok).map(([n]) => n).sort((a, b) => a - b);
    const sent = sentPages.length;
    onProgress?.({ confirmed, total: plan.length, pagesSent: sent, pagesTotal: total, sentPages,
      message: `${sent} of ${total} ${total === 1 ? 'page' : 'pages'} safely sent` });
  };
  async function write(updates) {
    if (!updates.length) return;
    const result = await measure('persistence', () => persist(draft, updates));
    report();
    if (result?.stale?.length) throw new Error('A page changed while uploading. Send the current draft again.');
  }
  async function ensureCurrent() {
    checkAbort(signal); await guard(); checkAbort(signal);
    assertUploadSnapshot(draft, snapshot);
  }
  const all = buildUploadPlan(draft);
  const objects = all.filter(o => o.state.status !== 'confirmed' && (!criticalOnly || o.critical));
  // Critical assets precede originals without dropping page groups.
  if (mode === 'batch') objects.sort((a, b) => Number(b.critical) - Number(a.critical) || a.page_number - b.page_number ||
    ['thumb', 'page', 'mask', 'raw'].indexOf(a.kind) - ['thumb', 'page', 'mask', 'raw'].indexOf(b.kind));
  const critical = mode === 'batch' ? objects.filter(o => o.critical) : objects;
  const original = mode === 'batch' ? objects.filter(o => !o.critical) : [];
  // Small booklets use one capability window, with every critical asset queued
  // first. Larger transfers keep originals in later windows to bound URL age.
  const small = mode === 'batch' && objects.length <= maxObjects && objects.reduce((n, o) => n + o.bytes, 0) <= 8 * 1024 * 1024;
  const windows = small ? (objects.length ? [objects] : []) : [...splitUploadPlanIntoWindows(critical, mode === 'legacy' ? 4 : maxObjects),
    ...splitUploadPlanIntoWindows(original, maxObjects)];
  report();
  async function confirm(items, allowAbsent = false) {
    if (!items.length) return new Set();
    await ensureCurrent();
    const response = await measure('confirmation', async () => {
      try {
        return await transport.uploadComplete({ paper_id: paperId,
          uploads: items.map(o => ({ key: o.state.key, bucket: o.state.bucket, ...(o.bytes > 0 ? { bytes: o.bytes } : {}) })) }, { signal, onRetry: timing?.retry });
      } catch (error) {
        if (error.status !== 409 || !Array.isArray(error.body?.confirmed) || !Array.isArray(error.body?.missing)) throw error;
        return error.body;
      }
    });
    if (!Array.isArray(response?.confirmed) || !Array.isArray(response?.missing)) throw new Error('The server did not report upload confirmation.');
    const keys = new Set(items.map(o => o.state.key));
    if (response.confirmed.some(key => !keys.has(key)) || response.missing.some(o => !keys.has(o.key))) throw new Error('The server confirmation did not match this window.');
    const accepted = new Set(response.confirmed);
    await write(items.map(o => {
      const missing = response.missing.find(m => m.key === o.state.key);
      return { descriptor: o, state: accepted.has(o.state.key) ? { ...o.state, status: 'confirmed' }
        : { ...o.state, status: 'failed', reason: missing?.reason === 'that file did not arrive' ? 'missing'
          : missing?.reason === 'that file arrived incomplete' ? 'incomplete' : 'verification' } };
    }));
    const remaining = items.filter(o => !accepted.has(o.state.key));
    if (remaining.length && (!allowAbsent || remaining.some(o => !response.missing.some(m => m.key === o.state.key && absent(m.reason))))) {
      throw new Error('Some files could not be confirmed. Your photos are saved; retry when connected.');
    }
    return accepted;
  }
  for (const window of windows) {
    await ensureCurrent();
    // A lost response does not mean a lost object. Check uncertain keys first.
    const recovered = await confirm(window.filter(o => o.state.key), true);
    let pending = window.filter(o => !recovered.has(o.state.key));
    if (!pending.length) continue;
    await ensureCurrent();
    const intent = await measure('intent', () => transport.uploadIntent({ student_id: studentId, paper_id: paperId,
      objects: pending.map(o => ({ kind: o.kind, name: o.name, content_type: o.content_type, bytes: o.bytes,
        page_number: o.page_number, page_revision: o.revision,
        ...(o.kind === 'raw' && draft.pages.find(p => p.page_number === o.page_number)?.r2_key ? { page_key: draft.pages.find(p => p.page_number === o.page_number)?.r2_key } : {}) })) },
      { signal, onRetry: timing?.retry }));
    if (!Array.isArray(intent?.objects) || intent.objects.length !== pending.length) throw new Error('The server did not prepare every file.');
    const minted = new Set();
    pending = pending.map(o => {
      const matches = intent.objects.filter(c => c.kind === o.kind && c.name === o.name), cap = matches[0];
      const bucket = o.kind === 'raw' ? 'originals' : 'derived';
      if (matches.length !== 1 || cap.bucket !== bucket || typeof cap.key !== 'string' || !cap.key ||
        typeof cap.url !== 'string' || !cap.url || minted.has(cap.key) || !o.blob) throw new Error('The server prepared an invalid upload window.');
      minted.add(cap.key);
      return { ...o, url: cap.url, state: { status: 'uploading', key: cap.key, bucket, bytes: o.bytes } };
    });
    // Persist capabilities before bytes. URLs are never retained in IndexedDB.
    await write(pending.map(o => ({ descriptor: o, state: o.state })));
    await ensureCurrent();
    const results = await measure('transfer', () => uploadPool(pending, mode === 'legacy' ? 1 : concurrency, async o => {
      checkAbort(signal); assertUploadSnapshot(draft, snapshot);
      await transport.putObject(o.url, o.blob, o.content_type, { signal });
    }, signal));
    await write(pending.flatMap((o, i) => results[i] ? [{ descriptor: o, state: { ...o.state, status: results[i].ok ? 'uploaded' : 'failed' } }] : []));
    // After cancellation, retry will confirm even failed/uncertain PUTs.
    checkAbort(signal);
    await confirm(pending.filter((o, i) => results[i]?.ok));
    const failure = results.find(r => r && !r.ok);
    if (failure) {
      if (failure.error?.status === 403 && expiryRetries > 0 && results.every(r => !r || r.ok || r.error?.status === 403)) {
        timing?.retry();
        return uploadDraftAssets({ draft, studentId, paperId, criticalOnly, mode, concurrency, maxObjects,
          signal, timing, onProgress, transport, persist, guard, expiryRetries: expiryRetries - 1 });
      }
      timing?.stage('transfer'); throw failure.error;
    }
  }
  await ensureCurrent(); return draft;
}
