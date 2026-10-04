import assert from 'node:assert/strict';
import { uploadDraftAssets } from '../../src/scan/upload-runner.js';
import { applyAssetUpdates } from '../../src/scan/upload-state.js';
export function booklet(count, mixed = false) {
  return { id: 'draft', student_id: 'student', paper_id: 'paper', pages: Array.from({ length: count }, (_, i) => ({
    page_number: i + 1, upload_revision: 'r' + (i + 1), blob: new Blob(['page'], { type: 'image/jpeg' }),
    mask: !mixed || i % 2 === 0 ? new Blob(['mask']) : null,
    thumb: !mixed || i % 3 === 0 ? new Blob(['thumb']) : null,
    original: !mixed || i % 4 === 0 ? new Blob(['original'], { type: 'image/jpeg' }) : null,
    upload_assets: {}, width: 1000, height: 1400,
  })) };
}
export function fixture(draft) {
  let nonce = 0, active = 0, max = 0;
  const issued = new Map(), arrived = new Set(), puts = new Map(), calls = [];
  let failKind = null, failStatus, onPut;
  const transport = {
    async uploadIntent(body) {
      calls.push(['intent', body]); assert.ok(body.objects.length > 0 && body.objects.length <= 60);
      return { objects: body.objects.map(o => {
        const key = 'student/paper/' + o.kind + '/' + o.name + '-' + (++nonce);
        const cap = { ...o, key, bucket: o.kind === 'raw' ? 'originals' : 'derived', url: 'https://upload.test/' + key };
        issued.set(cap.url, cap); return cap;
      }).reverse(), expires_in: 900 };
    },
    async putObject(url, blob, type, { signal } = {}) {
      signal?.throwIfAborted(); const cap = issued.get(url);
      active++; max = Math.max(max, active);
      puts.set(cap.name, (puts.get(cap.name) || 0) + 1);
      try {
        await Promise.resolve(); signal?.throwIfAborted();
        if (cap.kind === failKind) { failKind = null; throw Object.assign(new Error('interrupted'), { status: failStatus }); }
        arrived.add(cap.key); onPut?.(cap);
      } finally { active--; }
    },
    async uploadComplete(body) {
      calls.push(['complete', body]); assert.ok(body.uploads.length > 0 && body.uploads.length <= 60);
      const confirmed = body.uploads.filter(o => arrived.has(o.key)).map(o => o.key);
      const missing = body.uploads.filter(o => !arrived.has(o.key)).map(o => ({ key: o.key, reason: 'that file did not arrive' }));
      if (missing.length) throw Object.assign(new Error('missing'), { status: 409, body: { confirmed, missing } });
      return { confirmed, missing };
    },
  };
  return { transport, puts, calls, arrived, issued, get max() { return max; },
    fail(kind, status) { failKind = kind; failStatus = status; }, onPut(fn) { onPut = fn; },
    run(options = {}) { return uploadDraftAssets({ draft, studentId: 'student', paperId: 'paper', mode: 'batch',
      transport, persist: async (d, updates) => applyAssetUpdates(d, updates), ...options }); } };
}
