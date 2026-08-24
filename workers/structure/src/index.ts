// Stage 3 · one page, sliced into question regions. Consumer of
// `structure-queue`, producer to `content-queue` and `reconcile-queue`.
//
// Ported from supabase/functions/w-structure/index.ts. The completion check
// (`advance_after_structure`) now returns what to enqueue instead of sending
// to pgmq itself — see the 20260824120000 migration — so this worker does the
// actual `env.CONTENT_QUEUE.send()` / `env.RECONCILE_QUEUE.send()` calls once
// the RPC says the page fan-out is complete.

import { consumeQueue, failRun, type RouteOverride, type WorkerMessage } from '../../shared/worker.ts';
import { callModel, type ImageRef } from '../../shared/openrouter.ts';
import { imageRef } from '../../shared/r2.ts';
import * as structure from '../../shared/prompts/structure.v1.ts';
import { takeBox, type TeacherMarkInput } from '../../shared/contract.ts';
import { attribute, type Region } from '../../shared/attribution.ts';
import type { Env } from '../../shared/env.ts';

interface StructureMsg extends WorkerMessage { run_id: string; page_id: string }

/** The RPC returns bare region ids; the queue message needs run_id alongside each. */
async function enqueueFromAdvance(
  env: Env,
  runId: string,
  advance: { enqueue_content?: string[]; enqueue_reconcile?: boolean },
) {
  if (env.CONTENT_QUEUE) {
    for (const regionId of advance.enqueue_content ?? []) {
      await env.CONTENT_QUEUE.send({ run_id: runId, region_id: regionId });
    }
  }
  if (advance.enqueue_reconcile && env.RECONCILE_QUEUE) {
    await env.RECONCILE_QUEUE.send({ run_id: runId });
  }
}

