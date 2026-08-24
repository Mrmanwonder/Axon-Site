// The deletion drain.
//
// A student's "delete" has to mean the bytes are gone, and a delete that
// silently fails and leaves a minor's exam paper in a bucket is a compliance
// incident rather than a background-job hiccup. So: a claimed batch, a bounded
// walk, and a row that survives its own failure and comes back.
//
// Runs on the same ten-second tick as the pipeline queues.

import { failure, isServiceCall, json, serviceClient } from '../_shared/http.ts';
import { type Bucket, deleteObject, deletePrefix } from '../_shared/r2.ts';

/** Bounded so a sixteen-page paper's fifty-odd objects do not blow the budget. */
const KEYS_PER_TICK = 200;

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return failure('not authorised', 401);

  const sb = serviceClient();
  const { data: claims, error } = await sb.rpc('claim_deletions', { p_limit: 5 });
  if (error) return failure('could not claim deletions', 500, error.message);
  if (!claims?.length) return json({ drained: 0 });

  let drained = 0;
  const unfinished: number[] = [];

  for (const claim of claims as { id: number; bucket: Bucket; prefix: string | null; key: string | null }[]) {
    try {
      if (claim.key) {
        await deleteObject(claim.bucket, claim.key);
        await sb.rpc('finish_deletion', { p_id: claim.id });
        drained += 1;
      } else if (claim.prefix) {
        const walk = await deletePrefix(claim.bucket, claim.prefix, { maxKeys: KEYS_PER_TICK });
        if (walk.done) {
          await sb.rpc('finish_deletion', { p_id: claim.id });
          drained += 1;
        } else {
          // More than one tick's worth. The row stays claimable, so the next
          // tick picks the walk up from the top — R2 lists in key order, and
          // everything deleted is no longer there to list.
          unfinished.push(claim.id);
          await sb.rpc('finish_deletion', { p_id: claim.id, p_error: `${walk.deleted} deleted, more to go` });
        }
      }
    } catch (cause) {
      await sb.rpc('finish_deletion', { p_id: claim.id, p_error: String(cause).slice(0, 500) });
    }
  }

  return json({ drained, unfinished: unfinished.length });
});
