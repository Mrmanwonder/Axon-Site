/**
 * Mark-grid arithmetic is provider-aware. The caller passes the assessment
 * rules resolved from the profile/paper identity; this module stays pure and
 * dependency-free so extraction math remains easy to test.
 */

export const DEFAULT_MARK_RULES = Object.freeze({ markStep: 1, maxPrecision: 0 });
/** @deprecated Use assessment rules per paper/profile. */
export const WHOLE_MARKS_ONLY = true;

function usableNumber(value, rules = DEFAULT_MARK_RULES) {
  const raw = Number(value);
  const step = Number(rules?.markStep) || 1;
  const precision = Number(rules?.maxPrecision) || 0;
  if (!Number.isFinite(raw)) return false;
  const scaled = raw / step;
  if (Math.abs(scaled - Math.round(scaled)) > 10 ** -(precision + 6)) return false;
  return Number(raw.toFixed(precision)) === raw;
}

export function allocationIsUsable(region, rules = DEFAULT_MARK_RULES) {
  if (region.marks_available === null || region.marks_available === undefined) return false;
  const raw = Number(region.marks_available);
  return raw > 0 && usableNumber(raw, rules);
}

export function markAlternatives(region, rules = DEFAULT_MARK_RULES) {
  if (!allocationIsUsable(region, rules)) return [];
  const available = Number(region.marks_available);
  const step = Number(rules?.markStep) || 1;
  const precision = Number(rules?.maxPrecision) || 0;

  const awardedRaw = region.marks_awarded === null || region.marks_awarded === undefined
    ? null
    : Number(region.marks_awarded);
  const awarded = awardedRaw !== null
    && usableNumber(awardedRaw, rules)
    && awardedRaw >= 0
    && awardedRaw <= available
      ? awardedRaw
      : null;

  const clean = (value) => Number(value.toFixed(precision));
  const candidates = new Set([0, clean(available)]);
  if (awarded !== null) {
    for (const offset of [-2, -1, 0, 1, 2]) {
      const value = clean(awarded + offset * step);
      if (value >= 0 && value <= available) candidates.add(value);
    }
  } else {
    const slots = Math.max(1, Math.ceil(available / step));
    const stride = Math.max(1, Math.ceil(slots / 6));
    for (let i = 0; i <= slots; i += stride) {
      const value = clean(i * step);
      if (value <= available) candidates.add(value);
    }
  }

  const sorted = [...candidates].sort((a, b) => a - b);
  while (sorted.length > 7) sorted.splice(Math.floor(sorted.length / 2), 1);
  return sorted;
}

export function markValueIsUsable(value, available = null, rules = DEFAULT_MARK_RULES) {
  const raw = Number(value);
  if (!usableNumber(raw, rules) || raw < 0) return false;
  return available === null || available === undefined || raw <= Number(available);
}
