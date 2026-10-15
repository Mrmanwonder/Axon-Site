/** Bound frontend waits while preserving caller cancellation. */
export async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const caller = init.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null);
  const cancel = () => controller.abort(caller?.reason);
  if (caller?.aborted) cancel();
  else caller?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('The request took too long. Please try again.', 'TimeoutError')), 30000);
  try {
    return await globalThis.fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', cancel);
  }
}

/* In-flight de-duplication for PostgREST reads (review #2).
   Screens mount several hooks that ask for the same rows at the same moment
   (Insights issued `attempts` and `questions` four times each). Identical
   concurrent GETs to /rest/v1/ now share one network request; each caller gets
   its own Response clone. Nothing is cached after the request settles, so a
   later read always goes to the server. Requests with a caller AbortSignal
   are never shared, so one caller cancelling cannot cancel another. */
const inflightReads = new Map();
export function readKey(input, init = {}) {
  const method = String(init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' || init.signal || typeof input !== 'string' || !input.includes('/rest/v1/')) return null;
  // Headers accepts objects, Headers instances and tuple arrays. All headers
  // participate: apikey/profile/range and future representation headers must
  // not accidentally share a response across authority or format boundaries.
  if (/\/rest\/v1\/consent_current(?:[?/#]|$)/.test(input)) return null; // dedicated write-fenced sharing in consent.js
  const headers = [...new Headers(init.headers).entries()].sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([input, headers, init.credentials, init.cache, init.mode, init.redirect]);
}
export function dedupedFetch(input, init = {}) {
  const key = readKey(input, init);
  if (!key) return fetchWithTimeout(input, init);
  let shared = inflightReads.get(key);
  if (!shared) {
    shared = fetchWithTimeout(input, init);
    inflightReads.set(key, shared);
    const clear = () => { if (inflightReads.get(key) === shared) inflightReads.delete(key); };
    shared.then(clear, clear);
  }
  return shared.then((res) => res.clone());
}
