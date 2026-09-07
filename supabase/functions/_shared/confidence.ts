// The confidence model.
//
// Not the model's token probability. That number is overconfident on handwriting
// and correlates poorly with being right, and putting it on screen as a
// percentage would be a calibration claim there is no evidence for.
//
// Four signals instead, and they are worth having precisely because they are
// independent: a field can be read cleanly and still be structurally suspect —
// clean recognition of a question number that breaks the sequence is exactly the
// case a recognition score cannot catch and this can.

import type { ConfidenceTier } from './contract.ts';

export interface Signals {
  recognition: boolean;
  structural: boolean;
  arithmetic: boolean;
  plausibility: boolean;
  /**
   * The two things `structural` is the conjunction of, kept alongside it.
   *
   * §6: uncertainty has to stay decomposable. `structural: false` on its own
   * cannot tell anyone whether the numbering broke or the boundary did, and
   * those are different bugs with different fixes. Written into
   * confidence_signals (jsonb) so the distinction survives into the row and
   * into review, without a schema change.
   */
  structure_numbering?: boolean;
  structure_boundary?: boolean;
}

export interface SignalInput {
  recognition: 'high' | 'medium' | 'low' | null;
  /** This region's number is present and continues the paper's sequence. */
  numberingSound: boolean;
  /**
   * Whether this region's own geometry holds up: it has at least one span,
   * and every span has a real box.
   *
   * Separate from `numberingSound` on purpose. Structure confidence used to
   * *be* numbering soundness — one boolean standing in for the whole of
   * "do we know where this question is and what it is called" — which meant a
   * question with a perfectly sequential label and no usable boundary scored
   * as structurally sound. They fail for different reasons and are fixed by
   * different things, so they are recorded separately even though the tier
   * still needs both (§57).
   *
   * Defaults true: a caller that does not know is not making a claim, and
   * absence of evidence is not evidence of a broken boundary.
   */
  boundarySound?: boolean;
  /**
   * Nothing about the arithmetic implicates THIS question.
   *
   * This used to be `paperReconciled` — one boolean per paper, computed once
   * and handed to every region identically. One total that did not close took
   * every question on the paper down with it, however cleanly each one was
   * read, and since almost no real paper's totals close on the first pass, 84%
   * of extracted questions never reached `confident` at all. That is not a
   * strict confidence model; it is a confidence model that has stopped
   * discriminating, and it made review uniformly tedious — every question
   * tapped individually, bulk-accept permanently dead.
   *
   * A paper that closes still passes this for every region. A paper that does
   * not goes to adjudication, which is the stage that can say WHICH questions
   * are implicated; it clears the rest itself. See w-adjudicate.
   */
  arithmeticSound: boolean;
  awarded: number | null;
  available: number | null;
  /**
   * THIS region's pages broke the colour assumption.
   *
   * Also formerly paper-wide. One page that fell back off colour separation
   * said nothing about a question three pages later, but demoted it anyway.
   * Scoped through `question_region.page_spans` now.
   */
  layerFallback: boolean;
  /** Nothing readable at all, or a value that arrived with no box. */
  unreadable: boolean;
}

/**
 * The recognition confidence the content pass actually recorded.
 *
 * `confidence_signals.recognition` is written by extract-content from the
 * model's own `recognition_confidence`, so the real 'high' | 'medium' | 'low'
 * is in the row. Reading it back is the whole of this function; it exists
 * because the alternative — deriving recognition from `confidence_tier` — is
 * circular. The tier is computed *from* recognition, so recovering one from
 * the other can only ever return what was already assumed, and what it
 * actually returned was a flat 'medium' for every readable question on every
 * paper.
 *
 * Null when nothing was recorded, which `assess` treats as unreadable rather
 * than as a passing grade. A missing signal is not a good one.
 */
export function recognitionOf(
  signals: unknown,
  tier: string | null,
): 'high' | 'medium' | 'low' | null {
  if (tier === 'unreadable') return 'low';
  const bag = signals as { recognition_confidence?: unknown; recognition?: unknown } | null;
  // `recognition_confidence` is the durable key. `recognition` is read only as
  // a fallback for rows written before it existed, and only when it still
  // holds a grade — by the time reconciliation has run once it holds a
  // boolean instead, which is not a grade and must not be read as one.
  const recorded = bag?.recognition_confidence ?? bag?.recognition;
  return recorded === 'high' || recorded === 'medium' || recorded === 'low' ? recorded : null;
}

