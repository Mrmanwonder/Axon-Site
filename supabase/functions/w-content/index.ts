// Stage 4 · read one question.
//
// The accuracy-critical stage, and the one worth paying for. Everything after
// this is arithmetic over what it returns, so the two properties that matter are
// that a field it cannot point at comes back null, and that nothing it returns
// is an opinion about whether the mark was fair.
//
// A permanent failure here marks the question unreadable and lets the paper
// carry on. That is the fail-visibly rule as control flow: a question nobody
// could read becomes a gap on the review screen with its crop beside it, not a
// paper that stalls at nineteen of twenty.

import { type RouteOverride, serveWorker } from '../_shared/worker.ts';
import { callModel, type ImageRef } from '../_shared/openrouter.ts';
import { presignGet } from '../_shared/r2.ts';
import * as content from '../_shared/prompts/content.v1.ts';
import { takeBox } from '../_shared/contract.ts';

interface Span { page: number; box: { x: number; y: number; w: number; h: number } }

serveWorker(async ({ sb, msg, beat }) => {
  const runId = msg.run_id as string;
  const regionId = msg.region_id as string;

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
    images.push({ key: region.crop_key, url: await presignGet('derived', region.crop_key), detail: 'high' });
    if (region.cropmask_key) {
      images.push({ key: region.cropmask_key, url: await presignGet('derived', region.cropmask_key), detail: 'low' });
    }
  } else {
    const { data: pages } = await sb
      .from('paper_page').select('page_number, r2_bucket, r2_key, mask_key, layer_fallback')
      .eq('paper_id', region.paper_id).in('page_number', spans.map((s) => s.page)).order('page_number');
    for (const page of pages ?? []) {
      if (!page.r2_key) continue;
      images.push({
        key: page.r2_key,
        url: await presignGet((page.r2_bucket ?? 'derived') as 'derived', page.r2_key),
        detail: 'high',
      });
    }
  }
  if (!images.length) throw new Error('nothing to look at for this question');

  const { data: marks } = await sb
    .from('teacher_mark').select('shape, mark_class, page_number').eq('region_id', regionId);

  const { data: firstPage } = await sb
    .from('paper_page').select('layer_fallback, conditioning_meta')
    .eq('paper_id', region.paper_id).eq('page_number', spans[0].page).maybeSingle();

  const { parsed } = await callModel({
    sb,
    stage: 'content',
    system: content.SYSTEM,
    instruction: content.instruction({
      label: region.question_label,
      pageNumbers: spans.map((s) => s.page),
      layerFallback: (firstPage?.layer_fallback ?? null) as string | null,
      teacherMarks: (marks ?? []).map((m) => ({
        shape: m.shape as string,
        where: `on page ${m.page_number}`,
      })),
    }),
    images,
    schema: content.SCHEMA,
    validate: content.validate,
    runId,
    paperId: region.paper_id,
    regionId,
    studentId: region.student_id,
    attempt: msg.attempt,
    routeOverride: override,
  });

  const meta = (firstPage?.conditioning_meta ?? {}) as { width?: number; height?: number };
  const width = meta.width ?? 2400;
  const height = meta.height ?? 3200;

  // Provenance is not optional. A value whose box does not survive normalisation
  // is discarded along with the box, because there is deliberately nowhere in
  // the schema to store one without the other.
  const field = <T>(v: content.ValueWithBox<T> | null) => {
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
    await sb.rpc('advance_after_content', { p_run_id: runId });
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
    // The tier is decided at reconciliation, when the arithmetic signal exists.
    // Deciding it here would have to guess at one of its four inputs.
    updated_at: new Date().toISOString(),
  }).eq('id', regionId);

  // Bind the mark's value to the marginal number we just read, so the review
  // screen can point at the digit rather than at the question.
  if (awarded.value !== null && awarded.box) {
    await sb.from('teacher_mark')
      .update({ value: awarded.value })
      .eq('region_id', regionId).eq('mark_class', 'marginal_number').is('value', null);
  }

  await sb.rpc('advance_after_content', { p_run_id: runId });
  return { detail: { awarded: awarded.value, available: available.value } };
}, async ({ sb, msg }) => {
  await sb.from('question_region').update({
    extract_status: 'failed',
    confidence_tier: 'unreadable',
    needs_review: true,
    updated_at: new Date().toISOString(),
  }).eq('id', msg.region_id as string);
  await sb.rpc('advance_after_content', { p_run_id: msg.run_id });
});
