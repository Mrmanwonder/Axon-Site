// Calling the pipeline's server stages.
//
// The pipeline itself lives in Cloudflare — a set of `mastery-*` Workers behind
// this one API Worker, chosen over Supabase Edge Functions specifically because
// a sixteen-page booklet's structure and content passes do not fit inside a
// 2-second CPU cap. This module is the only place that knows that URL and the
// bearer-token handshake; everything else calls a plain-named function.
//
// Every call carries the guardian's own session. Nothing in this pipeline runs
// with more authority than the person who started it.

import { sb, currentSession } from '../supabase.js';
import { MASTERY_API_URL } from '../config.js';

// One request-level timeout and one retry, for the transient case: a blip on a
// 4G connection, not the R2-CORS-shaped bug that used to surface here. Every
// resilience feature above this layer (idempotency keys, resumable per-page
// drafts) already assumes a request either lands or fails cleanly — a single
// unguarded `fetch()` with no timeout meant a stalled connection surfaced as a
// long silent hang rather than either of those.
const REQUEST_TIMEOUT_MS = 20000;
const RETRY_DELAY_MS = 1200;

/** fetch(), but bounded and retried once on a network-level failure. */
async function resilientFetch(url, init, timeoutMs = REQUEST_TIMEOUT_MS, onRetry, retry = true) {
  for (let attempt = 0; ; attempt++) {
    init.signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(init.signal.reason);
    init.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...init, signal: controller.signal }); }
    catch (error) {
      if (init.signal?.aborted || attempt > 0 || !retry) throw error;
      onRetry?.(); await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    } finally { clearTimeout(timeout); init.signal?.removeEventListener('abort', abort); }
  }
}
let refreshing = null;
export async function post(path, body, { timeoutMs, onRetry, signal } = {}) {
  let session = await currentSession();
  if (!session) throw Object.assign(new Error('Sign in first.'), { code: 'unauthenticated', status: 401 });
  const owner = session.user?.id;
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await resilientFetch(MASTERY_API_URL + path, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify(body),
      }, timeoutMs, onRetry);
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    if (res.status === 401 && attempt === 0) {
      const current = await currentSession();
      if (!current || current.user?.id !== owner) throw Object.assign(new Error('Sign in again to continue this upload.'), { status: 401 });
      refreshing ??= sb.auth.refreshSession().finally(() => { refreshing = null; });
      const refreshed = await refreshing;
      session = refreshed.data?.session; signal?.throwIfAborted();
      if (refreshed.error || !session || session.user?.id !== owner) throw Object.assign(new Error('Sign in again to continue this upload.'), { status: 401 });
      onRetry?.(); continue; // Retry the API confirmation, never its PUTs.
    }
    const text = await res.text(); let data = null;
    if (text) { try { data = JSON.parse(text); } catch { /* not JSON */ } }
    if (!res.ok) throw Object.assign(new Error(data?.error || data?.message || 'That did not work (' + res.status + ').'), { status: res.status, body: data });
    return data;
  }
}
const optionsFor = options => typeof options === 'function' ? { onRetry: options } : options;
export const uploadPolicy = (options) => post('/upload-policy', {}, options);
export const attachOriginals = (body, options) => post('/paper-originals', body, options);

/** Ask for presigned R2 upload URLs for a batch of page/mask objects. */
export const uploadIntent = (body, options) => post('/upload-intent', body, optionsFor(options));

/** Tell the server the uploads it presigned have actually landed. */
export const uploadComplete = (body, options) => post('/upload-complete', body, optionsFor(options));

/**
 * Hand the pipeline a paper and its pages. Stages 3 through 7 run server-side
 * and asynchronously from here on — this call only starts them.
 */
export const submitPaper = (body, options) => post('/paper-submit', body, optionsFor(options));

/** Retry a failed saved paper using the server-owned stored page keys. */
export const retryFailedPaper = (paperId) => post('/paper-retry', { paper_id: paperId });

/** Stage 8's gate: nothing is explained until every region has been through review. */
export const reviewComplete = (body) => post('/review-complete', body);

/** Re-queue the explanations that failed on a run. Pages and marks are not re-read. */
export const explainRetry = (runId) => post('/explain-retry', { run_id: runId });

/**
 * One tutor turn. The server binds it to the active Student Mode scope and
 * loads any paper evidence itself; the body carries only ids and the question.
 * A model answer with thinking can take well past the pipeline's 20 s, so this
 * call waits longer before treating the connection as lost.
 */
export const askTutor = (body) => post('/tutor', body, { timeoutMs: 60000 });

/** Signed URLs for a page's stored image and mask. */
export const pageAssetUrls = (body) => post('/page-asset-urls', body);

/** Upload one blob straight to R2 via a presigned PUT URL. */
export async function putObject(url, blob, contentType, options) {
  const { signal } = optionsFor(options) ?? {};
  let res;
  try {
    // A failed/expired PUT is uncertain. The runner confirms before retrying.
    res = await resilientFetch(url, { method: 'PUT', signal, headers: { 'Content-Type': contentType }, body: blob }, 900000, undefined, false);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('The upload was interrupted. Check your connection and try again.');
  }
  if (!res.ok) throw Object.assign(new Error('The upload did not go through (' + res.status + ').'), { status: res.status });
}

/**
 * Run a list of jobs a few at a time.
 *
 * Not for politeness: a booklet with twenty questions firing twenty parallel
 * frontier-model calls will hit a rate limit, and the failure lands on a student
 * watching a paper half-fill. A small pool finishes at nearly the same wall
 * clock and finishes reliably.
 */
export async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { ok: true, value: await worker(items[i], i) }; }
      catch (error) { results[i] = { ok: false, error }; }
    }
  });
  await Promise.all(runners);
  return results;
}
