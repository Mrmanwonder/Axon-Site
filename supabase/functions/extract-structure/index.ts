// Stage 3 · structure pass, and the opening of an extraction run.
//
// Cheap, fast, whole-page. The goal is to slice the booklet into question
// regions without reading any of the content — a downscaled proxy and a small
// model are enough to find boundaries, and spending a frontier model on that is
// most of what makes naive pipelines expensive.
//
// It also does the one thing that has to happen before anything else: decide
// whether this is a graded exam paper at all. Students will upload homework,
// blank question papers, textbook pages and things that are not schoolwork, and
// a system that dutifully extracts a textbook page into the analytics quietly
// degrades every insight downstream.
//
// The device has already done stages 1 and 2, so the teacher's marks arrive here
// as measured geometry. Stage 5 is then a join, which is why it runs here too.

import { CORS, PAPERS_BUCKET, clientFor, failure, fetchPageBase64, json, readJson } from '../_shared/http.ts';
import { MODELS, askAboutImage, meter } from '../_shared/anthropic.ts';
import { STRUCTURE_SCHEMA } from '../_shared/schemas.ts';
import { PROMPT_VERSION, STRUCTURE_SYSTEM, structureInstruction } from '../_shared/prompts.ts';
import { PIPELINE_VERSION, type PageInput, takeBox } from '../_shared/contract.ts';
import { attribute, type Region } from '../_shared/attribution.ts';

interface Body { paper_id: string; pages: PageInput[] }

