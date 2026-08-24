// Calling the pipeline's server stages.
//
// Each stage is its own function invocation, which is not ceremony: it is what
// keeps a sixteen-page booklet inside an edge function's wall clock, and it is
// what lets the content and explanation passes run several at a time and land in
// the paper one question at a time rather than all at the end.
//
// Every call carries the guardian's own session. Nothing in this pipeline runs
// with more authority than the person who started it.

import { sb } from '../supabase.js';

async function invoke(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) {
    // The function's own message is the useful one — it was written for the
    // student. The transport error underneath it rarely is.
    let message = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch { /* keep the transport message */ }
    const wrapped = new Error(message);
    wrapped.cause = error;
    throw wrapped;
  }
  return data;
}

/** Stage 3, plus the run itself and the stage 5 binding of the device's mark map. */
export const structurePass = (body) => invoke('extract-structure', body);

/** Stage 4, one region. */
export const contentPass = (runId, regionId) =>
  invoke('extract-content', { run_id: runId, region_id: regionId });

/** Stages 6 and 7, and the confidence model that depends on both. */
export const finalize = (runId) => invoke('extract-finalize', { run_id: runId });

/** Stage 8, one question. Never called before finalize — the server refuses. */
export const explainQuestion = (runId, regionId) =>
  invoke('explain', { run_id: runId, region_id: regionId });

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
