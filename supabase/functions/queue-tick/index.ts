// The dispatcher.
//
// Reads a bounded batch from each queue, invokes the matching worker, and
// returns. It does no work itself, and — deliberately — it does not await the
// workers it starts. If an invocation is lost, the message's visibility timeout
// expires and it is redelivered. That is the retry mechanism, and it is more
// reliable than anything this function could hold in memory across a two-second
// CPU budget.
//
// Batch sizes are the concurrency control. They are tuned against the provider's
// rate limits, not against a wished-for latency.

import { failure, isServiceCall, json, serviceClient } from '../_shared/http.ts';

interface QueueSpec { name: string; fn: string; batch: number }

const QUEUES: QueueSpec[] = [
  { name: 'mastery_triage', fn: 'w-triage', batch: 5 },
  { name: 'mastery_structure', fn: 'w-structure', batch: 20 },
  { name: 'mastery_content', fn: 'w-content', batch: 30 },
  { name: 'mastery_reconcile', fn: 'w-reconcile', batch: 10 },
  { name: 'mastery_adjudicate', fn: 'w-adjudicate', batch: 5 },
  { name: 'mastery_explain', fn: 'w-explain', batch: 20 },
  { name: 'mastery_r2_delete', fn: 'w-r2-delete', batch: 5 },
];

/**
 * Two minutes. Long enough for the slowest worker (adjudication, ~40s) plus a
 * provider retry; short enough that a lost invocation comes back inside the
 * window a student will still be watching the progress screen.
 */
const VISIBILITY_SECONDS = 120;

/** Every tick, not every hundredth: a stalled paper is invisible until swept. */
const SWEEP_EVERY_TICKS = 6;
let ticks = 0;

Deno.serve(async (req) => {
  // Cron calls this with the service key. Nothing else may.
  if (!isServiceCall(req)) return failure('not authorised', 401);

  const sb = serviceClient();
  const dispatched: Record<string, number> = {};
  const failures: Record<string, string> = {};

  for (const q of QUEUES) {
    const { data: msgs, error } = await sb.rpc('pgmq_read', {
      queue_name: q.name,
      vt: VISIBILITY_SECONDS,
      qty: q.batch,
    });
    if (error) { failures[q.name] = error.message; continue; }
    if (!msgs?.length) continue;
    dispatched[q.name] = msgs.length;

    for (const m of msgs as { msg_id: number; read_ct: number; message: Record<string, unknown> }[]) {
      // Fire and forget. Each worker acks its own message; a dropped invocation
      // is redelivered when the visibility timeout expires.
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${q.fn}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ msg_id: m.msg_id, queue: q.name, attempt: m.read_ct, ...m.message }),
      }).catch(() => { /* the visibility timeout is the retry */ });
    }
  }

  // The two ways a paper stalls without anyone seeing it. Hard rule 4 forbids
  // both, so the sweeps run on the same tick as the dispatch rather than on a
  // schedule someone has to remember to create.
  let swept: Record<string, number> | undefined;
  if (ticks++ % SWEEP_EVERY_TICKS === 0) {
    const [dead, stuck] = await Promise.all([
      sb.rpc('sweep_dead_letters', {}),
      sb.rpc('sweep_stuck_runs', {}),
    ]);
    swept = { dead_letters: dead.data ?? 0, stuck_runs: stuck.data ?? 0 };
  }

  return json({ dispatched, swept, failures: Object.keys(failures).length ? failures : undefined });
});