interface StructureResult {
  is_graded_exam_paper: boolean;
  not_a_paper_reason: string | null;
  reported_total: { value: number | null; box: unknown } | null;
  stated_maximum: { value: number | null; box: unknown } | null;
  regions: {
    candidate_number: string | null;
    number_box: unknown;
    box: { x: number; y: number; w: number; h: number };
    continues_from_previous: boolean;
    structure_confidence: 'high' | 'low';
  }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = clientFor(req);
  if (!sb) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.paper_id || !Array.isArray(body.pages) || !body.pages.length) {
    return failure('A paper and at least one page are needed to start extraction.');
  }

  const { data: paper, error: paperError } = await sb
    .from('paper')
    .select('id, student_id, type, tier, subject, date_taken')
    .eq('id', body.paper_id)
    .single();
  if (paperError || !paper) return failure('That paper could not be found.', 404);

  const cost = meter();
  const timings: Record<string, number> = {};
  const startedAt = Date.now();

  const { data: run, error: runError } = await sb
    .from('extraction_run')
    .insert({
      paper_id: paper.id,
      student_id: paper.student_id,
      pipeline_version: PIPELINE_VERSION,
      model_versions: { structure: MODELS.structure, content: MODELS.content, prompts: PROMPT_VERSION },
      status: 'structure',
    })
    .select()
    .single();
  if (runError || !run) {
    // The consent gate lives on this insert, so a refusal here is usually a
    // withdrawn permission rather than a bug. Say which.
    return failure(
      runError?.message?.includes('extract_text')
        ? 'Reading papers is switched off for this account. Turn it back on in Settings to scan.'
        : 'Extraction could not be started.',
      403, runError?.message,
    );
  }

  // What the device measured about each page travels with the page, so review
  // and the harness can both see why a page was hard.
  for (const page of body.pages) {
    await sb.from('paper_page').update({
      quality_verdict: page.quality?.verdict ?? null,
      quality_signals: page.quality?.signals ?? {},
      conditioning_meta: page.conditioning_meta ?? {},
      layer_fallback: page.layer_fallback ?? null,
      teacher_mark_count: page.teacher_marks?.length ?? 0,
    }).eq('paper_id', paper.id).eq('page_number', page.page_number);
  }

  // ── the structure pass itself ────────────────────────────────────────────

  const perPage: { page: PageInput; result: StructureResult | null; error: string | null }[] = [];

  for (const page of body.pages) {
    const path = page.proxy_path ?? page.storage_path;
    const image = await fetchPageBase64(sb, PAPERS_BUCKET, path);
    if (!image) {
      perPage.push({ page, result: null, error: 'the page could not be read back from storage' });
      continue;
    }
    try {
      const { parsed, usage } = await askAboutImage({
        model: MODELS.structure,
        system: STRUCTURE_SYSTEM,
        instruction: structureInstruction(page.page_number, body.pages.length),
        images: [{ media_type: 'image/jpeg', data: image.data }],
        schema: STRUCTURE_SCHEMA,
        maxTokens: 4000,
      });
      cost.add(MODELS.structure, usage);
      perPage.push({ page, result: parsed as StructureResult, error: null });
    } catch (e) {
      perPage.push({ page, result: null, error: (e as Error).message });
    }
  }
  timings.structure_ms = Date.now() - startedAt;

  // ── is this a graded exam paper at all? ──────────────────────────────────
  // Judged over the booklet, not per page: a blank back page is not a reason to
  // refuse a paper, but a booklet with no graded page anywhere in it is.

  const graded = perPage.filter((p) => p.result?.is_graded_exam_paper);
  if (!graded.length) {
    const reason = perPage.find((p) => p.result?.not_a_paper_reason)?.result?.not_a_paper_reason;
    await sb.from('extraction_run').update({
      status: 'failed',
      failure_reason: `not a graded exam paper: ${reason ?? 'nothing gradeable found on any page'}`,
      finished_at: new Date().toISOString(),
      stage_timings: timings,
      cost_paise: cost.paise,
    }).eq('id', run.id);

    return json({
      run_id: run.id,
      refused: true,
      message: reason
        ? `This looks like ${reason} rather than a marked paper, so there is nothing to explain yet.`
        : 'We could not find any marked answers on these pages, so there is nothing to explain yet.',
    });
  }

  // A page we could not read is recorded, never dropped. Hard rule 4.
  for (const { page, error } of perPage) {
    if (!error) continue;
    await sb.from('page_unreadable').upsert({
      paper_id: paper.id,
      student_id: paper.student_id,
      page_number: page.page_number,
      storage_path: page.storage_path,
      reason: error,
    }, { onConflict: 'paper_id,page_number' });
    await sb.from('paper_page').update({ status: 'unreadable' })
      .eq('paper_id', paper.id).eq('page_number', page.page_number);
  }

  // ── stitch regions across pages ──────────────────────────────────────────
  // A question region is a list of page-plus-box pairs, never a single box. Long
  // answers in classes 11 and 12 routinely run two to three pages, and treating
  // that as a failure would fail most of them.

  const regions: (Region & { label_box: unknown; structure_confidence: 'high' | 'low' })[] = [];

  for (const { page, result } of perPage) {
    if (!result?.regions) continue;
    for (const raw of result.regions) {
      const box = takeBox({ ...raw.box, page: page.page_number }, page.page_number, page.width, page.height);
      if (!box) continue; // a region we cannot place is a region we do not have
      const span = { page: page.page_number, box: { x: box.x, y: box.y, w: box.w, h: box.h } };

      const previous = regions[regions.length - 1];
      if (raw.continues_from_previous && previous && raw.candidate_number === null) {
        previous.spans.push(span);
        continue;
      }

      const labelBox = raw.candidate_number
        ? takeBox({ ...(raw.number_box as object ?? {}), page: page.page_number },
                  page.page_number, page.width, page.height)
        : null;

      regions.push({
        order_index: regions.length,
        // Provenance holds even for the label: a number we cannot point at is a
        // number we did not read, so both fall away together.
        label: labelBox ? raw.candidate_number : null,
        label_box: labelBox,
        spans: [span],
        structure_confidence: raw.structure_confidence,
      });
    }
  }

  if (!regions.length) {
    await sb.from('extraction_run').update({
      status: 'failed',
      failure_reason: 'no question regions were found on any page',
      finished_at: new Date().toISOString(),
      stage_timings: timings,
      cost_paise: cost.paise,
    }).eq('id', run.id);
    return json({
      run_id: run.id,
      refused: true,
      message: 'We could not find separate questions on these pages. Retaking them straighter usually fixes it.',
    });
  }

  const { data: inserted, error: regionError } = await sb.from('question_region').insert(
    regions.map((r) => ({
      run_id: run.id,
      paper_id: paper.id,
      student_id: paper.student_id,
      order_index: r.order_index,
      page_spans: r.spans,
      question_label: r.label,
      question_label_box: r.label_box,
      confidence_tier: 'unsure',
      needs_review: true,
    })),
  ).select('id, order_index, question_label, page_spans');
  if (regionError) return failure('The questions we found could not be saved.', 500, regionError.message);

  // ── stage 5 · bind the teacher's marks to those regions ──────────────────

  const marks = body.pages.flatMap((p) =>
    (p.teacher_marks ?? []).map((m) => ({ ...m, page: p.page_number })));

  if (marks.length) {
    const attributed = attribute({
      regions,
      marks,
      marginBands: new Map(body.pages.map((p) => [p.page_number, p.margin_band ?? null])),
      pageWidths: new Map(body.pages.map((p) => [p.page_number, p.width])),
    });

    const byIndex = new Map(inserted!.map((r) => [r.order_index, r.id]));
    await sb.from('teacher_mark').insert(attributed.map((m) => ({
      run_id: run.id,
      paper_id: paper.id,
      student_id: paper.student_id,
      region_id: m.region_index === null ? null : byIndex.get(m.region_index) ?? null,
      page_number: m.page_number,
      box: { page: m.page_number, ...m.box },
      shape: m.shape,
      mark_class: m.mark_class,
      metrics: m.metrics,
      confidence_tier: m.mark_class === 'unknown' ? 'unsure' : 'confident',
    })));
  }

  // ── what the paper says about itself ─────────────────────────────────────
  // Read where it is written, kept exactly as written. Stage 6 checks our
  // reading against it and never the other way round.

  const totals = perPage.find((p) => p.result?.reported_total?.value != null)?.result?.reported_total;
  const maximums = perPage.find((p) => p.result?.stated_maximum?.value != null)?.result?.stated_maximum;
  if (totals?.value != null || maximums?.value != null) {
    await sb.from('paper').update({
      ...(totals?.value != null ? { reported_total: totals.value } : {}),
      ...(maximums?.value != null ? { stated_maximum: maximums.value } : {}),
    }).eq('id', paper.id);
  }

  await sb.from('extraction_run').update({
    status: 'content',
    stage_timings: timings,
    cost_paise: cost.paise,
  }).eq('id', run.id);

  return json({
    run_id: run.id,
    refused: false,
    pages_read: graded.length,
    pages_unreadable: perPage.filter((p) => p.error).length,
    regions: inserted,
  });
});
