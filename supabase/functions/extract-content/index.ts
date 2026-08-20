// Stage 4 · content pass, one region at a time.
//
// Per region rather than per page, and one invocation per region rather than one
// per paper. Three reasons, and they are the same three that make the whole
// two-pass design worth the extra plumbing: token cost drops sharply against
// sending full pages, accuracy improves because the model is not holding a whole
// booklet in context while reading one line of handwriting, and a failure
// localises to one question instead of poisoning a page.
//
// One region per request also keeps each invocation well inside an edge
// function's wall clock on a sixteen-page booklet, and lets the client run
// several at once and stream them into the paper as they land.

import { CORS, PAPERS_BUCKET, clientFor, failure, json, readJson } from '../_shared/http.ts';
import { MODELS, askAboutImage, meter } from '../_shared/anthropic.ts';
import { CONTENT_SCHEMA } from '../_shared/schemas.ts';
import { CONTENT_SYSTEM, contentInstruction } from '../_shared/prompts.ts';
import { cropRegion, cropToPage } from '../_shared/crop.ts';

interface Body { run_id: string; region_id: string }

interface Valued { value: unknown; box: { x: number; y: number; w: number; h: number } | null }
interface ContentResult {
  question_text: Valued | null;
  student_answer: Valued | null;
  marks_awarded: Valued | null;
  marks_available: Valued | null;
  teacher_remark: Valued | null;
  region_type: string;
  recognition_confidence: 'high' | 'medium' | 'low';
  unreadable: boolean;
  unreadable_reason: string | null;
}

/**
 * Take a value only if it arrived with a box, and place that box back on the
 * page it came from.
 *
 * This is the provenance rule doing its work at the point where fiction would
 * otherwise enter. A model that produces a mark it cannot point at has not read
 * a mark, and the value goes in the bin with the box.
 */
