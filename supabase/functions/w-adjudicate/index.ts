// Stage 6b · the arithmetic did not close. Where did we misread?
//
// One call per paper, on the most capable route, and only when reconciliation
// failed. It is the only stage that sees the paper whole, because the errors it
// hunts — a question missed entirely, a mark attributed to its neighbour, a
// question counted twice because it straddled a page — are invisible from inside
// any single question.
//
// It corrects our reading. It never corrects a mark. A correction it proposes
// does not overwrite anything: it lowers that question's confidence and puts it
// at the front of the review queue, where the student decides. The model has no
// standing to change a number a teacher wrote, and neither do we.

import { type RouteOverride, serveWorker } from '../_shared/worker.ts';
import { type Signals, tierFrom } from '../_shared/confidence.ts';
import { callModel, type ImageRef } from '../_shared/openrouter.ts';
import { presignGet } from '../_shared/r2.ts';
import * as adjudicate from '../_shared/prompts/adjudicate.v1.ts';

/** How many crops the call is worth. Least confident first. */
const CROPS = 6;

serveWorker(async ({ sb, msg, beat }) => {
  const runId = msg.run_id as string;

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
    images.push({
      key: region.crop_key as string,
      url: await presignGet('derived', region.crop_key as string),
      detail: 'high',
    });
  }

  // The page the total was read from. This is the one place the cover page is
  // legitimately in scope, because the total is usually on it — and it is sent
  // only when the discrepancy is about a total we may have misread.
  const { data: coverPage } = await sb
    .from('paper_page').select('r2_bucket, r2_key')
    .eq('paper_id', run.paper_id).order('page_number').limit(1).maybeSingle();
  if (coverPage?.r2_key) {
    images.push({
      key: coverPage.r2_key,
      url: await presignGet((coverPage.r2_bucket ?? 'derived') as 'derived', coverPage.r2_key),
      detail: 'high',
    });
  }

  const { parsed } = await callModel({
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
    attempt: msg.attempt,
    routeOverride: override,
  });

  // Advisory, and only advisory. Each correction lowers that question's
  // confidence so it surfaces first on the review screen; the student decides
  // what the paper says, and no mark is touched here.
  const byIndex = new Map(regions.map((r) => [r.order_index as number, r]));
  const flaggedIds = new Set<string>();
  let flagged = 0;
  for (const correction of parsed.corrections) {
    const region = byIndex.get(correction.order_index);
    if (!region) continue;
    flaggedIds.add(region.id as string);
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

  // ── and the other half: clearing the questions this did NOT implicate ──
  //
  // Reconciliation could not say which questions a failed total was about, so
  // it withheld the arithmetic signal from all of them. This stage is the one
  // that can say, and having said it, it owes the rest of the paper the verdict
  // they would have had if the total had closed. Without this the demotion is
  // permanent for every question on any paper whose sum is off by anything at
  // all, which was the whole 84%-never-confident problem.
  //
  // Only when adjudication actually localised the problem. Corrections found
  // means the suspicion has a home and the other questions are free of it;
  // corrections NOT found means we know the paper is wrong somewhere and cannot
  // say where, and spreading that suspicion across the paper is the honest
  // reading of it. Promoting everything there would offer bulk-accept on a
  // paper we have just told the student does not add up.
  let cleared = 0;
  if (parsed.corrections.length) {
    for (const region of regions) {
      if (flaggedIds.has(region.id as string)) continue;
      // Adjudication looked at totals, not at legibility. A region nobody could
      // read is not made readable by this stage declining to blame it.
      if (region.confidence_tier === 'unreadable') continue;

      const stored = (region.confidence_signals ?? {}) as Record<string, unknown>;
      const signals: Signals = {
        recognition: stored.recognition === true,
        structural: stored.structural === true,
        arithmetic: true,
        plausibility: stored.plausibility === true,
      };
      const tier = tierFrom(signals, { layerFallback: stored.layer_fallback === true });
      if (tier === region.confidence_tier) continue;

      await sb.from('question_region').update({
        confidence_tier: tier,
        confidence_signals: { ...stored, ...signals },
        updated_at: new Date().toISOString(),
      }).eq('id', region.id);
      cleared += 1;
    }
  }

  await sb.from('extraction_run').update({
    adjudication: { cause: parsed.cause, checked: parsed.checked, corrections: parsed.corrections },
  }).eq('id', runId);

  // An unexplained discrepancy is an acceptable and honest outcome. It is said
  // in words the student reads, not swallowed.
  const reason = parsed.corrections.length
    ? 'The marks do not quite add up. We have put the questions to check first.'
    : 'The marks on this paper do not add up to the total written on it. We could not see why, so nothing was changed.';

  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'needs_review', p_reason: reason });
  return { detail: { cause: parsed.cause, flagged, cleared } };
}, async ({ sb, msg }) => {
  // Adjudication is a nicety. Failing it must not fail the paper — the marks are
  // already read, and the student can review them without our second opinion.
  await sb.rpc('run_advance', {
    p_run_id: msg.run_id,
    p_to: 'needs_review',
    p_reason: 'The marks on this paper do not add up to the total written on it. Check the questions below.',
  });
});
