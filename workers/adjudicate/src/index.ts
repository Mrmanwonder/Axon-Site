// Stage 6b · the arithmetic did not close. Where did we misread? Consumer of
// `adjudicate-queue`.
//
// Ported from supabase/functions/w-adjudicate/index.ts. Advisory only, as
// before: a correction lowers a question's confidence and puts it in front of
// the student; no mark is ever touched here.

import { consumeQueue, type RouteOverride, type WorkerMessage } from '../../shared/worker.ts';
import { callModel, type ImageRef } from '../../shared/openrouter.ts';
import { imageRef } from '../../shared/r2.ts';
import * as adjudicate from '../../shared/prompts/adjudicate.v1.ts';
import type { Env } from '../../shared/env.ts';

/** How many crops the call is worth. Least confident first. */
const CROPS = 6;

interface AdjudicateMsg extends WorkerMessage { run_id: string }

const handler = consumeQueue<AdjudicateMsg>(async ({ env, sb, msg, attempt, beat }) => {
  const runId = msg.run_id;

  const { data: run } = await sb
    .from('extraction_run').select('id, paper_id, student_id, status, reconcile_delta, route_override').eq('id', runId).single();
  if (!run) return { detail: { skipped: 'no such run' } };
  if (run.status !== 'adjudicating') return { detail: { skipped: run.status } };
  const override = run.route_override as RouteOverride;

  await beat();

  const { data: paper } = await sb
    .from('paper').select('reported_total, total_awarded').eq('id', run.paper_id).single();

  const { data: regions } = await sb
    .from('question_region')
    .select('id, order_index, question_label, marks_awarded, marks_available, confidence_tier, confidence_signals, crop_key, page_spans')
    .eq('run_id', runId).order('order_index');

  if (!regions?.length) {
    await sb.rpc('run_advance', { p_run_id: runId, p_to: 'needs_review' });
    return { detail: { skipped: 'nothing to adjudicate' } };
  }

  const rank = { unreadable: 0, unsure: 1, confident: 2 } as Record<string, number>;
  const suspects = [...regions]
    .sort((a, b) => (rank[a.confidence_tier as string] ?? 3) - (rank[b.confidence_tier as string] ?? 3))
    .slice(0, CROPS);

  const images: ImageRef[] = [];
  for (const region of suspects) {
    if (!region.crop_key) continue;
    images.push(await imageRef(env, 'derived', region.crop_key as string, 'high'));
  }

  // The page the total was read from. This is the one place the cover page is
  // legitimately in scope, because the total is usually on it.
  const { data: coverPage } = await sb
    .from('paper_page').select('r2_bucket, r2_key')
    .eq('paper_id', run.paper_id).order('page_number').limit(1).maybeSingle();
  if (coverPage?.r2_key) {
    images.push(await imageRef(env, (coverPage.r2_bucket ?? 'derived') as 'derived', coverPage.r2_key as string, 'high'));
  }

  const { parsed } = await callModel({
    env,
    sb,
    stage: 'adjudicate',
    system: adjudicate.SYSTEM,
    instruction: adjudicate.instruction({
      reportedTotal: paper?.reported_total === null || paper?.reported_total === undefined
        ? null : Number(paper.reported_total),
      computedTotal: Number(paper?.total_awarded ?? 0),
      delta: Number(run.reconcile_delta ?? 0),
      regions: regions.map((r) => ({
        order_index: r.order_index as number,
        label: r.question_label as string | null,
        marks_awarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
        marks_available: r.marks_available === null ? null : Number(r.marks_available),
        confidence_tier: r.confidence_tier as string,
      })),
    }),
    images,
    schema: adjudicate.SCHEMA as { name: string; schema: Record<string, unknown> },
    validate: adjudicate.validate,
    runId,
    paperId: run.paper_id,
    studentId: run.student_id,
    attempt,
    routeOverride: override,
  });

  const byIndex = new Map(regions.map((r) => [r.order_index as number, r]));
  let flagged = 0;
  for (const correction of parsed.corrections) {
    const region = byIndex.get(correction.order_index);
    if (!region) continue;
    await sb.from('question_region').update({
      confidence_tier: 'unsure',
      needs_review: true,
      confidence_signals: {
        ...(region.confidence_signals as object ?? {}),
        adjudication: {
          field: correction.field,
          suggests: correction.corrected_value,
          evidence: correction.evidence,
        },
      },
      updated_at: new Date().toISOString(),
    }).eq('id', region.id);
    flagged += 1;
  }

  await sb.from('extraction_run').update({
    adjudication: { cause: parsed.cause, checked: parsed.checked, corrections: parsed.corrections },
  }).eq('id', runId);

  const reason = parsed.corrections.length
    ? 'The marks do not quite add up. We have put the questions to check first.'
    : 'The marks on this paper do not add up to the total written on it. We could not see why, so nothing was changed.';

  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'needs_review', p_reason: reason });
  return { detail: { cause: parsed.cause, flagged } };
}, async ({ sb, msg }) => {
  // Adjudication is a nicety. Failing it must not fail the paper.
  await sb.rpc('run_advance', {
    p_run_id: msg.run_id,
    p_to: 'needs_review',
    p_reason: 'The marks on this paper do not add up to the total written on it. Check the questions below.',
  });
});

export default { queue: handler };
