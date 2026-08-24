// Stage 6 · does the arithmetic close? Consumer of `reconcile-queue`,
// producer to `adjudicate-queue` when it does not.
//
// Ported from supabase/functions/w-reconcile/index.ts. No model call — pure
// SQL-adjacent logic run in the Worker over rows read via PostgREST, exactly
// as much "no model touches this" as the Supabase version. The enqueue into
// adjudicate-queue was already direct in the Edge Function (not routed
// through an advance_after_* RPC), so it stays direct here too: a native
// `env.ADJUDICATE_QUEUE.send()` in place of `pgmq_send`.

import { consumeQueue, failRun, type WorkerMessage } from '../../shared/worker.ts';
import { reconcile, type RegionMarks } from '../../shared/reconcile.ts';
import { assess, numberingSoundness } from '../../shared/confidence.ts';
import type { Env } from '../../shared/env.ts';

interface ReconcileMsg extends WorkerMessage { run_id: string }

const handler = consumeQueue<ReconcileMsg>(async ({ env, sb, msg }) => {
  const runId = msg.run_id;

  const { data: run } = await sb
    .from('extraction_run').select('id, paper_id, student_id, status').eq('id', runId).single();
  if (!run) return { detail: { skipped: 'no such run' } };
  if (['failed', 'rejected', 'committed', 'needs_review', 'ready'].includes(run.status)) {
    return { detail: { skipped: run.status } };
  }

  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'reconciliation' });

  const { data: paper } = await sb
    .from('paper').select('reported_total, stated_maximum').eq('id', run.paper_id).single();

  const { data: regions } = await sb
    .from('question_region')
    .select('id, order_index, question_label, marks_awarded, marks_available, confidence_tier, confidence_signals, extract_status')
    .eq('run_id', runId).order('order_index');

  if (!regions?.length) {
    await failRun(sb, runId, 'We could not find any questions on this paper. Try scanning it again in better light.');
    return { detail: { failed: 'no questions' } };
  }

  const marks: RegionMarks[] = regions.map((r) => ({
    order_index: r.order_index as number,
    label: r.question_label as string | null,
    awarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
    available: r.marks_available === null ? null : Number(r.marks_available),
    recognition: r.confidence_tier === 'unreadable' ? 'low' : 'medium',
  }));

  const result = reconcile(
    marks,
    paper?.reported_total === null || paper?.reported_total === undefined ? null : Number(paper.reported_total),
    paper?.stated_maximum === null || paper?.stated_maximum === undefined ? null : Number(paper.stated_maximum),
  );

  const sound = numberingSoundness(marks.map((m) => m.label));

  const { count: fallbackPages } = await sb
    .from('paper_page').select('id', { count: 'exact', head: true })
    .eq('paper_id', run.paper_id).not('layer_fallback', 'is', null);

  for (const [i, region] of regions.entries()) {
    const { tier, signals } = assess({
      recognition: marks[i].recognition,
      numberingSound: sound[i] ?? false,
      paperReconciled: result.reconciled,
      awarded: marks[i].awarded,
      available: marks[i].available,
      layerFallback: (fallbackPages ?? 0) > 0,
      unreadable: region.confidence_tier === 'unreadable' || region.extract_status === 'failed',
    });

    await sb.from('question_region').update({
      confidence_tier: tier,
      confidence_signals: { ...(region.confidence_signals as object ?? {}), ...signals },
      needs_review: true,
      updated_at: new Date().toISOString(),
    }).eq('id', region.id);
  }

  await sb.from('extraction_run').update({
    reconciled: result.reconciled,
    reconcile_delta: result.delta,
  }).eq('id', runId);

  await sb.from('paper').update({
    total_awarded: result.sum_awarded,
    total_available: result.sum_available || null,
    reconciled: result.reconciled,
  }).eq('id', run.paper_id);

  if (!result.reconciled) {
    await sb.rpc('run_advance', { p_run_id: runId, p_to: 'adjudicating' });
    if (env.ADJUDICATE_QUEUE) await env.ADJUDICATE_QUEUE.send({ run_id: runId });
    return { detail: { reconciled: false, delta: result.delta } };
  }

  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'needs_review', p_reason: result.message });
  return { detail: { reconciled: true, questions: regions.length } };
}, async ({ sb, msg }) => {
  await failRun(sb, msg.run_id, 'We could not finish checking this paper\'s marks. Nothing was saved — try again.');
});

export default { queue: handler };
