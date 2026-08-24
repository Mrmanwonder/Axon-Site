// Stages 6 and 7, and the confidence model that depends on both.
//
// Nothing here calls a vision model. Reconciliation is arithmetic, tier routing
// is a lookup, and confidence is a composite over signals the earlier stages
// already produced — which is the point: the stage that decides how much to
// trust a reading must not be the same stage that produced it.
//
// This is the last thing that happens before the student sees the paper.

import { CORS, clientFor, failure, json, readJson } from '../_shared/http.ts';
import { assess, numberingSoundness } from '../_shared/confidence.ts';
import { reconcile, type RegionMarks } from '../_shared/reconcile.ts';
import { tierToConfidence } from '../_shared/contract.ts';

interface Body { run_id: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = clientFor(req);
  if (!sb) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.run_id) return failure('A run is needed.');

  const { data: run, error: runError } = await sb
    .from('extraction_run').select('*').eq('id', body.run_id).single();
  if (runError || !run) return failure('That extraction could not be found.', 404);

  const { data: paper } = await sb
    .from('paper')
    .select('id, student_id, type, tier, subject, date_taken, reported_total, stated_maximum')
    .eq('id', run.paper_id).single();
  if (!paper) return failure('That paper could not be found.', 404);

  const { data: regions } = await sb
    .from('question_region')
    .select('id, order_index, question_label, question_text, marks_awarded, marks_available, confidence_signals, confidence_tier')
    .eq('run_id', run.id)
    .order('order_index');
  if (!regions?.length) return failure('There are no questions on this run to finish.', 422);

  const { data: pages } = await sb
    .from('paper_page').select('page_number, layer_fallback').eq('paper_id', paper.id);
  const anyFallback = (pages ?? []).some((p) => p.layer_fallback);

  // ── stage 6 · reconciliation ─────────────────────────────────────────────

  const forReconcile: RegionMarks[] = regions.map((r) => ({
    order_index: r.order_index,
    label: r.question_label,
    awarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
    available: r.marks_available === null ? null : Number(r.marks_available),
    recognition: (r.confidence_signals?.recognition ?? null) as 'high' | 'medium' | 'low' | null,
  }));

  const result = reconcile(
    forReconcile,
    paper.reported_total === null ? null : Number(paper.reported_total),
    paper.stated_maximum === null ? null : Number(paper.stated_maximum),
  );

  // Nothing below adjusts a mark to make the arithmetic close. A discrepancy is
  // surfaced with its delta and the least-confident questions ordered first;
  // silently correcting one would produce a clean-looking paper that is
  // quietly fictional, which is the single worst thing this system could do.

  // ── stage 7 · tier routing ───────────────────────────────────────────────

  const routing = await routeTier(sb, paper, regions);

  // ── confidence, over four independent signals ────────────────────────────

  const sound = numberingSoundness(regions.map((r) => r.question_label));

  let confident = 0, unsure = 0, unreadable = 0;
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const signals = (r.confidence_signals ?? {}) as Record<string, unknown>;
    const { tier, signals: assessed } = assess({
      recognition: (signals.recognition ?? null) as 'high' | 'medium' | 'low' | null,
      numberingSound: sound[i],
      paperReconciled: result.reconciled,
      awarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
      available: r.marks_available === null ? null : Number(r.marks_available),
      layerFallback: anyFallback,
      unreadable: r.confidence_tier === 'unreadable',
    });

    if (tier === 'confident') confident++;
    else if (tier === 'unreadable') unreadable++;
    else unsure++;

    await sb.from('question_region').update({
      confidence_tier: tier,
      confidence_signals: { ...signals, ...assessed, commits_as: tierToConfidence(tier) },
      // Review is mandatory in v1 whatever the tier says. A confident-paper fast
      // path is earned with measured accuracy, not assumed at launch, and the
      // commit function refuses regardless — this flag only decides ordering.
      needs_review: true,
      canonical_question_id: routing.matches.get(r.id) ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', r.id);
  }

  // ── write the paper's own totals back ────────────────────────────────────
  // Our sums, kept beside the teacher's reported total rather than replacing it.

  // The tier can only move while nothing is hanging off it. student_attempt
  // carries a composite key back to (paper_id, tier), so changing the tier under
  // a paper that already has committed attempts from an earlier run would fail
  // the constraint — correctly, because those attempts were routed under the old
  // tier and would silently start claiming a scheme they were never matched to.
  const { count: committed } = await sb
    .from('student_attempt')
    .select('id', { count: 'exact', head: true })
    .eq('paper_id', paper.id);

  await sb.from('paper').update({
    total_awarded: result.sum_awarded,
    total_available: result.sum_available > 0 ? result.sum_available : null,
    reconciled: result.reconciled,
    ...(committed ? {} : { tier: routing.tier }),
  }).eq('id', paper.id);

  const timings = (run.stage_timings ?? {}) as Record<string, number>;
  timings.finalize_ms = Date.now() - Date.parse(run.started_at);

  await sb.from('extraction_run').update({
    status: 'needs_review',
    reconciled: result.reconciled,
    reconcile_delta: result.delta,
    tier_routing: routing.note,
    stage_timings: timings,
    finished_at: new Date().toISOString(),
  }).eq('id', run.id);

  return json({
    run_id: run.id,
    reconciliation: result,
    tier: committed ? paper.tier : routing.tier,
    tier_note: committed
      ? { ...routing.note, kept: 'this paper already has saved questions, so its tier stands' }
      : routing.note,
    counts: { confident, unsure, unreadable, total: regions.length },
  });
});

