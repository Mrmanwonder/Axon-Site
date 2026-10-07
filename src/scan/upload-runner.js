import { buildUploadPlan, splitUploadPlanIntoWindows, assertUploadSnapshot } from './upload-plan.js';
const checkAbort = signal => signal?.throwIfAborted();
const validConcurrency = concurrency => {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) throw new RangeError('Upload concurrency must be 1–6.');
};
export async function uploadPool(items, concurrency, work, signal) {
  validConcurrency(concurrency);
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
/**
 * At most `concurrency` tasks in flight, started in the order they were
 * scheduled. Unlike `uploadPool` it takes work as it arrives, so the next
 * window's files queue behind this window's without waiting for it to drain.
 */
export function createLimiter(concurrency) {
  validConcurrency(concurrency);
  let active = 0; const queue = [];
  const pump = () => {
    while (active < concurrency && queue.length) {
      const { task, resolve, reject } = queue.shift(); active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; pump(); });
    }
  };
  return task => new Promise((resolve, reject) => { queue.push({ task, resolve, reject }); pump(); });
}
// One PUT is retried in place for a dropped connection or a server hiccup, so
// one bad moment on a phone network does not restart the whole send. An expired
// link (403) is re-minted instead, and any other client error is final.
export const PUT_RETRY_DELAYS_MS = [1000, 3000];
const retryablePut = error => error?.status === undefined || error.status >= 500 || error.status === 408 || error.status === 429;
const pause = (ms, signal) => new Promise(resolve => {
  if (!ms) return resolve();
  const timer = setTimeout(done, ms);
  function done() { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); }
  signal?.addEventListener('abort', done, { once: true });
});
const CONFIRM_MAX = 60; // the API's per-request object limit
const absent = reason => reason === 'that file did not arrive' || reason === 'that file arrived incomplete';
export async function uploadDraftAssets({ draft, studentId, paperId, criticalOnly = false,
  mode = 'batch', concurrency = 4, maxObjects = 32, signal, timing, onProgress,
  transport, persist, guard = async () => {}, expiryRetries = 1, putRetryDelays = PUT_RETRY_DELAYS_MS }) {
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
  // Set once the streaming send has failed, so nothing new is started after it.
  let fatal = null;
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
  /** Confirm anything a lost response may already have delivered, then mint
      upload links for the rest and save their keys before any byte moves. */
  async function mint(window) {
    await ensureCurrent();
    // A lost response does not mean a lost object. Check uncertain keys first.
    const recovered = await confirm(window.filter(o => o.state.key), true);
    let pending = window.filter(o => !recovered.has(o.state.key));
    if (!pending.length) return [];
    await ensureCurrent();
    if (fatal) throw fatal;
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
    return pending;
  }
  const again = () => uploadDraftAssets({ draft, studentId, paperId, criticalOnly, mode, concurrency, maxObjects,
    signal, timing, onProgress, transport, persist, guard, expiryRetries: expiryRetries - 1, putRetryDelays });

  if (mode === 'legacy') {
    // The one-at-a-time uploader, kept exactly as it was: it is the server's
    // kill switch for the streaming path below (UPLOAD_BATCH_PERCENT).
    for (const window of windows) {
      const pending = await mint(window);
      if (!pending.length) continue;
      const results = await measure('transfer', () => uploadPool(pending, 1, async o => {
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
          timing?.retry(); return again();
        }
        timing?.stage('transfer'); throw failure.error;
      }
    }
    await ensureCurrent(); return draft;
  }

  // Streaming (AXO-211). Every window used to be a barrier: mint, send all of
  // it, confirm all of it, and only then ask for the next window's links, so the
  // uplink sat idle through two round trips and the server's seal of the whole
  // window. Now the next window is minted while this one transfers, files from
  // every window share one bounded pool in page order, and each file is
  // confirmed in small batches as it lands, so only the last batch's
  // confirmation is left when the final byte arrives.
  const inner = new AbortController();
  const stop = () => inner.abort(signal.reason);
  if (signal?.aborted) stop(); else signal?.addEventListener('abort', stop, { once: true });
  const fail = error => { fatal ??= error; if (!inner.signal.aborted) inner.abort(error); };
  const landed = [], failures = [], transfers = [];
  let confirming = null;
  const flush = () => {
    if (confirming || !landed.length || fatal) return;
    const batch = landed.splice(0, CONFIRM_MAX);
    confirming = (async () => {
      await write(batch.map(o => ({ descriptor: o, state: { ...o.state, status: 'uploaded' } })));
      await confirm(batch);
    })().catch(fail).finally(() => { confirming = null; flush(); });
  };
  const limit = createLimiter(concurrency);
  const mints = [];
  const mintAt = i => (mints[i] ??= mint(windows[i]));
  const put = async o => {
    for (let attempt = 0; !inner.signal.aborted; attempt++) {
      try { assertUploadSnapshot(draft, snapshot); } catch (error) { fail(error); return; }
      try {
        await transport.putObject(o.url, o.blob, o.content_type, { signal: inner.signal });
        landed.push(o); flush(); return;
      } catch (error) {
        if (inner.signal.aborted) return;
        if (attempt < putRetryDelays.length && retryablePut(error)) {
          timing?.retry(); await pause(putRetryDelays[attempt], inner.signal); continue;
        }
        failures.push({ object: o, error }); return;
      }
    }
  };
  try {
    await measure('transfer', async () => {
      for (let i = 0; i < windows.length && !fatal && !inner.signal.aborted; i++) {
        let pending;
        try { pending = await mintAt(i); } catch (error) { fail(error); break; }
        if (i + 1 < windows.length) mintAt(i + 1).catch(() => {}); // surfaced when awaited
        for (const o of pending) transfers.push(limit(() => inner.signal.aborted ? undefined : put(o)));
      }
      await Promise.all(transfers);
      while (confirming || (landed.length && !fatal)) { flush(); await confirming; }
    });
    // A window minted ahead must finish saving its keys before this returns
    // and the caller releases the send lease.
    await Promise.allSettled(mints);
  } finally { signal?.removeEventListener('abort', stop); }
  if (fatal && landed.length) {
    // Landed but never confirmed: say so locally, so a resume confirms them
    // before it sends anything again. Best effort; the keys are already saved.
    try { await write(landed.map(o => ({ descriptor: o, state: { ...o.state, status: 'uploaded' } }))); } catch { /* the resume still confirms by key */ }
  }
  checkAbort(signal);
  if (fatal) throw fatal;
  if (failures.length) {
    await write(failures.map(({ object }) => ({ descriptor: object, state: { ...object.state, status: 'failed' } })));
    if (expiryRetries > 0 && failures.every(f => f.error?.status === 403)) { timing?.retry(); return again(); }
    timing?.stage('transfer'); throw failures[0].error;
  }
  await ensureCurrent(); return draft;
}
