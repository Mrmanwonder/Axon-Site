// Stage 9 · review: the data behind the screen.
//
// Required in v1, not skippable and not defaulted to accept. `commit_extraction_run`
// refuses while anything still needs the student's eyes, so this is not a
// convention the UI could quietly drop — the database holds the line.
//
// Two things shape the model built here. Unsure and unreadable questions come
// first, because they are the reason the screen exists. And a correction is
// accepted instantly, without verification and without review: on what their own
// paper says, the student is the authority and we are the ones who might have
// misread it.

import { sb } from '../supabase.js';
import { projectQuestionRegions, questionDisplayPath } from '../questionCount.js';
import { reviewLeadFor } from './reviewSummary.js';
import { markAlternatives, allocationIsUsable, markValueIsUsable } from './marks.js';
import { assessmentRulesFor, providerKeyForBoard } from '../curriculum.js';

async function assessmentRulesForStudent(studentId) {
  const { data: student, error } = await sb.from('student')
    .select('programme_id,board')
    .eq('id', studentId)
    .single();
  if (error) throw error;

  let providerKey = null;
  let programmeKey = null;
  if (student.programme_id) {
    const { data: programme, error: programmeError } = await sb.from('curriculum_programme')
      .select('key,provider_id')
      .eq('id', student.programme_id)
      .single();
    if (programmeError) throw programmeError;
    programmeKey = programme.key;
    const { data: provider, error: providerError } = await sb.from('curriculum_provider')
      .select('key')
      .eq('id', programme.provider_id)
      .single();
    if (providerError) throw providerError;
    providerKey = provider.key;
  } else {
    providerKey = providerKeyForBoard(student.board);
  }
  return assessmentRulesFor({ providerKey, programmeKey });
}

/**
 * Everything the review screen needs for one run.
 *
 * Ordered by the review_queue view rather than in here, so the app and the
 * accuracy harness agree about what "needs your eyes" means.
 */
