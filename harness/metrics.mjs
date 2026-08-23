// The five metrics, in priority order.
//
// SCANNING_SYSTEM.md §18 is the specification and the order is not cosmetic:
// mark attribution is the north-star metric and everything else is diagnostic.
// A pipeline that transcribes beautifully and binds a mark to the wrong question
// is worse than one that transcribes badly and binds correctly, because the
// first produces confident analytics about somebody else's answer and the second
// produces an explanation with a typo in it.
//
// Pure functions over plain objects, so they can be unit-tested without a
// database, a model, or twenty real papers.

// ── matching predictions to labels ─────────────────────────────────────────

/** Intersection over union of two boxes on the same page. */
export function iou(a, b) {
  if (!a || !b || a.page !== b.page) return 0;
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  const overlap = (x1 - x0) * (y1 - y0);
  return overlap / (a.w * a.h + b.w * b.h - overlap);
}

/** Best overlap between two multi-page regions: the mean IoU over shared pages. */
export function spansIou(a = [], b = []) {
  const pages = new Set([...a.map((s) => s.page), ...b.map((s) => s.page)]);
  let total = 0;
  for (const page of pages) {
    const left = a.find((s) => s.page === page);
    const right = b.find((s) => s.page === page);
    total += left && right ? iou({ page, ...left.box }, { page, ...right.box }) : 0;
  }
  return pages.size ? total / pages.size : 0;
}

/**
 * Pair predicted regions with labelled ones.
 *
 * A shared question label is decisive where both sides have one — that is the
 * paper's own identifier and it beats any amount of geometry. Everything else
 * falls back to greedy overlap, best pair first.
 */
export function matchRegions(labels, predictions, { minIou = 0.5 } = {}) {
  const pairs = [];
  const usedLabel = new Set();
  const usedPrediction = new Set();

  for (const [li, label] of labels.entries()) {
    if (!label.label) continue;
    const pi = predictions.findIndex((p, i) =>
      !usedPrediction.has(i) && normaliseLabel(p.label) === normaliseLabel(label.label));
    if (pi === -1) continue;
    pairs.push({ label: li, prediction: pi, by: 'label', iou: spansIou(label.spans, predictions[pi].spans) });
    usedLabel.add(li);
    usedPrediction.add(pi);
  }

  const candidates = [];
  for (const [li, label] of labels.entries()) {
    if (usedLabel.has(li)) continue;
    for (const [pi, prediction] of predictions.entries()) {
      if (usedPrediction.has(pi)) continue;
      const score = spansIou(label.spans, prediction.spans);
      if (score >= minIou) candidates.push({ label: li, prediction: pi, iou: score });
    }
  }
  candidates.sort((a, b) => b.iou - a.iou);
  for (const candidate of candidates) {
    if (usedLabel.has(candidate.label) || usedPrediction.has(candidate.prediction)) continue;
    usedLabel.add(candidate.label);
    usedPrediction.add(candidate.prediction);
    pairs.push({ ...candidate, by: 'overlap' });
  }

  return {
    pairs,
    unmatchedLabels: labels.map((_, i) => i).filter((i) => !usedLabel.has(i)),
    unmatchedPredictions: predictions.map((_, i) => i).filter((i) => !usedPrediction.has(i)),
  };
}

const normaliseLabel = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ── 1 · mark attribution accuracy ──────────────────────────────────────────

/**
 * The north-star metric: the share of labelled questions whose awarded mark was
 * read correctly *and* bound to the right question.
 *
 * A question the pipeline never found counts against it. That is deliberate — a
 * missing question is a mark that silently never entered the analytics, which is
 * the failure this metric exists to catch, and scoring only what was found would
 * reward a pipeline for giving up.
 */
export function markAttribution(labels, predictions) {
  const { pairs } = matchRegions(labels, predictions);
  const byLabel = new Map(pairs.map((p) => [p.label, p.prediction]));

  let correct = 0;
  const wrong = [];
  for (const [li, label] of labels.entries()) {
    if (label.marks_awarded === null || label.marks_awarded === undefined) continue;
    const pi = byLabel.get(li);
    const prediction = pi === undefined ? null : predictions[pi];
    const got = prediction?.marks_awarded ?? null;
    if (got !== null && Math.abs(Number(got) - Number(label.marks_awarded)) < 1e-6) correct++;
    else wrong.push({ label: label.label, expected: label.marks_awarded, got, found: !!prediction });
  }

  const scored = labels.filter((l) => l.marks_awarded !== null && l.marks_awarded !== undefined).length;
  return { correct, scored, accuracy: scored ? correct / scored : 1, wrong };
}

// ── 2 · reconciliation rate ────────────────────────────────────────────────
// The best single proxy for end-to-end health, and the only metric here that is
// measurable in production without labels — which is what makes it the
// production monitor rather than just a harness number.

export function reconciliationRate(papers) {
  const closed = papers.filter((p) => p.reconciled === true).length;
  return { closed, papers: papers.length, rate: papers.length ? closed / papers.length : 0 };
}

// ── 3 · question segmentation ──────────────────────────────────────────────
// Over- and under-segmentation reported separately. They have different causes
// and different fixes: splitting one answer in two usually means a rule line or
// a paragraph break read as a boundary, while merging two means a question
// number was missed. A single F1 hides which one is happening.

