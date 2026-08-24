// Stage 6 · reconciliation.
//
// The most important stage in the pipeline, and the reason the system can claim
// to know when it is wrong.
//
// A graded paper carries its own answer key for the extraction: the teacher's
// reported total. If our per-question marks sum to it, the reading is very
// unlikely to be wrong in a way that matters. If they do not, it is definitely
// wrong somewhere — and the size of the gap says where. A delta equal to one
// question's typical value points straight at a question that was missed or
// counted twice.
//
// Ground truth without ground truth, and measurable in production without
// labels, which is what makes the reconciliation rate the production monitor.

export interface RegionMarks {
  order_index: number;
  label: string | null;
  awarded: number | null;
  available: number | null;
  recognition: 'high' | 'medium' | 'low' | null;
}

export interface Reconciliation {
  reconciled: boolean;
  delta: number | null;
  sum_awarded: number;
  sum_available: number;
  checks: {
    awarded_matches_total: boolean | null;
    available_matches_maximum: boolean | null;
    every_question_within_its_maximum: boolean;
  };
  /** Regions to put in front of the student first, worst-suspected first. */
  suspects: number[];
  /** Plain words for the review screen. Never says the teacher cannot add. */
  message: string | null;
}

const sum = (ns: (number | null)[]) =>
  ns.reduce<number>((t, n) => t + (typeof n === 'number' ? n : 0), 0);

export function reconcile(
  regions: RegionMarks[],
  reportedTotal: number | null,
  statedMaximum: number | null,
): Reconciliation {
  const sumAwarded = sum(regions.map((r) => r.awarded));
  const sumAvailable = sum(regions.map((r) => r.available));

  const awardedMatches = reportedTotal === null ? null : nearly(sumAwarded, reportedTotal);
  const availableMatches = statedMaximum === null ? null : nearly(sumAvailable, statedMaximum);
  const withinMax = regions.every((r) =>
    r.awarded === null || r.available === null || r.awarded <= r.available + 1e-6);

  // A paper with no total on it skips checks 1 and 2 and keeps check 3. It is
  // not a failure — it is a paper we know less about, and the whole paper drops
  // a confidence tier to say so.
  const reconciled = withinMax &&
    (awardedMatches ?? true) && (availableMatches ?? true) &&
    (awardedMatches !== null || availableMatches !== null);

  const delta = reportedTotal === null ? null : round2(sumAwarded - reportedTotal);

  return {
    reconciled,
    delta,
    sum_awarded: round2(sumAwarded),
    sum_available: round2(sumAvailable),
    checks: {
      awarded_matches_total: awardedMatches,
      available_matches_maximum: availableMatches,
      every_question_within_its_maximum: withinMax,
    },
    suspects: rankSuspects(regions, delta),
    message: messageFor(regions, reportedTotal, sumAwarded, delta, withinMax),
  };
}

/**
 * Order the regions the student should look at first.
 *
 * Weakest recognition first, then anything missing a mark, then — when the delta
 * matches a single question's value exactly — that question, promoted to the
 * front, because a gap the size of one question usually is one question.
 */
function rankSuspects(regions: RegionMarks[], delta: number | null): number[] {
  const score = (r: RegionMarks) => {
    let s = 0;
    if (r.recognition === 'low') s += 3;
    else if (r.recognition === 'medium') s += 1;
    if (r.awarded === null) s += 3;
    if (r.available === null) s += 2;
    if (r.label === null) s += 1;
    return s;
  };

  const ranked = regions
    .map((r) => ({ index: r.order_index, score: score(r) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.index);

  if (delta !== null && delta !== 0) {
    const exact = regions.find((r) => r.awarded !== null && nearly(Math.abs(delta), r.awarded));
    if (exact) return [exact.order_index, ...ranked.filter((i) => i !== exact.order_index)];
  }
  return ranked;
}

/**
 * How the discrepancy is described to the student.
 *
 * The framing is fixed and it matters: our reading of the paper is what did not
 * add up, and the questions are worth checking. A fifteen-year-old told by
 * software that their teacher cannot add is a product that gets deleted, and it
 * would break the rule that the app never contradicts the teacher's marks.
 * Internally this is an unreconciled paper; to the student it is a scan worth a
 * second look.
 */
function messageFor(
  regions: RegionMarks[],
  reportedTotal: number | null,
  sumAwarded: number,
  delta: number | null,
  withinMax: boolean,
): string | null {
  if (!withinMax) {
    return 'Our reading of this paper gives one question more marks than it was worth — worth checking these.';
  }
  if (reportedTotal === null) {
    return regions.length
      ? 'We could not find this paper’s total, so we could not check our reading against it.'
      : null;
  }
  if (delta === null || delta === 0) return null;
  return `Our reading of this paper adds up to ${trim(sumAwarded)}, and the total on the paper is ` +
    `${trim(reportedTotal)} — worth checking these questions.`;
}

const nearly = (a: number, b: number) => Math.abs(a - b) < 0.01;
const round2 = (n: number) => Math.round(n * 100) / 100;
const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