export async function loadReview(runId) {
  const { data: run, error } = await sb
    .from('extraction_run')
    .select('id, paper_id, student_id, status, reconciled, reconcile_delta, status_reason_code, tier_routing')
    .eq('id', runId)
    .single();
  if (error) throw error;

  const markRules = await assessmentRulesForStudent(run.student_id);

  const responses = await Promise.all([
      sb.from('paper').select('id, type, tier, subject, date_taken, reported_total, total_awarded, total_available')
        .eq('id', run.paper_id).single(),
      sb.from('question_region')
        .select('id, order_index, question_label, question_text, student_answer, answer_block, teacher_remark, region_type, marks_awarded, marks_available, confidence_tier, confidence_signals, student_confirmed_at, student_corrected, page_spans')
        .eq('run_id', runId).order('order_index'),
      sb.from('paper_page').select('page_number, r2_key, quality_verdict, layer_fallback, status')
        .eq('paper_id', run.paper_id).order('page_number'),
      sb.from('region_explanation').select('region_id, cause, body, do_this_next, marks_lost, scheme_source, scheme_version')
        .eq('run_id', runId),
      sb.from('page_unreadable').select('page_number, reason').eq('paper_id', run.paper_id),
    ]);
  // A failed read is not an empty paper and cannot mean review is complete.
  // Propagate it to the route's existing retry surface before building counts.
  for (const response of responses) {
    if (response.error) throw response.error;
  }
  const [{ data: paper }, { data: regions }, { data: pages }, { data: explanations }, { data: unreadable }] = responses;

  const byRegion = new Map((explanations ?? []).map((e) => [e.region_id, e]));
  const pageByNumber = new Map((pages ?? []).map((p) => [p.page_number, p]));
  const projection = projectQuestionRegions((regions ?? []).map(r => ({
    id: r.id, label: r.question_label, order_index: r.order_index,
    page: r.page_spans?.[0]?.page ?? null, y: r.page_spans?.[0]?.box?.y ?? null,
    evidence: r.marks_awarded != null || r.marks_available != null || !!r.student_answer || !!r.question_text,
  })));
  const identities = new Map(projection.entries.map(entry => [entry.region.id, entry]));

  const questions = await Promise.all((regions ?? []).map(async (r) => {
    const span = (r.page_spans ?? [])[0];
    const page = span ? pageByNumber.get(span.page) : null;
    // The box, not a rendered image: <Crop> cuts it in CSS from the page the
    // browser is already showing, so nothing is fetched or decoded here.
    const crop = page?.r2_key && span ? { paperId: run.paper_id, page: span.page, box: span.box } : null;
    const explanation = byRegion.get(r.id) ?? null;

    return {
      id: r.id,
      order: r.order_index,
      label: questionDisplayPath(identities.get(r.id)?.question ?? null, identities.get(r.id)?.part ?? null),
      identityNote: identities.get(r.id)?.inherited ? `Parent linked by source order. Printed label: ${r.question_label}` : null,
      tier: r.confidence_tier,
      confirmed: !!r.student_confirmed_at,
      corrected: !!r.student_corrected,
      marksAwarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
      marksAvailable: r.marks_available === null ? null : Number(r.marks_available),
      answer: r.student_answer,
      answerBlock: r.answer_block ?? null,
      questionText: r.question_text,
      markStep: markRules.markStep,
      paperId: run.paper_id,
      pageNumbers: [...new Set((r.page_spans ?? []).map(s => s.page))],
      remark: r.teacher_remark,
      regionType: r.region_type,
      crop,
      pageNumber: span?.page ?? null,
      unreadableReason: r.confidence_tier === 'unreadable'
        ? (r.confidence_signals?.unreadable_reason ?? 'We could not read this question.')
        : null,
      alternatives: markAlternatives(r, markRules),
      // Hard rule 4. A part whose allocation could not be read as a whole
      // number gets no correction grid, and the screen says why rather than
      // rendering an empty space where a row used to be.
      allocationUnusable: r.marks_available !== null && !allocationIsUsable(r, markRules),
      explanation: explanation && explanation.body
        ? {
            cause: explanation.cause,
            body: explanation.body,
            doThisNext: explanation.do_this_next,
            scheme: explanation.scheme_source
              ? { source: explanation.scheme_source, version: explanation.scheme_version }
              : null,
          }
        : null,
    };
  }));

  // Unreadable first, then unsure, then the rest — and within each, paper order.
  const rank = { unreadable: 0, unsure: 1, confident: 2 };
  questions.sort((a, b) => (Number(a.confirmed) - Number(b.confirmed)) || (rank[a.tier] - rank[b.tier]) || (a.order - b.order));
  const counts = projection.counts;

  return {
    run,
    paper,
    markRules,
    questions,
    pagesUnreadable: unreadable ?? [],
    delta: deltaFor(run, paper, regions ?? []),
    noTotal: noTotalFor(run),
    // Every headline shows its sample size; this is that screen's version of it.
    lead: reviewLeadFor(questions, pages ?? [], counts),
    // Every unconfirmed region, not just the doubtful ones. commit_extraction_run
    // refuses while *anything* still has needs_review and no confirmation, and
    // finalize sets needs_review on all of them — review is mandatory in v1 and
    // that is the whole point. Counting only the doubtful ones put "Save to
    // Library" on a button the server then refused, every time a paper had a
    // cleanly-read question on it, which is every paper.
    outstanding: questions.filter((q) => !q.confirmed).length,
    // The cleanly-read ones, which the student can accept as a group. Not a
    // default and not a skip: they are on screen, with their crops, and this is
    // a deliberate tap. Making someone press the same button fourteen times to
    // say "yes, that is what my paper says" is how a required step becomes a
    // step people learn to rush.
    cleanUnconfirmed: questions.filter((q) => q.tier === 'confident' && !q.confirmed).map((q) => q.id),
    // Every reading the student can vouch for in one go once they have looked:
    // anything with a reading on screen. An unreadable region has nothing to
    // vouch for and stays out (owner, 5 Oct 2026: nineteen taps on a paper the
    // reader got right).
    readableUnconfirmed: questions.filter((q) => q.tier !== 'unreadable' && !q.confirmed).map((q) => q.id),
  };
}


export function deltaFor(run, paper, regions) {
  const readable = regions.filter(r => r.confidence_tier !== 'unreadable' && r.marks_awarded != null);
  if (!readable.length) return null;
  const awarded = readable.reduce((sum, r) => sum + Number(r.marks_awarded), 0);
  if (paper?.reported_total === null || paper?.reported_total === undefined) return null;
  if (Math.abs(awarded - Number(paper.reported_total)) < 0.0001) return null;
  return {
    // The framing is fixed: our reading is what did not add up. The app never
    // tells a student their teacher cannot add.
    message: 'Our reading of this paper does not match the total on it. Worth checking the questions below.',
    ours: awarded,
    theirs: Number(paper.reported_total),
  };
}

/**
 * A paper that printed no total is unchecked, not wrong. Say so once, before the student saves,
 * so the figure they see afterwards ("added up by Axon") is not a surprise.
 */
function noTotalFor(run) {
  return run.status_reason_code === 'no_printed_total'
    ? 'No total is printed on this paper. Axon adds up the marks it reads.'
    : null;
}

// ── corrections ────────────────────────────────────────────────────────────
// All of these are accepted instantly. There is no verification step, no queue,
// and no "are you sure?": asking a student to prove to the machine that they can
// read their own paper is the pattern this product is built against.

/** The reading was right. One tap, the common case on a clean paper. */
export async function confirmQuestion(regionId) {
  return confirmQuestions([regionId]);
}

/** The same, for the group of questions that were read cleanly. */
export async function confirmQuestions(regionIds) {
  if (!regionIds.length) return;
  const now = new Date().toISOString();
  const { error } = await sb.from('question_region')
    .update({ student_confirmed_at: now, updated_at: now })
    .in('id', regionIds);
  if (error) throw error;
}