export function assess(input: SignalInput): { tier: ConfidenceTier; signals: Signals } {
  const boundarySound = input.boundarySound ?? true;
  const signals: Signals = {
    // 'medium' passes. A pass here is not a claim the reading is right — it is a
    // claim that nothing about the recognition itself was alarming, and the
    // other three signals are what turn that into confidence.
    recognition: input.recognition === 'high' || input.recognition === 'medium',
    structural: input.numberingSound && boundarySound,
    arithmetic: input.arithmeticSound,
    plausibility: plausible(input.awarded, input.available),
    structure_numbering: input.numberingSound,
    structure_boundary: boundarySound,
  };

  if (input.unreadable || input.recognition === null) {
    return { tier: 'unreadable', signals };
  }
  // Recognition failing outright means we do not have a reading, only a guess at
  // one. That is an unreadable field with extra steps, and it stays out of
  // analytics entirely until the student resolves it.
  if (input.recognition === 'low') return { tier: 'unsure', signals };

  return { tier: tierFrom(signals, { layerFallback: input.layerFallback }), signals };
}

/**
 * The tier a set of already-computed signals produces.
 *
 * Split out of `assess` so a later stage can revisit a verdict without
 * re-deriving the readings behind it. Adjudication is the case that needs it:
 * it runs after reconciliation, and it is the only stage that can say which
 * questions a failed total actually implicates. It flips `arithmetic` on the
 * ones it cleared and asks this function what that now means, rather than
 * carrying a second copy of the rule.
 *
 * `unreadable` is not an argument. A region that could not be read is not
 * eligible for revision by a stage that never looked at it, so callers skip it.
 */
export function tierFrom(
  signals: Signals,
  opts: { layerFallback: boolean },
): ConfidenceTier {
  // Named explicitly rather than Object.values(...).every(Boolean): the
  // interface also carries decomposed sub-signals for review, and a
  // diagnostic field added later must not silently become a gate on whether
  // a question reaches analytics.
  const allPass = signals.recognition && signals.structural &&
    signals.arithmetic && signals.plausibility;
  return allPass && !opts.layerFallback ? 'confident' : 'unsure';
}

/**
 * Is this mark a mark a teacher would plausibly have written?
 *
 * Awarded within available, and on the half-mark grid CBSE actually uses.
 * A 3.7 out of 5 is not a mark; it is a misread 3 or 4, and saying so here is
 * cheaper than finding out from a student.
 */
function plausible(awarded: number | null, available: number | null): boolean {
  if (awarded === null || available === null) return false;
  if (awarded < 0 || available <= 0 || awarded > available) return false;
  if (available > 30) return false; // no single CBSE question is worth more
  return Math.abs(awarded * 2 - Math.round(awarded * 2)) < 1e-6;
}

/**
 * Does the question numbering hold together across the whole paper?
 *
 * Numbering is monotonic within a paper, which makes gaps detectable. A sequence
 * reading 1, 2, 4 means either the student skipped question 3 or the extractor
 * missed it — different things, which must be disambiguated by the student
 * rather than assumed by us. Every region around a gap loses this signal.
 */
export function numberingSoundness(labels: (string | null)[]): boolean[] {
  const numeric = labels.map(mainNumber);
  return labels.map((label, i) => {
    if (label === null) return false;
    const n = numeric[i];
    if (n === null) return true; // a part label like (a) carries no sequence claim
    const previous = lastNumberBefore(numeric, i);
    if (previous === null) return true;
    return n === previous || n === previous + 1;
  });
}

function mainNumber(label: string | null): number | null {
  if (!label) return null;
  const m = label.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function lastNumberBefore(numeric: (number | null)[], i: number): number | null {
  for (let j = i - 1; j >= 0; j--) if (numeric[j] !== null) return numeric[j];
  return null;
}
