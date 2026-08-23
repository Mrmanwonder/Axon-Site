// Stage 3 · one page, sliced into question regions.
//
// Cheap, fast, whole-page. It finds boundaries without reading anything: a
// downscaled page and a small model are enough to say where question 4 starts,
// and spending a frontier model on that is most of what makes naive pipelines
// expensive.
//
// Stage 5 rides along, because it is a join rather than a call. The device
// already measured every red mark on this page in stage 2, so binding those
// marks to the regions found here costs nothing and has to happen while both
// are in hand.

import { failRun, type RouteOverride, serveWorker } from '../_shared/worker.ts';
import { callModel, type ImageRef } from '../_shared/openrouter.ts';
import { presignGet } from '../_shared/r2.ts';
import * as structure from '../_shared/prompts/structure.v1.ts';
import { takeBox, type TeacherMarkInput } from '../_shared/contract.ts';
import { attribute, type Region } from '../_shared/attribution.ts';

serveWorker(async ({ sb, msg, beat }) => {
  const runId = msg.run_id as string;
  const pageId = msg.page_id as string;

  const { data: page } = await sb
    .from('paper_page')
    // One string literal, not a concatenation: supabase-js infers the row type
    // from the select at compile time, and a joined string types as `unknown`.
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

  const images: ImageRef[] = [{
    key: page.r2_key as string,
    url: await presignGet((page.r2_bucket ?? 'derived') as 'derived', page.r2_key as string),
    detail: 'high',
  }];

  // The red-ink mask goes in second, at low detail. It costs little and it says
  // exactly where the teacher wrote, which is the hardest thing to see unaided
  // on a busy page.
  if (page.mask_key) {
    images.push({
      key: page.mask_key,
      url: await presignGet('derived', page.mask_key),
      detail: 'low',
    });
  }

  const { parsed } = await callModel({
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
    attempt: msg.attempt,
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
    await sb.rpc('advance_after_structure', { p_run_id: runId });
    return { detail: { unreadable: true } };
  }

  const meta = (page.conditioning_meta ?? {}) as { width?: number; height?: number };
  const width = meta.width ?? 2400;
  const height = meta.height ?? 3200;

  // A region continuing from the previous page extends that question rather than
  // opening a new one. Long answers in classes 11–12 routinely run two to three
  // pages, and treating that as a new question would fail most of them.
  const { data: existing } = await sb
    .from('question_region').select('id, order_index, page_spans')
    .eq('run_id', runId).order('order_index', { ascending: false }).limit(1);

  let nextIndex = existing?.length ? (existing[0].order_index as number) + 1 : 0;
  const created: { id: string; order_index: number; spans: Region['spans'] }[] = [];

  for (const [i, region] of parsed.regions.entries()) {
    const box = takeBox(region.box, page.page_number, width, height);
    if (!box) continue;                   // no provenance, no region
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
  await sb.rpc('advance_after_structure', { p_run_id: runId });

  return { detail: { regions: created.length, marks: marks.length } };
}, async ({ sb, msg }) => {
  // The page could not be read. Say so against the page, let the paper carry on,
  // and let the review screen show the crop with an honest gap beside it.
  const pageId = msg.page_id as string;
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
    await sb.rpc('advance_after_structure', { p_run_id: msg.run_id });
  } else {
    await failRun(sb, msg.run_id, 'We lost track of a page in this paper. Try scanning it again.');
  }
});
