// Stage 3a · is this a graded exam paper at all? Consumer of `triage-queue`.
//
// Ported from supabase/functions/w-triage/index.ts. Logic is unchanged; only
// the runtime is — presigned GETs become signed asset-route URLs, and the
// direct `pgmq_send` this worker did for its own fan-out into structure
// becomes a native Cloudflare Queue send.

import { consumeQueue, failRun, type RouteOverride, type WorkerMessage } from '../../shared/worker.ts';
import { callModel } from '../../shared/openrouter.ts';
import { imageRef } from '../../shared/r2.ts';
import * as triage from '../../shared/prompts/triage.v1.ts';
import type { Env } from '../../shared/env.ts';

/** Enough to tell a marked script from a textbook, and no more than we must send. */
const PAGES_TO_LOOK_AT = 6;

interface TriageMsg extends WorkerMessage { run_id: string }

const handler = consumeQueue<TriageMsg>(async ({ env, sb, msg, attempt, beat }) => {
  const runId = msg.run_id;

  const { data: run } = await sb
    .from('extraction_run').select('id, paper_id, student_id, status, route_override').eq('id', runId).single();
  if (!run) return { detail: { skipped: 'no such run' } };
  if (run.status !== 'queued') return { detail: { skipped: run.status } };

  const override = run.route_override as RouteOverride;

  const { data: pages } = await sb
    .from('paper_page')
    .select('page_number, r2_bucket, r2_key')
    .eq('paper_id', run.paper_id).not('r2_key', 'is', null)
    .order('page_number').limit(PAGES_TO_LOOK_AT);

  if (!pages?.length) {
    await failRun(sb, runId, 'We could not find the pages for this paper. Try scanning it again.');
    return { detail: { failed: 'no pages' } };
  }

  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'triaging' });
  await beat();

  const images = await Promise.all(pages.map((p) =>
    // Low detail: the question here is "is there marking on this", not "what
    // does it say", and full detail would cost several times as much to
    // answer a question a thumbnail settles.
    imageRef(env, (p.r2_bucket ?? 'derived') as 'derived', p.r2_key as string, 'low')));

  const { parsed } = await callModel({
    env,
    sb,
    stage: 'triage',
    system: triage.SYSTEM,
    instruction: triage.instruction(pages.length),
    images,
    schema: triage.SCHEMA as { name: string; schema: Record<string, unknown> },
    validate: triage.validate,
    runId,
    paperId: run.paper_id,
    studentId: run.student_id,
    attempt,
    routeOverride: override,
  });

  if (parsed.classification !== 'graded_exam') {
    await sb.rpc('run_advance', {
      p_run_id: runId,
      p_to: 'rejected',
      p_reason: triage.REJECTION_REASON[parsed.classification],
    });
    return { detail: { rejected: parsed.classification } };
  }

  await sb.from('extraction_run').update({
    tier_routing: { triage: parsed },
    ...(parsed.ink_colour !== 'red' ? { status_reason: null } : {}),
  }).eq('id', runId);

  if (parsed.ink_colour !== 'red') {
    await sb.from('paper_page')
      .update({ layer_fallback: 'non_red_marking' })
      .eq('paper_id', run.paper_id).is('layer_fallback', null);
  }

  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'structure' });

  const { data: allPages } = await sb
    .from('paper_page').select('id').eq('paper_id', run.paper_id).not('r2_key', 'is', null);

  if (env.STRUCTURE_QUEUE) {
    for (const page of allPages ?? []) {
      await env.STRUCTURE_QUEUE.send({ run_id: runId, page_id: page.id });
    }
  }

  return { detail: { classification: parsed.classification, pages: allPages?.length ?? 0 } };
}, async ({ sb, msg }) => {
  await failRun(sb, msg.run_id, 'We could not tell what this document is. Nothing was saved — try again.');
});

export default { queue: handler };
