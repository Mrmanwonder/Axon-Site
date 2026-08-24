// mastery-sweep: the stuck-run cron, and the deletion drain.
//
// Ported from supabase/functions/queue-tick/index.ts (the stuck-run half —
// `sweep_dead_letters` is retired along with pgmq itself: Cloudflare Queues'
// own dead-letter queues and `max_retries` replace it declaratively, per
// CLOUDFLARE_WORKERS.md §2 and §12) and supabase/functions/w-r2-delete
// (the deletion drain, using R2 bindings instead of aws4fetch — §6).
//
// Deliberately not a Cloudflare Queue consumer for deletions. `r2_deletion` is
// a Postgres table, claimed with `for update skip locked` (0014's
// claim_deletions), and nothing in this architecture can push from SQL into a
// Cloudflare Queue — pgmq had a SQL-callable send; Cloudflare Queues does
// not. So this worker keeps the claim-and-drain shape whole, on the same cron
// tick as the stuck-run sweep, rather than half-porting it into a queue that
// nothing can feed. `r2-deletion-queue` from CLOUDFLARE_WORKERS.md §2 is not
// built here for that reason — flagged in workers/README.md rather than
// silently dropped, per the fail-visibly rule.

import { serviceClient } from '../../shared/http.ts';
import { type Bucket, deleteObject, deletePrefix } from '../../shared/r2.ts';
import type { Env } from '../../shared/env.ts';

/** Bounded so a sixteen-page paper's fifty-odd objects do not blow one tick. */
const KEYS_PER_TICK = 200;
const CLAIMS_PER_TICK = 20;

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const sb = serviceClient(env);

    // REVIEW_PIPELINE.md §11: no run may sit in a non-terminal status past an
    // hour without the student being told. Every 15 minutes, not every hour —
    // a stalled paper is invisible until swept.
    const { error: stuckError } = await sb.rpc('sweep_stuck_runs', {});
    if (stuckError) console.error('sweep_stuck_runs failed', stuckError.message);

    // The deletion drain. A student's "delete" has to mean the bytes are
    // gone — a delete that silently fails and leaves a minor's exam paper in
    // a bucket is a compliance incident, not a background-job hiccup.
    const { data: claims, error: claimError } = await sb.rpc('claim_deletions', { p_limit: CLAIMS_PER_TICK });
    if (claimError) {
      console.error('claim_deletions failed', claimError.message);
      return;
    }

    for (const claim of (claims ?? []) as { id: number; bucket: Bucket; prefix: string | null; key: string | null }[]) {
      try {
        if (claim.key) {
          await deleteObject(env, claim.bucket, claim.key);
          await sb.rpc('finish_deletion', { p_id: claim.id });
        } else if (claim.prefix) {
          const walk = await deletePrefix(env, claim.bucket, claim.prefix, { maxKeys: KEYS_PER_TICK });
          if (walk.done) {
            await sb.rpc('finish_deletion', { p_id: claim.id });
          } else {
            // More than one tick's worth. The row stays claimable, so the
            // next tick picks the walk up from the top — R2 lists in key
            // order, and everything deleted is no longer there to list.
            await sb.rpc('finish_deletion', { p_id: claim.id, p_error: `${walk.deleted} deleted, more to go` });
          }
        }
      } catch (cause) {
        await sb.rpc('finish_deletion', { p_id: claim.id, p_error: String(cause).slice(0, 500) });
      }
    }
  },
};
