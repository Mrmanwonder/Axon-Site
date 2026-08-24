// Stage 8 · why this mark went.
//
// Runs after review, never before. No explanation may be built on a mark the
// student has not confirmed: generating twenty and then having question seven
// corrected buys either a stale explanation or a wasted call, and the stale one
// is worse — wrong prose about a right answer, in a product whose entire claim
// is the opposite.
//
// The teacher was right. That is the premise the prompt is built on and the
// premise this worker enforces at the schema: region_explanation has no column
// that could carry an opinion about what the mark should have been, and
// marks_lost is arithmetic over two fact fields rather than a judgement.

import { type RouteOverride, serveWorker } from '../_shared/worker.ts';
import { callModel } from '../_shared/openrouter.ts';
import * as explain from '../_shared/prompts/explain_tier1.v1.ts';
import { clearsTheFloor } from '../_shared/quality_floor.ts';

serveWorker(async ({ sb, msg, beat }) => {
  const runId = msg.run_id as string;
  const regionId = msg.region_id as string;

  const { data: region } = await sb
    .from('question_region')
    .select('id, paper_id, student_id, question_label, question_text, student_answer, teacher_remark, marks_awarded, marks_available, explain_status, student_confirmed_at')
    .eq('id', regionId).single();

  if (!region) return { detail: { skipped: 'no such question' } };
  if (region.explain_status === 'done') return { detail: { skipped: 'already explained' } };

  // The gate, checked here as well as in begin_explanations. A message that was
  // queued and then overtaken by a correction must not produce prose about a
  // reading the student has since changed.
  if (!region.student_confirmed_at) {
    await sb.from('question_region').update({ explain_status: 'pending' }).eq('id', regionId);
    return { detail: { skipped: 'not confirmed' } };
  }

  const awarded = Number(region.marks_awarded);
  const available = Number(region.marks_available);
  if (!Number.isFinite(awarded) || !Number.isFinite(available) || awarded >= available) {
    await sb.from('question_region').update({ explain_status: 'skipped' }).eq('id', regionId);
    await sb.rpc('advance_after_explain', { p_run_id: runId });
    return { detail: { skipped: 'no marks lost' } };
  }

  await sb.from('question_region').update({ explain_status: 'running' }).eq('id', regionId);
  await beat();

  const { data: run } = await sb
    .from('extraction_run').select('route_override').eq('id', runId).maybeSingle();
  const override = run?.route_override as RouteOverride;

  const { data: paper } = await sb
    .from('paper').select('subject, tier').eq('id', region.paper_id).single();
  const { data: student } = await sb
    .from('student').select('class_level').eq('id', region.student_id).single();

  // Tier 2 would cite an official scheme here. There is no scheme in the
  // library for a school test, and hard rule 2 says we do not reconstruct one —
  // so a Tier 2 paper without a matched canonical question is explained as
  // Tier 1 and says so, rather than approximating an authority.
  if (paper?.tier === 'tier_2') {
    const { data: matched } = await sb
      .from('question_region').select('canonical_question_id').eq('id', regionId).single();
    if (!matched?.canonical_question_id) {
      console.info('tier 2 question with no scheme match; explaining as tier 1', regionId);
    }
  }

  const { data: marks } = await sb
    .from('teacher_mark').select('mark_class, comment_text').eq('region_id', regionId);

  const { parsed, model, promptVersion } = await callModel({
    sb,
    stage: 'explain',
    system: explain.SYSTEM,
    instruction: explain.instruction({
      label: region.question_label as string | null,
      subject: (paper?.subject ?? null) as string | null,
      classLevel: (student?.class_level ?? null) as number | null,
      marksAwarded: awarded,
      marksAvailable: available,
      questionText: region.question_text as string | null,
      studentAnswer: region.student_answer as string | null,
      teacherRemark: region.teacher_remark as string | null,
      markShapes: (marks ?? []).map((m) => m.mark_class as string).filter((c) => c !== 'unknown'),
    }),
    schema: explain.SCHEMA,
    validate: explain.validate,
    runId,
    paperId: region.paper_id,
    regionId,
    studentId: region.student_id,
    attempt: msg.attempt,
    routeOverride: override,
  });

  // marks_lost is arithmetic over two facts, never the model's number. If it
  // proposed one, it is discarded here rather than trusted.
  const marksLost = Math.round((available - awarded) * 100) / 100;

  // The floor. Advice that does not name something specific to this answer and
  // performable during an exam renders nothing — an empty slot is honest, and
  // generic advice teaches students to stop reading.
  const doThisNext = clearsTheFloor(parsed.do_this_next) ? parsed.do_this_next : null;

  await sb.from('region_explanation').insert({
    region_id: regionId,
    run_id: runId,
    student_id: region.student_id,
    tier: 'tier_1',
    cause: parsed.cause,
    marks_lost: parsed.cause ? marksLost : null,
    body: parsed.body,
    do_this_next: doThisNext,
    concepts: parsed.concepts,
    model_version: model,
    prompt_version: promptVersion,
  });

  await sb.from('question_region').update({ explain_status: 'done' }).eq('id', regionId);
  await sb.rpc('advance_after_explain', { p_run_id: runId });

  return { detail: { cause: parsed.cause, floor_cleared: !!doThisNext } };
}, async ({ sb, msg }) => {
  // A question we could not explain is one card with nothing on it. Nineteen
  // good explanations waiting on it would be a stalled paper, which is worse.
  await sb.from('question_region').update({ explain_status: 'failed' }).eq('id', msg.region_id as string);
  await sb.rpc('advance_after_explain', { p_run_id: msg.run_id });
});
