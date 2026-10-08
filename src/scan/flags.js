// Why a part asks the student to look (AXO-216, council D1, 7 Oct 2026).
//
// Read from what was measured, never inferred. The order follows the council's
// ask-rule: unreadable or low recognition, then a missing or impossible mark,
// then a part that could not be placed. When nothing specific was recorded this
// returns null and the screen claims no cause (Axon.md section 7: never state a
// reason that was not measured). Shared by review and the saved paper.

const num = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * @param {{ confidence_tier?: string, confidence_signals?: Record<string, unknown> | null,
 *           marks_awarded?: number | string | null, marks_available?: number | string | null }} region
 * @param {{ unplaced?: boolean }} [opts]
 * @returns {string | null}
 */
export function flagReason(region, opts = {}) {
  const signals = region.confidence_signals ?? {};
  if (region.confidence_tier === 'unreadable') {
    return typeof signals.unreadable_reason === 'string' && signals.unreadable_reason
      ? signals.unreadable_reason
      : 'Axon could not read this part.';
  }
  if (signals.recognition === false || signals.recognition_confidence === 'low') {
    return 'The writing here was hard to read.';
  }
  const awarded = num(region.marks_awarded);
  const available = num(region.marks_available);
  if (awarded === null && available === null) return "Neither the teacher's mark nor what the part is worth was found.";
  if (awarded === null) return "The teacher's mark was not found.";
  if (available === null) return 'How many marks this part is worth was not found.';
  if (awarded > available) return 'The mark read is more than this part is worth.';
  if (opts.unplaced) return 'Axon could not tell which question this part belongs to.';
  return null;
}
