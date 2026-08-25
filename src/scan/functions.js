// Calling the pipeline's server stages.
//
// Rewired for workers/README.md's Cloudflare pipeline. The client used to
// invoke each stage directly and get its result back in the response
// (extract-structure, extract-content, extract-finalize) — a shape that only
// worked because those Edge Functions ran synchronously, in band, with the
// student's tab open the whole time. The queue-driven pipeline behind
// mastery-api doesn't return a result at all: paper-submit's response is just
// "queued", and structure, content, reconciliation and (maybe) adjudication
// happen off in Cloudflare Queues on their own schedule. So the client's job
// changes from "await the answer" to "watch extraction_run for the answer to
// arrive" — the same table review.js already reads from, just polled instead
// of returned.

import { sb } from '../supabase.js';

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

const TERMINAL_ISH = new Set(['needs_review', 'explaining', 'ready', 'committed', 'rejected', 'failed']);

/**
 * Wait for a run to reach a status the review screen (or a refusal) can act
 * on, reporting progress by name as it moves through the state machine —
 * REVIEW_PIPELINE.md §3's transitions, unchanged by the runtime migration.
 *
 * Polls rather than subscribes. Realtime would push the instant a row
 * changes, but a paper-submit response has already committed to a plain HTTP
 * shape for the rest of this flow, and a two-second poll is not a cost worth
 * a second transport for the handful of transitions one paper makes.
 *
 * @param {(status:string)=>void} [onStatus] fires once per distinct status seen
 */
export async function pollRun(runId, { onStatus, intervalMs = 2000, timeoutMs = 5 * 60_000 } = {}) {
  const started = Date.now();
  let last = null;

  for (;;) {
    const { data: run, error } = await sb
      .from('extraction_run')
      .select('id, status, status_reason')
      .eq('id', runId)
      .single();
    if (error) throw error;

    if (run.status !== last) {
      last = run.status;
      onStatus?.(run.status);
    }

    if (TERMINAL_ISH.has(run.status)) return run;

    if (Date.now() - started > timeoutMs) {
      // Not a server failure — the run may still finish. Say so plainly
      // rather than pretending a timeout is the same thing as a rejection.
      const err = new Error(
        'This is taking longer than expected. Your paper is still being read — check back on it shortly.',
      );
      err.code = 'poll_timeout';
      err.runId = runId;
      throw err;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const STAGE_MESSAGE = {
  queued: 'Getting ready',
  triaging: 'Checking this is a graded paper',
  structure: 'Finding the questions',
  content: 'Reading the answers and the marking',
  attribution: 'Reading the answers and the marking',
  reconciliation: 'Checking the marks add up',
  adjudicating: 'Double-checking a question that did not add up',
  needs_review: 'Ready for you to look over',
  explaining: 'Working out why marks were lost',
  ready: 'Done',
  rejected: 'Not a graded paper we could read',
  failed: 'Could not finish reading this paper',
};

export function messageForStatus(status) {
  return STAGE_MESSAGE[status] ?? status;
}
