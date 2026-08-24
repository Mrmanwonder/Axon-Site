// Stage 8 · explanation, one question at a time.
//
// Runs only after that question has passed stage 6. An explanation built on a
// misattributed mark is the exact failure mode the product cannot survive: it is
// fluent, confident, specific, and about somebody else's answer.
//
// One question per request, so the client can run several and paint each into
// the paper as it lands — a student should be reading question 1 while question
// 9 is still generating. That is what the streaming in this stage means; within
// a single two-sentence explanation there is nothing worth streaming.
//
// Every hard constraint from CLAUDE.md that could erode lives at this boundary,
// so each one is enforced here as well as asked for in the prompt:
//   · the mark is never disputed — the awarded number is not even in the model's
//     writable surface, and marks_lost is arithmetic over two fact fields
//   · the do-this-next line clears a floor or is dropped
//   · Tier 2 scheme detail is cited, and Tier 1 has nothing to cite

import { CORS, PAPERS_BUCKET, clientFor, failure, json, readJson } from '../_shared/http.ts';
import { MODELS, askAboutImage, meter } from '../_shared/anthropic.ts';
import { EXPLANATION_SCHEMA } from '../_shared/schemas.ts';
import { EXPLANATION_SYSTEM, PROMPT_VERSION } from '../_shared/prompts.ts';
import { cropRegion } from '../_shared/crop.ts';
import { clearsTheFloor } from '../_shared/quality_floor.ts';

interface Body { run_id: string; region_id: string }