/**
 * The mark was misread — this is the number the teacher wrote.
 *
 * A transcription correction, not a student assigning themselves marks. The
 * source stays the teacher's pen at commit, because that is still where the
 * number came from; what changed is our reading of it.
 */
export async function correctMark(regionId, value) {
  const { data: region, error: readError } = await sb.from('question_region')
    .select('marks_available, marks_awarded_box, page_spans, run_id').eq('id', regionId).single();
  if (readError) throw readError;

  const available = region.marks_available === null ? null : Number(region.marks_available);
  const { data: run, error: runError } = await sb.from('extraction_run')
    .select('student_id').eq('id', region.run_id).single();
  if (runError) throw runError;
  const markRules = await assessmentRulesForStudent(run.student_id);

  if (available !== null && value > available) {
    throw new Error(`This question is out of ${available}, so ${value} can't be the mark on it.`);
  }
  if (!markValueIsUsable(value, available, markRules)) {
    const wording = markRules.markStep === 1
      ? 'This paper is marked in whole marks.'
      : `This paper uses ${markRules.markStep}-mark steps.`;
    throw new Error(`${wording} Check the number written on the paper.`);
  }

  // Provenance survives a correction: the box stays the one we read from, or —
  // where we never found one — the question's own region, which is where the
  // student was looking when they told us.
  const box = region.marks_awarded_box ?? spanBox(region.page_spans);

  const { error } = await sb.from('question_region').update({
    marks_awarded: value,
    marks_awarded_box: box,
    // A changed field invalidates whole-question confirmation. Only the
    // explicit confirm action accepts the other readings.
    student_confirmed_at: null,
    student_corrected: true,
    updated_at: new Date().toISOString(),
  }).eq('id', regionId);
  if (error) throw error;

  await countCorrection(regionId);
}

/** The transcription was wrong — this is what it actually says. */
export async function correctAnswer(regionId, text) {
  const { data: region, error: readError } = await sb.from('question_region')
    .select('student_answer_box, page_spans').eq('id', regionId).single();
  if (readError) throw readError;

  const value = String(text ?? '').trim();
  const { error } = await sb.from('question_region').update({
    student_answer: value || null,
    // The old structured transcription no longer represents this correction.
    // Commit must carry the corrected raw text, without stale model segments.
    answer_block: null,
    student_answer_box: value ? (region.student_answer_box ?? spanBox(region.page_spans)) : null,
    student_confirmed_at: null,
    student_corrected: true,
    updated_at: new Date().toISOString(),
  }).eq('id', regionId);
  if (error) throw error;

  await countCorrection(regionId);
}

/**
 * Which question and part this is. The student has the paper, so placing a
 * part is transcription and is accepted at once, the same as Fix this (owner,
 * 6 Oct 2026: "I can't choose the question and part"). Two parts of one paper
 * cannot share a label; the server refuses that, and the student is told which.
 */
export async function relabelRegion(regionId, label) {
  const clean = String(label ?? '').replace(/\s+/g, '').slice(0, 24);
  if (!/^\d{1,3}(\([a-z]\))?(\([ivx]{1,4}\))?$/.test(clean)) throw new Error('Choose the question number, and the part if it has one.');
  const { error } = await sb.from('question_region')
    .update({ question_label: clean, updated_at: new Date().toISOString() })
    .eq('id', regionId);
  if (error) {
    if (error.code === '23505') throw new Error(`Another part of this paper is already ${clean}. Change that one first.`);
    throw error;
  }
  await countCorrection(regionId);
}

/**
 * "Not why I lost it."
 *
 * Accepted immediately and without argument. This is self-knowledge, and it is
 * exactly the signal worth having — the rejection removes the event from
 * analytics rather than starting a negotiation about it.
 */
export async function rejectCause(regionId) {
  const { error } = await sb.from('region_explanation')
    .update({ cause: null, marks_lost: null }).eq('region_id', regionId);
  if (error) throw error;
  await countCorrection(regionId);
}

function spanBox(spans) {
  const span = (spans ?? [])[0];
  return span ? { page: span.page, ...span.box } : null;
}

/**
 * Corrections are counted per run.
 *
 * Not to keep score of the student — to keep score of the pipeline. The
 * correction rate per field type is the best ongoing signal of where extraction
 * is actually weak, as opposed to where it was weak on twenty papers from one
 * city, and it is the number a pipeline change has to move.
 */
async function countCorrection(regionId) {
  const { data: region } = await sb.from('question_region').select('run_id').eq('id', regionId).single();
  if (!region) return;
  const { data: run } = await sb.from('extraction_run')
    .select('corrections_count').eq('id', region.run_id).single();
  if (!run) return;
  await sb.from('extraction_run')
    .update({ corrections_count: (run.corrections_count ?? 0) + 1 }).eq('id', region.run_id);
}

/** Stage 10. Refused server-side while anything still needs review. */
export async function commitRun(runId) {
  const { data, error } = await sb.rpc('commit_extraction_run', { p_run_id: runId });
  if (error) throw error;
  return data;
}