function provenanced(
  field: Valued | null | undefined,
  crop: { width: number; height: number },
  region: { x: number; y: number; w: number; h: number },
  page: number,
): { value: unknown; box: Record<string, number> | null } {
  if (!field || field.value === null || field.value === undefined) return { value: null, box: null };
  const b = field.box;
  if (!b || ![b.x, b.y, b.w, b.h].every((n) => typeof n === 'number' && Number.isFinite(n)) ||
      b.w <= 0 || b.h <= 0) {
    return { value: null, box: null };
  }
  const inCrop = {
    x: (b.x / 1000) * crop.width,
    y: (b.y / 1000) * crop.height,
    w: (b.w / 1000) * crop.width,
    h: (b.h / 1000) * crop.height,
  };
  return { value: field.value, box: { page, ...cropToPage(inCrop, region) } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = clientFor(req);
  if (!sb) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.run_id || !body?.region_id) return failure('A run and a region are needed.');

  const { data: region, error } = await sb
    .from('question_region')
    .select('id, run_id, paper_id, student_id, order_index, question_label, page_spans')
    .eq('id', body.region_id)
    .eq('run_id', body.run_id)
    .single();
  if (error || !region) return failure('That question could not be found.', 404);

  const spans = (region.page_spans ?? []) as { page: number; box: { x: number; y: number; w: number; h: number } }[];
  if (!spans.length) return failure('That question has no place on the page to read from.', 422);

  const { data: pages } = await sb
    .from('paper_page')
    .select('page_number, storage_path, layer_fallback')
    .eq('paper_id', region.paper_id)
    .in('page_number', spans.map((s) => s.page));

  const { data: marks } = await sb
    .from('teacher_mark')
    .select('shape, mark_class, box')
    .eq('region_id', region.id);

  // ── cut the crops ────────────────────────────────────────────────────────

  const crops: { data: string; media_type: string; width: number; height: number }[] = [];
  let croppedAll = true;

  for (const span of spans) {
    const page = pages?.find((p) => p.page_number === span.page);
    if (!page?.storage_path) { croppedAll = false; continue; }
    const { data: file } = await sb.storage.from(PAPERS_BUCKET).download(page.storage_path);
    if (!file) { croppedAll = false; continue; }
    const crop = await cropRegion(new Uint8Array(await file.arrayBuffer()), span.box);
    if (!crop) { croppedAll = false; continue; }
    crops.push(crop);
  }

  if (!crops.length) {
    // Hard rule 4: nothing is dropped silently. The region stays, marked
    // unreadable, and the review screen shows the student what we could not cut.
    await sb.from('question_region').update({
      confidence_tier: 'unreadable',
      confidence_signals: { recognition: false, structural: false, arithmetic: false, plausibility: false },
      needs_review: true,
      updated_at: new Date().toISOString(),
    }).eq('id', region.id);
    return json({ region_id: region.id, unreadable: true, reason: 'this question could not be cut out of the page' });
  }

  // ── read it ──────────────────────────────────────────────────────────────

  const cost = meter();
  const startedAt = Date.now();
  const fallback = pages?.find((p) => p.layer_fallback)?.layer_fallback ?? null;

  let result: ContentResult | null = null;
  let readError: string | null = null;
  try {
    const { parsed, usage } = await askAboutImage({
      model: MODELS.content,
      system: CONTENT_SYSTEM,
      instruction: contentInstruction({
        label: region.question_label,
        pageNumbers: spans.map((s) => s.page),
        layerFallback: fallback,
        teacherMarks: (marks ?? []).map((m) => ({
          shape: m.mark_class === 'unknown' ? m.shape : m.mark_class.replace(/_/g, ' '),
          where: describeWhere(m.box, spans[0].box),
        })),
      }),
      images: crops,
      schema: CONTENT_SCHEMA,
      maxTokens: 6000,
      effort: 'high',
    });
    cost.add(MODELS.content, usage);
    result = parsed as ContentResult;
  } catch (e) {
    readError = (e as Error).message;
  }

  if (!result) {
    await sb.from('question_region').update({
      confidence_tier: 'unreadable',
      needs_review: true,
      updated_at: new Date().toISOString(),
    }).eq('id', region.id);
    return json({ region_id: region.id, unreadable: true, reason: readError ?? 'the reader returned nothing' });
  }

  // ── write only what has provenance ───────────────────────────────────────

  const page = spans[0].page;
  const crop = crops[0];
  const box = spans[0].box;

  const questionText = provenanced(result.question_text, crop, box, page);
  const answer = provenanced(result.student_answer, crop, box, page);
  const awarded = provenanced(result.marks_awarded, crop, box, page);
  const available = provenanced(result.marks_available, crop, box, page);
  const remark = provenanced(result.teacher_remark, crop, box, page);

  const numeric = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const awardedValue = numeric(awarded.value);
  const availableValue = numeric(available.value);

  // Plausibility is checked before the write, not after, because the column has
  // its own CHECK and a rejected insert would lose the whole region rather than
  // the one field that was wrong.
  const marksCoherent = awardedValue === null || availableValue === null || awardedValue <= availableValue;

  const update: Record<string, unknown> = {
    question_text: questionText.value as string | null,
    question_text_box: questionText.box,
    student_answer: answer.value as string | null,
    student_answer_box: answer.box,
    teacher_remark: remark.value as string | null,
    teacher_remark_box: remark.box,
    region_type: result.region_type ?? null,
    marks_awarded: marksCoherent ? awardedValue : null,
    marks_awarded_box: marksCoherent && awardedValue !== null ? awarded.box : null,
    marks_available: marksCoherent ? availableValue : null,
    marks_available_box: marksCoherent && availableValue !== null ? available.box : null,
    confidence_signals: {
      recognition: result.recognition_confidence,
      marks_coherent: marksCoherent,
      cropped_every_page: croppedAll,
      layer_fallback: fallback,
      unreadable_reason: result.unreadable ? result.unreadable_reason : null,
    },
    confidence_tier: result.unreadable ? 'unreadable' : 'unsure',
    needs_review: true,
    updated_at: new Date().toISOString(),
  };

  const { error: writeError } = await sb.from('question_region').update(update).eq('id', region.id);
  if (writeError) return failure('That question could not be saved.', 500, writeError.message);

  // The awarded mark's own crop is what the review screen shows against the
  // number, so the mark it was read from is recorded as the teacher's.
  if (marksCoherent && awardedValue !== null && awarded.box) {
    await sb.from('teacher_mark').insert({
      run_id: region.run_id,
      paper_id: region.paper_id,
      student_id: region.student_id,
      region_id: region.id,
      page_number: page,
      box: awarded.box,
      shape: 'glyph',
      mark_class: 'marginal_number',
      value: awardedValue,
      confidence_tier: result.recognition_confidence === 'high' ? 'confident' : 'unsure',
      metrics: { read_by: 'content_pass' },
    });
  }
  if (remark.value && remark.box) {
    await sb.from('teacher_mark').insert({
      run_id: region.run_id,
      paper_id: region.paper_id,
      student_id: region.student_id,
      region_id: region.id,
      page_number: page,
      box: remark.box,
      shape: 'unknown',
      mark_class: 'comment',
      comment_text: remark.value as string,
      confidence_tier: 'unsure',
      metrics: { read_by: 'content_pass' },
    });
  }

  await bumpCost(sb, region.run_id, cost.paise, Date.now() - startedAt);

  return json({
    region_id: region.id,
    order_index: region.order_index,
    unreadable: !!result.unreadable,
    marks_awarded: marksCoherent ? awardedValue : null,
    marks_available: marksCoherent ? availableValue : null,
    region_type: result.region_type,
    recognition: result.recognition_confidence,
  });
});

/** Where a mark sits, in words the model can use as a hint rather than an answer. */
function describeWhere(
  markBox: { x: number; y: number; w: number; h: number },
  regionBox: { x: number; y: number; w: number; h: number },
): string {
  const relX = (markBox.x + markBox.w / 2 - regionBox.x) / Math.max(1, regionBox.w);
  const relY = (markBox.y + markBox.h / 2 - regionBox.y) / Math.max(1, regionBox.h);
  const across = relX > 0.75 ? 'in the right margin' : relX < 0.15 ? 'in the left margin' : 'over the answer';
  const down = relY < 0.33 ? 'near the top' : relY > 0.66 ? 'near the bottom' : 'partway down';
  return `${across}, ${down}`;
}

/** Cost accrues per region, so it is added rather than overwritten. */
async function bumpCost(sb: ReturnType<typeof clientFor>, runId: string, paise: number, ms: number) {
  if (!sb) return;
  const { data } = await sb.from('extraction_run')
    .select('cost_paise, stage_timings').eq('id', runId).single();
  if (!data) return;
  const timings = (data.stage_timings ?? {}) as Record<string, number>;
  timings.content_ms = (timings.content_ms ?? 0) + ms;
  await sb.from('extraction_run').update({
    cost_paise: (data.cost_paise ?? 0) + paise,
    stage_timings: timings,
  }).eq('id', runId);
}