interface ExplanationResult {
  can_explain: boolean;
  cause: string | null;
  marks_lost: number | null;
  explanation: string | null;
  do_this_next: string | null;
  concepts: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = clientFor(req);
  if (!sb) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.run_id || !body?.region_id) return failure('A run and a question are needed.');

  const { data: run } = await sb.from('extraction_run')
    .select('id, paper_id, student_id, status, reconciled').eq('id', body.run_id).single();
  if (!run) return failure('That extraction could not be found.', 404);

  // The gate that makes this stage safe. Anything earlier than needs_review
  // means the arithmetic has not been checked, and an explanation of an
  // unchecked mark is worse than no explanation.
  if (run.status !== 'needs_review' && run.status !== 'committed') {
    return failure('This paper has not finished being read yet.', 409, { status: run.status });
  }

  const { data: region } = await sb.from('question_region')
    .select('id, paper_id, student_id, order_index, question_label, question_text, student_answer, region_type, marks_awarded, marks_available, teacher_remark, page_spans, canonical_question_id, confidence_tier')
    .eq('id', body.region_id).eq('run_id', run.id).single();
  if (!region) return failure('That question could not be found.', 404);

  const awarded = region.marks_awarded === null ? null : Number(region.marks_awarded);
  const available = region.marks_available === null ? null : Number(region.marks_available);

  if (awarded === null || available === null) {
    return json({ region_id: region.id, skipped: 'there is no mark on this question to explain' });
  }
  // Nothing was lost, so there is nothing to explain. Saying "well done" here
  // would be exactly the praise inflation the register rules out.
  const marksLost = Math.round((available - awarded) * 100) / 100;
  if (marksLost <= 0) {
    return json({ region_id: region.id, skipped: 'full marks on this question' });
  }
  if (region.confidence_tier === 'unreadable') {
    return json({ region_id: region.id, skipped: 'this question could not be read' });
  }

  const { data: paper } = await sb.from('paper').select('tier, subject, type').eq('id', region.paper_id).single();
  const { data: marks } = await sb.from('teacher_mark')
    .select('mark_class, box, comment_text, value').eq('region_id', region.id);

  // ── the scheme, only where there genuinely is one ────────────────────────
  // Hard rule 2: no scheme in the library means Tier 1 and the teacher's marks
  // alone. There is no path here that reconstructs, infers or approximates one.

  let scheme: { text: string; source: string; version: string } | null = null;
  if (paper?.tier === 'tier_2' && region.canonical_question_id) {
    const { data: canonical } = await sb.from('canonical_question')
      .select('marking_scheme, scheme_source, scheme_version')
      .eq('id', region.canonical_question_id).single();
    if (canonical?.marking_scheme && canonical.scheme_source && canonical.scheme_version) {
      scheme = {
        text: canonical.marking_scheme,
        source: canonical.scheme_source,
        version: canonical.scheme_version,
      };
    }
  }

  // ── the crop, because the teacher's own marking is the best anchor ───────

  const spans = (region.page_spans ?? []) as { page: number; box: { x: number; y: number; w: number; h: number } }[];
  const images: { data: string; media_type: string }[] = [];
  if (spans.length) {
    const { data: page } = await sb.from('paper_page')
      .select('storage_path').eq('paper_id', region.paper_id).eq('page_number', spans[0].page).single();
    if (page?.storage_path) {
      const { data: file } = await sb.storage.from(PAPERS_BUCKET).download(page.storage_path);
      if (file) {
        const crop = await cropRegion(new Uint8Array(await file.arrayBuffer()), spans[0].box);
        if (crop) images.push({ data: crop.data, media_type: crop.media_type });
      }
    }
  }

  const pointers = (marks ?? []).filter((m) => m.mark_class === 'circle' || m.mark_class === 'underline');
  const comments = (marks ?? []).filter((m) => m.mark_class === 'comment' && m.comment_text);

  const instruction = [
    `Question ${region.question_label ?? `#${region.order_index + 1}`}` +
      (paper?.subject ? ` · ${paper.subject}` : '') + '.',
    `The teacher gave ${trim(awarded)} out of ${trim(available)}, so ${trim(marksLost)} ${marksLost === 1 ? 'mark was' : 'marks were'} lost.`,
    region.question_text ? `The question: ${region.question_text}` : 'The question text could not be read.',
    region.student_answer
      ? `What the student wrote: ${region.student_answer}`
      : region.region_type === 'diagram'
        ? 'The answer is a diagram, which is in the image rather than in text. Work from the image.'
        : 'The answer could not be transcribed. Work from the image.',
    region.teacher_remark ? `The teacher wrote, exactly: "${region.teacher_remark}"` : null,
    comments.length ? `Other remarks, exactly as written: ${comments.map((c) => `"${c.comment_text}"`).join(', ')}` : null,
    pointers.length
      ? `The teacher ${pointers.map((p) => p.mark_class === 'circle' ? 'circled' : 'underlined').join(' and ')} ` +
        `something in this answer — it is visible in the image, and it is the best anchor you have for what went wrong.`
      : null,
    scheme
      ? `The official marking scheme allocates: ${scheme.text}\n` +
        `Paraphrase this in your own words; do not quote it back.`
      : `There is no official marking scheme for this paper. Explain from the teacher's marks and remarks and ` +
        `from the subject itself. Do not describe a mark scheme you have not been given.`,
    `Return marks_lost as ${trim(marksLost)}.`,
  ].filter(Boolean).join('\n\n');

  const cost = meter();
  let result: ExplanationResult | null = null;
  try {
    const { parsed, usage } = await askAboutImage({
      model: MODELS.explanation,
      system: EXPLANATION_SYSTEM,
      instruction,
      images,
      schema: EXPLANATION_SCHEMA,
      maxTokens: 3000,
      effort: 'high',
    });
    cost.add(MODELS.explanation, usage);
    result = parsed as ExplanationResult;
  } catch (e) {
    return failure('This question could not be explained just now. Nothing was lost — try again.', 502, (e as Error).message);
  }

  if (!result?.can_explain || !result.explanation) {
    // A model that cannot construct a reason for the deduction says so, and that
    // is a genuinely useful answer rather than a failure. It is stored, so the
    // paper does not silently show a blank where an explanation should be.
    await upsert(sb, region, run, {
      tier: paper?.tier ?? 'tier_1',
      cause: null,
      marks_lost: null,
      body: 'We could not work out from this page why the mark went. Your teacher will know — it is worth asking.',
      do_this_next: null,
      concepts: [],
      scheme,
    });
    return json({ region_id: region.id, explained: false, cost_paise: cost.paise });
  }

  // ── hard rule 1, enforced rather than requested ──────────────────────────
  // marks_lost is arithmetic over two fact fields. Whatever the model returned
  // for it is discarded: a number the model chose about a mark is exactly the
  // thing that must never reach the record.

  const cause = VALID_CAUSES.has(result.cause ?? '') ? result.cause : null;

  await upsert(sb, region, run, {
    tier: paper?.tier ?? 'tier_1',
    cause,
    marks_lost: cause ? marksLost : null,
    body: result.explanation,
    do_this_next: clearsTheFloor(result.do_this_next) ? result.do_this_next : null,
    concepts: Array.isArray(result.concepts) ? result.concepts.slice(0, 4) : [],
    scheme,
  });

  const { data: current } = await sb.from('extraction_run').select('cost_paise').eq('id', run.id).single();
  await sb.from('extraction_run')
    .update({ cost_paise: (current?.cost_paise ?? 0) + cost.paise }).eq('id', run.id);

  return json({
    region_id: region.id,
    explained: true,
    cause,
    marks_lost: marksLost,
    do_this_next_kept: clearsTheFloor(result.do_this_next),
    cost_paise: cost.paise,
  });
});

const VALID_CAUSES = new Set([
  'conceptual_gap', 'procedural_slip', 'misread_question',
  'incomplete', 'presentation', 'keyword_miss', 'timed_out',
]);

async function upsert(
  sb: NonNullable<ReturnType<typeof clientFor>>,
  region: { id: string; student_id: string },
  run: { id: string },
  fields: {
    tier: string; cause: string | null; marks_lost: number | null;
    body: string; do_this_next: string | null; concepts: string[];
    scheme: { source: string; version: string } | null;
  },
) {
  await sb.from('region_explanation').upsert({
    region_id: region.id,
    run_id: run.id,
    student_id: region.student_id,
    tier: fields.tier,
    cause: fields.cause,
    marks_lost: fields.marks_lost,
    body: fields.body,
    do_this_next: fields.do_this_next,
    concepts: fields.concepts,
    // Cited whenever scheme detail informed the answer, per hard rule 2. Tier 1
    // has nothing to cite, and the CHECK on the table refuses a citation there.
    scheme_source: fields.tier === 'tier_2' ? fields.scheme?.source ?? null : null,
    scheme_version: fields.tier === 'tier_2' ? fields.scheme?.version ?? null : null,
    model_version: MODELS.explanation,
    prompt_version: PROMPT_VERSION,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'region_id' });
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