const handler = consumeQueue<StructureMsg>(async ({ env, sb, msg, attempt, beat }) => {
  const runId = msg.run_id;
  const pageId = msg.page_id;

  const { data: page } = await sb
    .from('paper_page')
    .select('id, paper_id, student_id, page_number, r2_bucket, r2_key, mask_key, structure_status, layer_fallback, teacher_marks, conditioning_meta')
    .eq('id', pageId).single();

  if (!page) return { detail: { skipped: 'no such page' } };
  if (page.structure_status === 'done') return { detail: { skipped: 'already done' } };

  const { data: run } = await sb
    .from('extraction_run').select('status, route_override').eq('id', runId).single();
  if (!run || ['failed', 'rejected', 'committed'].includes(run.status)) {
    return { detail: { skipped: run?.status ?? 'no run' } };
  }
  const override = run.route_override as RouteOverride;

  await sb.from('paper_page').update({ structure_status: 'running' }).eq('id', pageId);
  await beat();

  const { count: pageCount } = await sb
    .from('paper_page').select('id', { count: 'exact', head: true }).eq('paper_id', page.paper_id);

  const images: ImageRef[] = [
    await imageRef(env, (page.r2_bucket ?? 'derived') as 'derived', page.r2_key as string, 'high'),
  ];

  // The red-ink mask goes in second, at low detail. It costs little and it
  // says exactly where the teacher wrote, which is the hardest thing to see
  // unaided on a busy page.
  if (page.mask_key) {
    images.push(await imageRef(env, 'derived', page.mask_key as string, 'low'));
  }

  const { parsed } = await callModel({
    env,
    sb,
    stage: 'structure',
    system: structure.SYSTEM,
    instruction: structure.instruction(page.page_number, pageCount ?? 1),
    images,
    schema: structure.SCHEMA,
    validate: structure.validate,
    runId,
    paperId: page.paper_id,
    studentId: page.student_id,
    attempt,
    routeOverride: override,
  });

  // A page that is not part of a graded paper is a gap, not a failure of the
  // paper: the rest of the booklet may be perfectly readable.
  if (!parsed.is_graded_exam_paper) {
    await sb.from('page_unreadable').insert({
      paper_id: page.paper_id,
      page_number: page.page_number,
      storage_path: page.r2_key,
      reason: parsed.not_a_paper_reason ?? 'This page does not look like part of a marked exam paper.',
    });
    await sb.from('paper_page').update({ structure_status: 'unreadable' }).eq('id', pageId);
    const { data: advance } = await sb.rpc('advance_after_structure', { p_run_id: runId });
    if (advance?.advanced) await enqueueFromAdvance(env, runId, advance);
    return { detail: { unreadable: true } };
  }

  const meta = (page.conditioning_meta ?? {}) as { width?: number; height?: number };
  const width = meta.width ?? 2400;
  const height = meta.height ?? 3200;

  // A region continuing from the previous page extends that question rather
  // than opening a new one. Long answers routinely run two to three pages.
  const { data: existing } = await sb
    .from('question_region').select('id, order_index, page_spans')
    .eq('run_id', runId).order('order_index', { ascending: false }).limit(1);

  let nextIndex = existing?.length ? (existing[0].order_index as number) + 1 : 0;
  const created: { id: string; order_index: number; spans: Region['spans'] }[] = [];

  for (const [i, region] of parsed.regions.entries()) {
    const box = takeBox(region.box, page.page_number, width, height);
    if (!box) continue; // no provenance, no region
    const span = { page: page.page_number, box: { x: box.x, y: box.y, w: box.w, h: box.h } };

    if (i === 0 && region.continues_from_previous && existing?.length) {
      const prior = existing[0];
      const spans = [...(prior.page_spans as Region['spans']), span];
      await sb.from('question_region').update({ page_spans: spans }).eq('id', prior.id);
      continue;
    }

    const label = takeBox(region.number_box, page.page_number, width, height)
      ? region.candidate_number : null;

    const { data: row } = await sb.from('question_region').insert({
      run_id: runId,
      paper_id: page.paper_id,
      student_id: page.student_id,
      order_index: nextIndex,
      page_spans: [span],
      question_label: label,
      question_label_box: label ? takeBox(region.number_box, page.page_number, width, height) : null,
      confidence_tier: 'unsure',
    }).select('id, order_index').single();

    if (row) created.push({ id: row.id, order_index: row.order_index, spans: [span] });
    nextIndex += 1;
  }

  // Stage 5. Device geometry, joined to the regions just found.
  const marks = (page.teacher_marks ?? []) as TeacherMarkInput[];
  if (marks.length && created.length) {
    const regions: Region[] = created.map((c, i) => ({ order_index: i, label: null, spans: c.spans }));
    const attributed = attribute({
      regions,
      marks,
      marginBands: new Map([[page.page_number, null]]),
      pageWidths: new Map([[page.page_number, width]]),
    });

    const rows = attributed.map((m) => ({
      run_id: runId,
      paper_id: page.paper_id,
      student_id: page.student_id,
      region_id: m.region_index === null ? null : created[m.region_index]?.id ?? null,
      page_number: m.page_number,
      box: m.box,
      shape: m.shape,
      mark_class: m.mark_class,
      metrics: m.metrics,
      confidence_tier: 'unsure' as const,
    }));
    if (rows.length) await sb.from('teacher_mark').insert(rows);
  }

  await sb.from('paper_page').update({ structure_status: 'done' }).eq('id', pageId);

  const { data: advance } = await sb.rpc('advance_after_structure', { p_run_id: runId });
  if (advance?.advanced) await enqueueFromAdvance(env, runId, advance);

  return { detail: { regions: created.length, marks: marks.length } };
}, async ({ env, sb, msg }) => {
  const pageId = msg.page_id;
  const { data: page } = await sb
    .from('paper_page').select('paper_id, page_number, r2_key').eq('id', pageId).maybeSingle();

  if (page) {
    await sb.from('page_unreadable').insert({
      paper_id: page.paper_id,
      page_number: page.page_number,
      storage_path: page.r2_key,
      reason: 'We could not read this page well enough to find the questions on it.',
    });
    await sb.from('paper_page').update({ structure_status: 'failed' }).eq('id', pageId);
    // A permanent failure still completes the page, so the run's completion
    // check needs the same follow-through as the success path.
    const { data: advance } = await sb.rpc('advance_after_structure', { p_run_id: msg.run_id });
    if (advance?.advanced) await enqueueFromAdvance(env, msg.run_id, advance);
  } else {
    await failRun(sb, msg.run_id, 'We lost track of a page in this paper. Try scanning it again.');
  }
});

export default { queue: handler };
