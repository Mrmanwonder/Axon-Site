// The shape every queue consumer has.
//
// One job each, and the same three-way ending as the Supabase version: ack
// and move on, ack a permanent failure so the paper keeps going, or leave the
// message for Cloudflare's own retry/backoff. There is no fourth ending — in
// particular there is no ending where the message is acked and nothing was
// recorded, which is a paper that quietly loses a question.
//
// What changed from `_shared/worker.ts`: pgmq's delete-or-leave dance becomes
// `msg.ack()` / `msg.retry()`, and the whole batch is processed with
// `Promise.all`, one try/catch per item — per CLOUDFLARE_WORKERS.md §8 and
// §12, the per-item catch is load-bearing: an uncaught exception inside the
// map takes the whole batch down, not just the one message that threw.

import type { Message, MessageBatch } from '@cloudflare/workers-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './http.ts';
import { ModelError } from './openrouter.ts';
import type { Env } from './env.ts';

export interface WorkerMessage {
  run_id?: string;
  region_id?: string;
  page_id?: string;
  [key: string]: unknown;
}

export interface WorkerContext {
  env: Env;
  sb: SupabaseClient;
  msg: WorkerMessage;
  attempt: number;
  /** Say we are still alive. The stuck sweep fails a run that stops saying it. */
  beat: () => Promise<void>;
}

export interface WorkerResult {
  detail?: Record<string, unknown>;
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ModelError) return error.retryable;
  // An unrecognised throw is treated as permanent. The opposite default would
  // turn every programming mistake into repeated calls against a paid model.
  return false;
}

/** Fail the whole run, in words the student can act on. */
export async function failRun(sb: SupabaseClient, runId: string | undefined, reason: string): Promise<void> {
  if (!runId) return;
  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'failed', p_reason: reason });
}

export type RouteOverride =
  | { primary_model?: string; fallbacks?: string[]; temperature?: number; max_tokens?: number; prompt_version?: string }
  | null;

/**
 * @param handle       does the work. Throwing decides the ending.
 * @param onPermanent  records the permanent failure so it is visible, and
 *                     advances whatever was waiting on this unit. Called
 *                     before the message is acknowledged, never after.
 */
export function consumeQueue<M extends WorkerMessage = WorkerMessage>(
  handle: (ctx: WorkerContext & { msg: M }) => Promise<WorkerResult | void>,
  onPermanent?: (ctx: WorkerContext & { msg: M }, error: unknown) => Promise<void>,
) {
  return async (batch: MessageBatch<M>, env: Env): Promise<void> => {
    const sb = serviceClient(env);

    await Promise.all(batch.messages.map(async (message: Message<M>) => {
      const msg = message.body;
      const ctx: WorkerContext & { msg: M } = {
        env,
        sb,
        msg,
        attempt: message.attempts,
        beat: async () => {
          if (msg.run_id) await sb.rpc('run_heartbeat', { p_run_id: msg.run_id });
        },
      };

      await ctx.beat();

      try {
        await handle(ctx);
        message.ack();
      } catch (error) {
        if (isRetryable(error)) {
          // Leave it to Cloudflare's own backoff and dead-lettering, configured
          // declaratively in wrangler.jsonc rather than hand-rolled here.
          console.warn('retrying', String(error));
          message.retry();
          return;
        }

        console.error('failed permanently', String(error));
        try {
          await onPermanent?.(ctx, error);
        } finally {
          // Acked either way. A message left on the queue after a permanent
          // failure is several more identical failures and a paper that stalls.
          message.ack();
        }
      }
    }));
  };
}
