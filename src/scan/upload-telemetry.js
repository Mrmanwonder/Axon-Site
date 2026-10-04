// Aggregate only. Never include ids, storage keys, URLs, content or errors.
export const UPLOAD_STAGES = ['paper_create', 'planning', 'intent', 'transfer', 'confirmation', 'persistence', 'submit'];
export const UPLOAD_KINDS = ['page', 'mask', 'thumb', 'raw'];
/** @returns {Record<string, any>} */
export function sanitizeUploadTelemetry(input = {}) {
  const out = {};
  const numeric = ['page_count', 'object_count', 'total_bytes', 'retry_count', 'send_to_ingest_ms', 'send_to_submit_ms',
    ...UPLOAD_STAGES.map(s => `${s}_ms`), ...UPLOAD_KINDS.flatMap(k => [`${k}_count`, `${k}_bytes`])];
  for (const key of numeric) if (Number.isFinite(input[key]) && input[key] >= 0) out[key] = Math.round(input[key]);
  if (['legacy', 'batch'].includes(input.mode)) out.mode = input.mode;
  if (UPLOAD_STAGES.includes(input.failure_stage)) out.failure_stage = input.failure_stage;
  if (['offline', 'cancelled', 'auth', 'network', 'server', 'local', 'other'].includes(input.failure_kind)) out.failure_kind = input.failure_kind;
  if (typeof input.queued === 'boolean') out.queued = input.queued;
  return out;
}
export function uploadTiming({ startedAt, emit, now = () => performance.now(), mode = 'legacy' } = {}) {
  const start = startedAt ?? now();
  const data = { mode, retry_count: 0, send_to_ingest_ms: now() - start };
  let ended = false;
  return {
    data,
    count(objects, pages) {
      data.page_count = pages; data.object_count = objects.length;
      data.total_bytes = objects.reduce((n, o) => n + (o.bytes ?? o.blob?.size ?? 0), 0);
      for (const kind of UPLOAD_KINDS) {
        const items = objects.filter(o => o.kind === kind);
        data[`${kind}_count`] = items.length;
        data[`${kind}_bytes`] = items.reduce((n, o) => n + (o.bytes ?? o.blob?.size ?? 0), 0);
      }
    },
    retry() { data.retry_count++; },
    async measure(stage, action) {
      const at = now();
      try { return await action(); }
      catch (error) { data.failure_stage ??= stage; throw error; }
      finally { data[`${stage}_ms`] = (data[`${stage}_ms`] ?? 0) + now() - at; }
    },
    finish(error, queued) {
      if (ended) return; ended = true;
      data.send_to_submit_ms = now() - start;
      if (error) data.failure_kind = error.name === 'AbortError' ? 'cancelled'
        : globalThis.navigator?.onLine === false ? 'offline'
        : error.status === 401 ? 'auth' : error.status >= 500 ? 'server'
        : data.failure_stage === 'persistence' ? 'local' : 'other';
      if (typeof queued === 'boolean') data.queued = queued;
      try { emit?.(error ? 'paper_send_failed' : 'paper_send_completed', sanitizeUploadTelemetry(data)); }
      catch { /* Optional analytics can never fail a send. */ }
    },
  };
}
