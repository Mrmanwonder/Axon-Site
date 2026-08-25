// Stage 3a · is this a graded exam paper at all?
//
// One cheap call over up to six pages. Students will upload homework, blank
// question papers, textbook pages and things that are not schoolwork, and a
// pipeline that dutifully extracts a textbook page into the analytics quietly
// degrades every insight downstream — so this runs before anything expensive.
//
// It also settles the colour question once. A teacher who marks in green is
// found here rather than rediscovered per page, and the paper is downgraded a
// confidence tier from that point.

import { failRun, type RouteOverride, serveWorker } from '../_shared/worker.ts';
import { callModel } from '../_shared/openrouter.ts';
import { presignGet } from '../_shared/r2.ts';
import { QUALITY } from '../_shared/contract.ts';
import * as triage from '../_shared/prompts/triage.v1.ts';

/** Enough to tell a marked script from a textbook, and no more than we must send. */
const PAGES_TO_LOOK_AT = 6;

type QualityPage = { quality_verdict?: string | null; quality_signals?: Record<string, number> | null };

/**
 * The device already scored these pages, at capture, on the actual conditioned
 * pixels. If they came back too blurred, too glare-blown or too small to
 * clear the client's own quality gate, that is the real diagnosis — a vision
 * model looking at the same degraded image cannot do better than "I can't
 * tell what this is", and it is dishonest to let it guess when we already
 * know. Named to the strongest failure across the failing pages, in the same
 * priority order the client's own gate uses.
 */
function qualityFailureMessage(pages: QualityPage[]): string | null {
  const failing = pages.filter((p) => p.quality_verdict === 'fail' && p.quality_signals);
  if (!failing.length) return null;

  let worstSharpness = 1;
  let worstGlare = 0;
  let worstLongEdge = Infinity;
  for (const p of failing) {
    const s = p.quality_signals!;
    if (typeof s.sharpness === 'number') worstSharpness = Math.min(worstSharpness, s.sharpness);
    if (typeof s.glare === 'number') worstGlare = Math.max(worstGlare, s.glare);
    if (typeof s.long_edge === 'number') worstLongEdge = Math.min(worstLongEdge, s.long_edge);
  }

  if (worstSharpness < QUALITY.BLUR_FAIL) {
    return 'Some of these pages came out too blurred to read the marking — the app should have caught this before you submitted. Please retake them and try again.';
  }
  if (worstGlare > QUALITY.GLARE_FAIL) {
    return 'Light is washing out part of these pages, which hides the marking. Please retake them with the page tilted away from the light.';
  }
  if (worstLongEdge < QUALITY.RESOLUTION_FAIL) {
    return 'These photos are too small to read the marking clearly. Please move closer and retake them.';
  }
  return 'Some of these pages did not come out clearly enough to read. Please retake them and try again.';
}

serveWorker(async ({ sb, msg, beat }) => {
  const runId = msg.run_id as string;

  const { data: run } = await sb
    .from('extraction_run').select('id, paper_id, student_id, status, route_override').eq('id', runId).single();
  if (!run) return { detail: { skipped: 'no such run' } };
  if (run.status !== 'queued') return { detail: { skipped: run.status } };

  // Set only by eval-run. It lives on the run rather than on the message so it
  // survives every enqueue the pipeline makes downstream of here — an override
  // that only reached the first stage would measure the wrong thing.
  const override = run.route_override as RouteOverride;

  const { data: pages } = await sb
    .from('paper_page')
    .select('page_number, r2_bucket, r2_key, quality_verdict, quality_signals')
    .eq('paper_id', run.paper_id).not('r2_key', 'is', null)
    .order('page_number').limit(PAGES_TO_LOOK_AT);

  if (!pages?.length) {
    await failRun(sb, runId, 'We could not find the pages for this paper. Try scanning it again.');
    return { detail: { failed: 'no pages' } };
  }

  // The device already flagged every one of these pages unreadable, on the
  // conditioned image, while the paper was still in the student's hands. A
  // model call here would spend money to reach the same conclusion from a
  // worse copy of the same evidence — short-circuit with the real reason
  // instead.
  if (pages.every((p) => p.quality_verdict === 'fail')) {
    const message = qualityFailureMessage(pages) ?? 'These pages did not come out clearly enough to read. Please retake them and try again.';
    await sb.rpc('run_advance', { p_run_id: runId, p_to: 'rejected', p_reason: message });
    return { detail: { rejected: 'quality', pages: pages.length } };
  }

  await sb.rpc('run_advance', { p_run_id: runId, p_to: 'triaging' });
  await beat();

  const images = await Promise.all(pages.map(async (p) => ({
    key: p.r2_key as string,
    url: await presignGet((p.r2_bucket ?? 'derived') as 'derived', p.r2_key as string),
    // Low detail: the question here is "is there marking on this", not "what
    // does it say", and full detail would cost several times as much to answer
    // a question a thumbnail settles.
    detail: 'low' as const,
  })));

  const { parsed } = await callModel({
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
    attempt: msg.attempt,
    routeOverride: override,
  });

  if (parsed.classification !== 'graded_exam') {
    // A low-confidence not_schoolwork read on pages the client itself already
    // flagged as poor quality is a strong signal the real problem is the
    // photo, not the content — "we could not find a marked exam paper" reads
    // as an insult when the paper was fine and the photo wasn't. Route that
    // specific case back to the honest, actionable reason instead. A
    // high-confidence read, or a page-quality gate that never fired, keeps
    // the classifier's own wording.
    const isUncertainReject = parsed.classification === 'not_schoolwork' && parsed.confidence === 'low';
    const reason = (isUncertainReject && qualityFailureMessage(pages))
      || triage.REJECTION_REASON[parsed.classification];
    // Rejected, not failed. The student photographed something and is owed a
    // sentence saying what we think it was.
    await sb.rpc('run_advance', { p_run_id: runId, p_to: 'rejected', p_reason: reason });
    return { detail: { rejected: parsed.classification } };
  }

  // A teacher marking in a colour the device's red mask did not find is not a
  // failure — it is a paper the whole pipeline should trust a notch less.
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

  for (const page of allPages ?? []) {
    await sb.rpc('pgmq_send', {
      queue_name: 'axon_structure',
      msg: { run_id: runId, page_id: page.id },
    });
  }

  return { detail: { classification: parsed.classification, pages: allPages?.length ?? 0 } };
}, async ({ sb, msg }) => {
  await failRun(sb, msg.run_id, 'We could not tell what this document is. Nothing was saved — try again.');
});