export function segmentation(labels, predictions, { minIou = 0.5 } = {}) {
  const { pairs, unmatchedLabels, unmatchedPredictions } = matchRegions(labels, predictions, { minIou });
  const truePositives = pairs.filter((p) => p.iou >= minIou).length;
  const precision = predictions.length ? truePositives / predictions.length : 0;
  const recall = labels.length ? truePositives / labels.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  // A spare prediction that overlaps a labelled region is a split of it.
  let over = 0;
  for (const pi of unmatchedPredictions) {
    if (labels.some((l) => spansIou(l.spans, predictions[pi].spans) > 0.1)) over++;
  }
  // A labelled region with no match of its own, swallowed by a prediction that
  // matched a different label, is a merge.
  let under = 0;
  for (const li of unmatchedLabels) {
    if (pairs.some((p) => spansIou(labels[li].spans, predictions[p.prediction].spans) > 0.1)) under++;
  }

  return {
    precision, recall, f1,
    matched: truePositives,
    labelled: labels.length,
    predicted: predictions.length,
    over_segmented: over,
    under_segmented: under,
  };
}

// ── 4 · answer text WER ────────────────────────────────────────────────────
// Matters least of the four. Explanations tolerate an imperfect transcription
// far better than analytics tolerate a misattributed mark, and a metric that
// says otherwise will get the pipeline optimised for the wrong thing.

export function wordErrorRate(reference, hypothesis) {
  const a = words(reference), b = words(hypothesis);
  if (!a.length) return b.length ? 1 : 0;

  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] / a.length;
}

const words = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/).filter(Boolean);

export function answerWer(labels, predictions) {
  const { pairs } = matchRegions(labels, predictions);
  const byLabel = new Map(pairs.map((p) => [p.label, p.prediction]));
  let total = 0, counted = 0;

  for (const [li, label] of labels.entries()) {
    if (!label.answer_text) continue;
    // A diagram is deliberately not transcribed, so scoring it as an empty
    // transcription would punish the pipeline for following its own rule.
    if (label.region_type === 'diagram') continue;
    const prediction = byLabel.has(li) ? predictions[byLabel.get(li)] : null;
    total += wordErrorRate(label.answer_text, prediction?.student_answer ?? '');
    counted++;
  }
  return { wer: counted ? total / counted : 0, counted };
}

// ── 5 · correction rate in review ──────────────────────────────────────────
// From production, per field type. The best ongoing signal of where the pipeline
// is actually weak, as opposed to where it was weak on twenty papers from one
// city — which is the limit of everything above.

export function correctionRate(runs) {
  // A paper's questions arrive either as the list itself or as a count,
  // depending on whether the caller exported the detail. Accept both rather
  // than silently summing an array into a string, which turns the rate into
  // NaN and reads on a report as though nothing was corrected.
  const countOf = (r) => (Array.isArray(r.questions) ? r.questions.length : Number(r.questions ?? 0));
  const questions = runs.reduce((t, r) => t + countOf(r), 0);
  const corrections = runs.reduce((t, r) => t + (Number(r.corrections_count) || 0), 0);
  return { corrections, questions, rate: questions ? corrections / questions : 0 };
}

// ── the gates ──────────────────────────────────────────────────────────────

export const GATES = {
  // Below this, per-question errors compound across papers and the trend lines
  // become confidently misleading — worse than an empty state.
  MARK_ATTRIBUTION: 0.98,
  // Review cannot be made skippable until the arithmetic closes unaided this often.
  RECONCILIATION: 0.90,
  // Against the previous prompt_version, not against an absolute floor. A prompt
  // edit that quietly costs a point of attribution accuracy is the most likely
  // way this system degrades, and it is invisible in any single paper — nobody
  // reviewing the diff would see it, and no student would report it.
  MAX_REGRESSION: 0.005,
};

export function gate(report, baseline = null) {
  const failures = [];

  if (baseline) {
    const drop = baseline.mark_attribution.accuracy - report.mark_attribution.accuracy;
    if (drop > GATES.MAX_REGRESSION) {
      failures.push({
        gate: 'attribution regression',
        required: baseline.mark_attribution.accuracy - GATES.MAX_REGRESSION,
        got: report.mark_attribution.accuracy,
        consequence:
          `Down ${(drop * 100).toFixed(2)}pp against ${baseline.pipeline_version}. ` +
          'Land the prompt or model change only with a reason this is acceptable.',
      });
    }
  }

  if (report.mark_attribution.accuracy < GATES.MARK_ATTRIBUTION) {
    failures.push({
      gate: 'mark attribution',
      required: GATES.MARK_ATTRIBUTION,
      got: report.mark_attribution.accuracy,
      consequence: 'Insights must not ship against real data yet.',
    });
  }
  if (report.reconciliation.rate < GATES.RECONCILIATION) {
    failures.push({
      gate: 'reconciliation',
      required: GATES.RECONCILIATION,
      got: report.reconciliation.rate,
      consequence: 'The review step stays mandatory.',
    });
  }
  return failures;
}
