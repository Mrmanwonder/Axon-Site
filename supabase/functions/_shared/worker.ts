// The shape every queue worker has.
//
// One job each, and the same three-way ending: acknowledge and move on,
// acknowledge a permanent failure so the paper keeps going, or leave the message
// alone so the visibility timeout brings it back. There is no fourth ending, and
// in particular there is no ending where the message is acknowledged and nothing
// was recorded — that is a paper that quietly loses a question.
//
// The distinction between the second and third endings is the whole of the
// fail-visibly rule expressed in control flow. A retryable failure costs
// latency. A permanent failure marks its unit unreadable and lets the paper
// proceed, so the student sees a gap with a crop beside it instead of a spinner
// that never resolves.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { failure, isServiceCall, json, serviceClient } from './http.ts';
import { ModelError } from './openrouter.ts';
import { honestFailureReason } from './failure_messages.ts';

export interface WorkerMessage {
  msg_id: number;
  queue: string;
  attempt: number;
  run_id?: string;
  region_id?: string;
  page_id?: string;
  [key: string]: unknown;
}

export interface WorkerContext {
  sb: SupabaseClient;
  msg: WorkerMessage;
  /** Say we are still alive. The stuck sweep fails a run that stops saying it. */
  beat: () => Promise<void>;
}

export interface WorkerResult {
  /** Anything the response should carry. Purely for the logs. */
  detail?: Record<string, unknown>;
}

/**
 * @param handle          does the work. Throwing decides the ending.
 * @param onPermanent     records the permanent failure so it is visible, and
 *                        advances whatever was waiting on this unit. Called
 *                        before the message is acknowledged, never after.
 */
export function serveWorker(
  handle: (ctx: WorkerContext) => Promise<WorkerResult | void>,
  onPermanent?: (ctx: WorkerContext, error: unknown) => Promise<void>,
): void {
  Deno.serve(async (req) => {
    if (!isServiceCall(req)) return failure('not authorised', 401);

    let msg: WorkerMessage;
    try {
      msg = await req.json() as WorkerMessage;
    } catch {
      return failure('unreadable message', 400);
    }
    if (typeof msg?.msg_id !== 'number' || !msg?.queue) {
      return failure('a worker needs a message id and a queue', 400);
    }

    const sb = serviceClient();
    const ctx: WorkerContext = {
      sb,
      msg,
      beat: async () => {
        if (msg.run_id) await sb.rpc('run_heartbeat', { p_run_id: msg.run_id });
      },
    };

    await ctx.beat();

    try {
      const result = await handle(ctx);
      await sb.rpc('pgmq_delete', { queue_name: msg.queue, msg_id: msg.msg_id });
      return json({ ok: true, ...(result?.detail ?? {}) });
    } catch (error) {
      if (isRetryable(error)) {
        // Leave the message. The visibility timeout redelivers it, and the
        // dead-letter sweep fails the run once it has had its five attempts —
        // so this path cannot loop forever without the student being told.
        console.warn(`${msg.queue} retrying`, msg.msg_id, String(error));
        return json({ retry: true, error: String(error) }, 503);
      }

      console.error(`${msg.queue} failed permanently`, msg.msg_id, String(error));
      try {
        await onPermanent?.(ctx, error);
      } finally {
        // Acknowledged either way. A message left on the queue after a permanent
        // failure is four more identical failures and a paper that stalls.
        await sb.rpc('pgmq_delete', { queue_name: msg.queue, msg_id: msg.msg_id });
      }
      return json({ ok: false, error: String(error) });
    }
  });
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ModelError) return error.retryable;
  // An unrecognised throw is treated as permanent. The opposite default would
  // turn every programming mistake into five calls against a paid model.
  return false;
}

/** Fail the whole run, in words the student can act on. */
export async function failRun(sb: SupabaseClient, runId: string | undefined, reason: string): Promise<void> {
  if (!runId) return;
  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'failed', p_reason: reason });
}

/**
 * `failRun`, but for a catch-all handler that does not itself know whether
 * this run's pages made it to storage. Checks `paper_page.r2_key` rather than
 * assuming — see `honestFailureReason` in failure_messages.ts for why that
 * distinction matters and why it's tested separately from this.
 */
export async function failRunHonestly(
  sb: SupabaseClient,
  runId: string | undefined,
  stageDescription: string,
): Promise<void> {
  if (!runId) return;
  const { data: run } = await sb.from('extraction_run').select('paper_id').eq('id', runId).maybeSingle();

  let pagesStored = false;
  if (run?.paper_id) {
    const { count } = await sb.from('paper_page')
      .select('id', { count: 'exact', head: true })
      .eq('paper_id', run.paper_id).not('r2_key', 'is', null);
    pagesStored = (count ?? 0) > 0;
  }

  await failRun(sb, runId, honestFailureReason(stageDescription, pagesStored));
}

/**
 * A route override, carried on the run rather than on the message.
 *
 * It has to survive every enqueue the pipeline makes: an override that reached
 * only the first stage would have the eval measuring the default model for
 * everything after it, which is the wrong number told confidently.
 */
export type RouteOverride =
  | { primary_model?: string; fallbacks?: string[]; temperature?: number; max_tokens?: number; prompt_version?: string }
  | null;
