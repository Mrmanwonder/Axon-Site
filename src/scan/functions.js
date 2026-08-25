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

import { currentSession } from '../supabase.js';
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
async function resilientFetch(url, init) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      // A response that came back with a bad status is not caught here — only
      // a request that never got a response at all (offline, DNS, aborted).
      // Retrying a request the server already received and is acting on would
      // be the wrong fix; the idempotency key upstream is what makes that safe
      // if it does happen, not this loop.
      if (attempt > 0) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function post(path, body) {
  const session = await currentSession();
  if (!session) {
    const err = new Error('Sign in first.');
    err.code = 'unauthenticated';
    throw err;
  }

let res;
  try {
    res = await resilientFetch(`${MASTERY_API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { /* not JSON */ }
  }

if (!res.ok) {
  // The API's own message is the useful one — it was written for the
  // student. A bare status code rarely is.
  const message = data?.error || data?.message || text || `That did not work (${res.status}).`;
  const wrapped = new Error(message);
  wrapped.status = res.status;
  wrapped.body = data;
  throw wrapped;
}

return data;
}

/** Ask for presigned R2 upload URLs for a batch of page/mask objects. */
export const uploadIntent = (body) => post('/upload-intent', body);

/** Tell the server the uploads it presigned have actually landed. */
export const uploadComplete = (body) => post('/upload-complete', body);

/**
 * Hand the pipeline a paper and its pages. Stages 3 through 7 run server-side
 * and asynchronously from here on — this call only starts them.
 */
export const submitPaper = (body) => post('/paper-submit', body);

/** Stage 8's gate: nothing is explained until every region has been through review. */
export const reviewComplete = (body) => post('/review-complete', body);

/** Signed URLs for a page's stored image and mask. */
export const pageAssetUrls = (body) => post('/page-asset-urls', body);

/** Upload one blob straight to R2 via a presigned PUT URL. */
export async function putObject(url, blob, contentType) {
  let res;
  try {
    res = await resilientFetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  } catch {
    throw new Error('The upload was interrupted. Check your connection and try again.');
  }
  if (!res.ok) throw new Error(`The upload did not go through (${res.status}).`);
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
