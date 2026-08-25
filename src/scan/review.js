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
import { cropUrl } from './crops.js';

/**
 * Everything the review screen needs for one run.
 *
 * Ordered by the review_queue view rather than in here, so the app and the
 * accuracy harness agree about what "needs your eyes" means.
 */
export async function loadReview(runId) {
  const { data: run, error } = await sb
    .from('extraction_run')
    .select('id, paper_id, student_id, status, reconciled, reconcile_delta, tier_routing')
    .eq('id', runId)
    .single();
  if (error) throw error;

  const [{ data: paper }, { data: regions }, { data: pages }, { data: explanations }, { data: unreadable }] =
    await Promise.all([
      sb.from('paper').select('id, type, tier, subject, date_taken, reported_total, total_awarded, total_available')
        .eq('id', run.paper_id).single(),
      sb.from('question_region')
        .select('id, order_index, question_label, question_text, student_answer, teacher_remark, region_type, marks_awarded, marks_available, confidence_tier, confidence_signals, student_confirmed_at, student_corrected, page_spans')
        .eq('run_id', runId).order('order_index'),
      sb.from('paper_page').select('page_number, r2_key, quality_verdict, layer_fallback, status')
        .eq('paper_id', run.paper_id).order('page_number'),
      sb.from('region_explanation').select('region_id, cause, body, do_this_next, marks_lost, scheme_source, scheme_version')
        .eq('run_id', runId),
      sb.from('page_unreadable').select('page_number, reason').eq('paper_id', run.paper_id),
    ]);

  const byRegion = new Map((explanations ?? []).map((e) => [e.region_id, e]));
  const pageByNumber = new Map((pages ?? []).map((p) => [p.page_number, p]));

  const questions = await Promise.all((regions ?? []).map(async (r) => {
    const span = (r.page_spans ?? [])[0];
    const page = span ? pageByNumber.get(span.page) : null;
    const crop = page?.r2_key && span ? await cropUrl(run.paper_id, span.page, span.box) : null;
    const explanation = byRegion.get(r.id) ?? null;

    return {
      id: r.id,
      order: r.order_index,
      label: r.question_label ?? `Question ${r.order_index + 1}`,
      tier: r.confidence_tier,
      confirmed: !!r.student_confirmed_at,
      corrected: !!r.student_corrected,
      marksAwarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
      marksAvailable: r.marks_available === null ? null : Number(r.marks_available),
      answer: r.student_answer,
      questionText: r.question_text,
      remark: r.teacher_remark,
      regionType: r.region_type,
      crop,
      pageNumber: span?.page ?? null,
      unreadableReason: r.confidence_tier === 'unreadable'
        ? (r.confidence_signals?.unreadable_reason ?? 'We could not read this question.')
        : null,
      alternatives: markAlternatives(r),
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
  questions.sort((a, b) => (rank[a.tier] - rank[b.tier]) || (a.order - b.order));

  return {
    run,
    paper,
    questions,
    pagesUnreadable: unreadable ?? [],
    delta: deltaFor(run, paper),
    // Every headline shows its sample size; this is that screen's version of it.
    lead: leadFor(questions, pages ?? []),
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
  };
}

/**
 * The numbers the student is offered when the mark was misread.
 *
 * Neighbours on the half-mark grid, plus the two ends, which between them cover
 * almost every real correction in one tap. The picker is the landing state
 * because typing is slower and rescanning is slower still — the ladder goes
 * pick, then type, then rescan, and most corrections stop at the first rung.
 */
function markAlternatives(region) {
  const available = region.marks_available === null ? null : Number(region.marks_available);
  if (available === null || available <= 0) return [];
  const awarded = region.marks_awarded === null ? null : Number(region.marks_awarded);

  const candidates = new Set([0, available]);
  if (awarded !== null) {
    for (const step of [-1, -0.5, 0, 0.5, 1]) {
      const value = Math.round((awarded + step) * 2) / 2;
      if (value >= 0 && value <= available) candidates.add(value);
    }
  } else {
    for (let v = 0; v <= available && candidates.size < 7; v += available > 6 ? 1 : 0.5) candidates.add(v);
  }
  return [...candidates].sort((a, b) => a - b).slice(0, 7);
}

function deltaFor(run, paper) {
  if (run.reconciled !== false) return null;
  if (paper?.reported_total === null || paper?.reported_total === undefined) return null;
  return {
    // The framing is fixed: our reading is what did not add up. The app never
    // tells a student their teacher cannot add.
    message: 'Our reading of this paper does not match the total on it. Worth checking the questions below.',
    ours: Number(paper.total_awarded ?? 0),
    theirs: Number(paper.reported_total),
  };
}

function leadFor(questions, pages) {
  const needing = questions.filter((q) => q.tier !== 'confident').length;
  const base = `${questions.length} question${questions.length === 1 ? '' : 's'} · ` +
    `${pages.length} page${pages.length === 1 ? '' : 's'}`;
  return needing
    ? `${base} · ${needing} need${needing === 1 ? 's' : ''} your eyes, shown first`
    : `${base} · all read cleanly, worth a look before saving`;
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
    .select('marks_available, marks_awarded_box, page_spans').eq('id', regionId).single();
  if (readError) throw readError;

  const available = region.marks_available === null ? null : Number(region.marks_available);
  if (available !== null && value > available) {
    throw new Error(`This question is out of ${available}, so ${value} can't be the mark on it.`);
  }

  // Provenance survives a correction: the box stays the one we read from, or —
  // where we never found one — the question's own region, which is where the
  // student was looking when they told us.
  const box = region.marks_awarded_box ?? spanBox(region.page_spans);

  const { error } = await sb.from('question_region').update({
    marks_awarded: value,
    marks_awarded_box: box,
    student_confirmed_at: new Date().toISOString(),
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
    student_answer_box: value ? (region.student_answer_box ?? spanBox(region.page_spans)) : null,
    student_confirmed_at: new Date().toISOString(),
    student_corrected: true,
    updated_at: new Date().toISOString(),
  }).eq('id', regionId);
  if (error) throw error;

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
