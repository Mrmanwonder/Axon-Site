/* ═══════════════════════════════════════════════════════════════════════════
   SMALL-SAMPLE STATISTICS FOR INSIGHTS

   Insights run on one student's papers: a handful of papers, a few dozen
   questions. At that size the honest question about every number is "could
   this be noise?". The helpers here answer it the same way everywhere, so no
   module invents its own threshold. They are deterministic, need no model
   and no network, and run the same in the browser and in tests.

   Sources (full notes in docs/claude_insights-accuracy-audit-2026-10-13.md):

   · Measurement error of one paper. Ofqual's reliability programme (Bramley
     and Dhawan 2010, "Estimates of reliability of qualifications") reports
     287 GCSE and A Level units: mean Cronbach's alpha 0.81, and a standard
     error of measurement (SEM) of 3.1 to 5.0 raw marks (interquartile range),
     about 5.5 marks for A Level units. Across their examples the SEM grows
     close to √(maximum mark): about 0.52·√60 for 60-mark units and about
     0.59·√200 for 200-mark composites. So a paper's share of marks carries
     noise of about 0.55 / √(maximum) even if nothing about the student
     changed: 7% on a 60-mark paper and 12% on a 20-mark class test. Two
     papers differ by more than that again, because papers differ in
     difficulty.
   · Proportions from few trials. Brown, Cai and DasGupta (2001, Statistical
     Science 16(2)) recommend the Wilson interval over the textbook one for
     small n.
   · Many small rates side by side (topics, command words). Empirical Bayes
     shrinkage of beta-binomial rates (Efron and Morris 1975) pulls each rate
     toward the student's own overall rate in proportion to how little
     evidence it has. A 1-mark question can no longer make a topic look like
     the student's worst, and a topic with 30 marks of evidence barely moves.
   ═══════════════════════════════════════════════════════════════════════════ */

/** z for a two-sided 95% interval. */
export const Z95 = 1.96;

/**
 * Standard error of one paper's share of marks from measurement alone
 * (see the header). It never goes to zero: one paper is never exact.
 */
export function shareSem(maxMarks: number): number {
  const m = Math.max(1, maxMarks);
  return Math.min(0.25, 0.55 / Math.sqrt(m));
}

/** Wilson score interval for k successes out of n. Null when n is 0. */
export function wilson(k: number, n: number, z = Z95): { lo: number; hi: number } | null {
  if (!(n > 0)) return null;
  const p = Math.min(1, Math.max(0, k / n));
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/** Default prior strength, in marks, when there is too little to estimate one. */
export const DEFAULT_PRIOR_MARKS = 10;

/**
 * Prior strength for beta-binomial shrinkage, by the method of moments over
 * groups (topics, command words, …) of one student. Returns the number of
 * pseudo-marks the student's overall rate is worth inside each group.
 *
 * With fewer than five usable groups the estimate is unstable, so the default
 * is used. The result is clamped to [4, 60]: never so weak that one question
 * decides a group, never so strong that real differences vanish.
 */
export function priorStrength(groups: { lost: number; available: number }[]): number {
  const usable = groups.filter((g) => g.available >= 2);
  if (usable.length < 5) return DEFAULT_PRIOR_MARKS;
  const total = usable.reduce((n, g) => n + g.available, 0);
  const p = usable.reduce((n, g) => n + g.lost, 0) / total;
  if (p <= 0 || p >= 1) return DEFAULT_PRIOR_MARKS;
  // Observed between-group variance of rates, weighted by exposure, minus
  // the binomial variance each group would show with no real difference.
  let between = 0; let expected = 0;
  for (const g of usable) {
    const r = g.lost / g.available;
    between += g.available * (r - p) ** 2;
    expected += p * (1 - p);
  }
  between /= total; expected /= total;
  const excess = between - expected;
  // No real spread beyond noise: shrink hard.
  if (excess <= 0) return 60;
  // Var(rate) = p(1-p)/(k+1) for a beta prior of strength k.
  const k = (p * (1 - p)) / excess - 1;
  return Math.min(60, Math.max(4, k));
}

/** A group's lost share pulled toward the prior share by `strength` pseudo-marks. */
export function shrunkShare(lost: number, available: number, priorShare: number, strength: number): number {
  if (!(available + strength > 0)) return priorShare;
  return (lost + strength * priorShare) / (available + strength);
}

/** Mean and unbiased variance. Variance is null with fewer than two values. */
export function meanVar(xs: number[]): { mean: number; variance: number | null } {
  const n = xs.length;
  const mean = n ? xs.reduce((a, b) => a + b, 0) / n : 0;
  if (n < 2) return { mean, variance: null };
  return { mean, variance: xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) };
}

/**
 * Is the change between an earlier and a later set of paper shares bigger
 * than noise? Each side's variance is the larger of what the papers actually
 * show and what measurement error alone would give (`floors`, one SEM² per
 * paper), so two papers that happen to agree never look certain.
 */
export function shareChange(
  earlier: { share: number; max: number }[],
  later: { share: number; max: number }[],
): { diff: number; se: number; direction: "fewer" | "more" | "similar" } | null {
  if (earlier.length < 2 || later.length < 2) return null;
  const side = (xs: { share: number; max: number }[]) => {
    const { mean, variance } = meanVar(xs.map((x) => x.share));
    const floor = xs.reduce((s, x) => s + shareSem(x.max) ** 2, 0) / xs.length;
    return { mean, v: Math.max(variance ?? 0, floor), n: xs.length };
  };
  const a = side(earlier); const b = side(later);
  const diff = b.mean - a.mean;
  const se = Math.sqrt(a.v / a.n + b.v / b.n);
  // Named only when it clears both the noise and a practical floor of five
  // points; smaller movements are not worth a sentence even when real.
  const real = Math.abs(diff) >= Z95 * se && Math.abs(diff) >= 0.05;
  return { diff, se, direction: !real ? "similar" : diff < 0 ? "fewer" : "more" };
}

/**
 * Two-proportion z-test (pooled). Returns the signed z of p2 − p1, or null
 * when either side is empty. Used where items are roughly independent
 * (questions across many papers), never for marks inside one question.
 */
export function twoProportionZ(k1: number, n1: number, k2: number, n2: number): number | null {
  if (!(n1 > 0 && n2 > 0)) return null;
  const p = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!(se > 0)) return 0;
  return (k2 / n2 - k1 / n1) / se;
}

/**
 * Sign agreement across papers: of the papers where both sides were seen,
 * in how many was side A worse than side B. A claim about a kind of question
 * must hold paper by paper, not only in the pooled total, because questions
 * on one paper share its difficulty and the student's day.
 */
export function pairedPapers(rows: { a: number; b: number }[]): { worse: number; better: number; papers: number } {
  let worse = 0; let better = 0;
  for (const r of rows) { if (r.a > r.b) worse += 1; else if (r.a < r.b) better += 1; }
  return { worse, better, papers: rows.length };
}
