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
import * as triage from '../_shared/prompts/triage.v1.ts';

/** Enough to tell a marked script from a textbook, and no more than we must send. */
const PAGES_TO_LOOK_AT = 6;

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
    .select('page_number, r2_bucket, r2_key')
    .eq('paper_id', run.paper_id).not('r2_key', 'is', null)
    .order('page_number').limit(PAGES_TO_LOOK_AT);

  if (!pages?.length) {
    await failRun(sb, runId, 'We could not find the pages for this paper. Try scanning it again.');
    return { detail: { failed: 'no pages' } };
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
    // Rejected, not failed. The student photographed something and is owed a
    // sentence saying what we think it was.
    await sb.rpc('run_advance', {
      p_run_id: runId,
      p_to: 'rejected',
      p_reason: triage.REJECTION_REASON[parsed.classification],
    });
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
