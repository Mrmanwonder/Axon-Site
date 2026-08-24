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
}

export interface SignalInput {
  recognition: 'high' | 'medium' | 'low' | null;
  /** This region's number is present and continues the paper's sequence. */
  numberingSound: boolean;
  /** The paper's arithmetic closed. */
  paperReconciled: boolean;
  awarded: number | null;
  available: number | null;
  /** The page broke the colour assumption, so everything on it drops a tier. */
  layerFallback: boolean;
  /** Nothing readable at all, or a value that arrived with no box. */
  unreadable: boolean;
}

export function assess(input: SignalInput): { tier: ConfidenceTier; signals: Signals } {
  const signals: Signals = {
    // 'medium' passes. A pass here is not a claim the reading is right — it is a
    // claim that nothing about the recognition itself was alarming, and the
    // other three signals are what turn that into confidence.
    recognition: input.recognition === 'high' || input.recognition === 'medium',
    structural: input.numberingSound,
    arithmetic: input.paperReconciled,
    plausibility: plausible(input.awarded, input.available),
  };

  if (input.unreadable || input.recognition === null) {
    return { tier: 'unreadable', signals };
  }
  // Recognition failing outright means we do not have a reading, only a guess at
  // one. That is an unreadable field with extra steps, and it stays out of
  // analytics entirely until the student resolves it.
  if (input.recognition === 'low') return { tier: 'unsure', signals };

  const allPass = Object.values(signals).every(Boolean);
  if (allPass && !input.layerFallback) return { tier: 'confident', signals };
  return { tier: 'unsure', signals };
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