/**
 * Stage 7 · tier routing.
 *
 * The test type decides this, and it is the highest-leverage field in the app. A
 * school test has no official scheme and is explained from the teacher's marks.
 * A board paper or sample paper gets one attempt at a match against the scheme
 * library, and on no match falls back to Tier 1 and says so — an approximated
 * scheme is a fabricated authority and is worse than none.
 *
 * Matching is by question text against the canonical questions for this board,
 * subject and year. Text similarity is a first implementation and it is
 * deliberately strict: a wrong match attaches the wrong marking scheme to a
 * student's answer, which is worse than no match at all. Matching on the paper
 * code printed on the front page would be far better and is an open item — it
 * needs the code extracted at stage 3 and the library keyed by it.
 */
async function routeTier(
  sb: NonNullable<ReturnType<typeof clientFor>>,
  paper: { id: string; student_id: string; type: string; tier: string; subject: string | null; date_taken: string },
  regions: { id: string; question_text: string | null }[],
): Promise<{ tier: 'tier_1' | 'tier_2'; matches: Map<string, string>; note: Record<string, unknown> }> {
  const matches = new Map<string, string>();

  if (paper.type !== 'pyq' && paper.type !== 'sample_paper') {
    return {
      tier: 'tier_1',
      matches,
      note: { routed: 'tier_1', reason: 'a school test has no official scheme to match against' },
    };
  }
  if (!paper.subject) {
    return {
      tier: 'tier_1',
      matches,
      note: { routed: 'tier_1', reason: 'no subject on the paper, so the scheme library cannot be searched' },
    };
  }

  const { data: student } = await sb.from('student').select('board').eq('id', paper.student_id).single();
  const year = Number(paper.date_taken.slice(0, 4));

  const { data: candidates } = await sb
    .from('canonical_question')
    .select('id, question_text, marking_scheme, scheme_source, scheme_version, exam_year')
    .eq('board', student?.board ?? 'CBSE')
    .eq('subject', paper.subject)
    .in('exam_year', [year, year - 1]);

  if (!candidates?.length) {
    return {
      tier: 'tier_1',
      matches,
      note: {
        routed: 'tier_1',
        reason: 'no official marking scheme is held for this paper',
        searched: { board: student?.board ?? 'CBSE', subject: paper.subject, years: [year, year - 1] },
      },
    };
  }

  let matched = 0;
  for (const region of regions) {
    if (!region.question_text) continue;
    let best: { id: string; score: number } | null = null;
    for (const candidate of candidates) {
      const score = similarity(region.question_text, candidate.question_text);
      if (!best || score > best.score) best = { id: candidate.id, score };
    }
    // Strict on purpose. Below this the two questions merely share vocabulary,
    // and attaching a scheme on that basis would put words in an examiner's
    // mouth.
    if (best && best.score >= 0.78) { matches.set(region.id, best.id); matched++; }
  }

  if (!matched) {
    return {
      tier: 'tier_1',
      matches,
      note: {
        routed: 'tier_1',
        reason: 'this paper is in the library’s range but no question matched confidently',
        candidates_considered: candidates.length,
      },
    };
  }

  return {
    tier: 'tier_2',
    matches,
    note: {
      routed: 'tier_2',
      matched_questions: matched,
      of_total: regions.length,
      // Questions that did not match stay Tier 1 within a Tier 2 paper. They are
      // explained from the teacher's marks, and the UI must not imply otherwise.
      unmatched_are_tier_1: regions.length - matched,
    },
  };
}

/** Dice coefficient over normalised word bigrams. Word order matters; punctuation does not. */
function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const words = s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const out = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) out.add(`${words[i]} ${words[i + 1]}`);
    if (words.length === 1) out.add(words[0]);
    return out;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return (2 * shared) / (A.size + B.size);
}
