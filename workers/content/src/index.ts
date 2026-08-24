// Stage 4 · read one question. Consumer of `content-queue`, producer to
// `reconcile-queue` once the last question in a run finishes.
//
// Ported from supabase/functions/w-content/index.ts. `advance_after_content`
// now returns `enqueue_reconcile: true` instead of sending to pgmq itself.

import { consumeQueue, type RouteOverride, type WorkerMessage } from '../../shared/worker.ts';
import { callModel, type ImageRef } from '../../shared/openrouter.ts';
import { imageRef } from '../../shared/r2.ts';
import * as content from '../../shared/prompts/content.v1.ts';
import { takeBox } from '../../shared/contract.ts';
import type { Env } from '../../shared/env.ts';

interface Span { page: number; box: { x: number; y: number; w: number; h: number } }
interface ContentMsg extends WorkerMessage { run_id: string; region_id: string }

async function advanceAndEnqueue(env: Env, sb: import('@supabase/supabase-js').SupabaseClient, runId: string) {
  const { data: advance } = await sb.rpc('advance_after_content', { p_run_id: runId });
  if (advance?.advanced && advance?.enqueue_reconcile && env.RECONCILE_QUEUE) {
    await env.RECONCILE_QUEUE.send({ run_id: runId });
  }
}

const handler = consumeQueue<ContentMsg>(async ({ env, sb, msg, attempt, beat }) => {
  const runId = msg.run_id;
  const regionId = msg.region_id;

  const { data: region } = await sb
    .from('question_region')
    .select('id, paper_id, student_id, order_index, question_label, page_spans, extract_status, crop_key, cropmask_key')
    .eq('id', regionId).single();

  if (!region) return { detail: { skipped: 'no such question' } };
  if (region.extract_status === 'done') return { detail: { skipped: 'already read' } };

  const { data: run } = await sb
    .from('extraction_run').select('status, route_override').eq('id', runId).single();
  if (!run || ['failed', 'rejected', 'committed'].includes(run.status)) {
    return { detail: { skipped: run?.status ?? 'no run' } };
  }
  const override = run.route_override as RouteOverride;

  await sb.from('question_region').update({ extract_status: 'running' }).eq('id', regionId);
  await beat();

  const spans = (region.page_spans ?? []) as Span[];
  if (!spans.length) throw new Error('a question with no page span has nothing to read');

  // A crop, where one was rendered. Otherwise the pages the question spans —
  // never the cover page, which carries the student's name, roll number and
  // school and has no business going anywhere except triage.
  const images: ImageRef[] = [];
  if (region.crop_key) {
    images.push(await imageRef(env, 'derived', region.crop_key as string, 'high'));
    if (region.cropmask_key) images.push(await imageRef(env, 'derived', region.cropmask_key as string, 'low'));
  } else {
    const { data: pages } = await sb
      .from('paper_page').select('page_number, r2_bucket, r2_key, mask_key, layer_fallback')
      .eq('paper_id', region.paper_id).in('page_number', spans.map((s) => s.page)).order('page_number');
    for (const page of pages ?? []) {
      if (!page.r2_key) continue;
      images.push(await imageRef(env, (page.r2_bucket ?? 'derived') as 'derived', page.r2_key as string, 'high'));
    }
  }
  if (!images.length) throw new Error('nothing to look at for this question');

  const { data: marks } = await sb
    .from('teacher_mark').select('shape, mark_class, page_number').eq('region_id', regionId);

  const { data: firstPage } = await sb
    .from('paper_page').select('layer_fallback, conditioning_meta')
    .eq('paper_id', region.paper_id).eq('page_number', spans[0].page).maybeSingle();

  const { parsed } = await callModel({
    env,
    sb,
    stage: 'content',
    system: content.SYSTEM,
    instruction: content.instruction({
      label: region.question_label,
      pageNumbers: spans.map((s) => s.page),
      layerFallback: (firstPage?.layer_fallback ?? null) as string | null,
      teacherMarks: (marks ?? []).map((m) => ({ shape: m.shape as string, where: `on page ${m.page_number}` })),
    }),
    images,
    schema: content.SCHEMA,
    validate: content.validate,
    runId,
    paperId: region.paper_id,
    regionId,
    studentId: region.student_id,
    attempt,
    routeOverride: override,
  });

  const meta = (firstPage?.conditioning_meta ?? {}) as { width?: number; height?: number };
  const width = meta.width ?? 2400;
  const height = meta.height ?? 3200;

  // Provenance is not optional. A value whose box does not survive
  // normalisation is discarded along with the box.
  const field = <T,>(v: content.ValueWithBox<T> | null) => {
    if (!v || v.value === null || v.value === undefined) return { value: null, box: null };
    const page = spans[Math.min(v.page_index ?? 0, spans.length - 1)]?.page ?? spans[0].page;
    const box = takeBox(v.box, page, width, height);
    return box ? { value: v.value, box } : { value: null, box: null };
  };

  const label = field(parsed.question_label);
  const question = field(parsed.question_text);
  const answer = field(parsed.student_answer);
  const awarded = field(parsed.marks_awarded);
  const available = field(parsed.marks_available);
  const remark = field(parsed.teacher_remark);

  if (parsed.unreadable) {
    await sb.from('question_region').update({
      extract_status: 'done',
      confidence_tier: 'unreadable',
      needs_review: true,
      confidence_signals: { unreadable_reason: parsed.unreadable_reason },
      updated_at: new Date().toISOString(),
    }).eq('id', regionId);
    await advanceAndEnqueue(env, sb, runId);
    return { detail: { unreadable: parsed.unreadable_reason } };
  }

  await sb.from('question_region').update({
    question_label: label.value ?? region.question_label,
    question_label_box: label.box,
    question_text: question.value,
    question_text_box: question.box,
    student_answer: answer.value,
    student_answer_box: answer.box,
    marks_awarded: awarded.value,
    marks_awarded_box: awarded.box,
    marks_available: available.value,
    marks_available_box: available.box,
    teacher_remark: remark.value,
    teacher_remark_box: remark.box,
    region_type: parsed.region_type,
    extract_status: 'done',
    updated_at: new Date().toISOString(),
  }).eq('id', regionId);

  // Bind the mark's value to the marginal number we just read, so the review
  // screen can point at the digit rather than at the question.
  if (awarded.value !== null && awarded.box) {
    await sb.from('teacher_mark')
      .update({ value: awarded.value })
      .eq('region_id', regionId).eq('mark_class', 'marginal_number').is('value', null);
  }

  await advanceAndEnqueue(env, sb, runId);
  return { detail: { awarded: awarded.value, available: available.value } };
}, async ({ env, sb, msg }) => {
  await sb.from('question_region').update({
    extract_status: 'failed',
    confidence_tier: 'unreadable',
    needs_review: true,
    updated_at: new Date().toISOString(),
  }).eq('id', msg.region_id);
  await advanceAndEnqueue(env, sb, msg.run_id);
});

export default { queue: handler };
