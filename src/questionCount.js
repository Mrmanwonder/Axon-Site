// AXO-122 counting contract, mirrored from the SQL function
// public.question_count_contract (supabase/migrations/20261001140906_*). The
// two are held together by tests/fixtures/question-count-contract.json, which
// both test suites read. Read-side only: stored labels are never rewritten.
//
//   questions_total   distinct top-level question numbers
//   parts_total       reviewable regions (labeled, or unlabeled with evidence)
//   unassigned_parts  parts whose parent question cannot be determined
//   raw_region_count  every region row

/** Mirrors public.parse_question_label. Returns { q, part }; either may be null. */
export function parseQuestionLabel(label) {
  const s = String(label ?? '').trim().toLowerCase();
  if (!s) return { q: null, part: null };

  let m = s.match(/^\(\s*([ivx]+)\s*\)$|^([ivx]{2,})[.)]?$/);
  if (m) return { q: null, part: `(${m[1] ?? m[2]})` };

  m = s.match(/^\(?\s*(?:(\d{1,4})\s*[.)]?\s*)?\(?\s*([a-z])\s*\)?\s*(?:[.)]?\s*\(?\s*([ivx]+)\s*\)?)?\s*$/);
  if (m) return { q: m[1] ? Number(m[1]) : null, part: m[2] + (m[3] ? `(${m[3]})` : '') };

  m = s.match(/^\(?\s*(\d{1,4})\s*[.)]?\s*$/);
  if (m) return { q: Number(m[1]), part: null };

  return { q: null, part: null };
}

const byReadingOrder = (a, b) => {
  const nullsLast = (x, y) => (x == null ? (y == null ? 0 : 1) : y == null ? -1 : x - y);
  return nullsLast(a.page, b.page) || nullsLast(a.y, b.y) || (a.order_index ?? 0) - (b.order_index ?? 0);
};

/**
 * The one walk over a paper's regions, in reading order. countQuestions and every screen that
 * groups parts under questions read this, so there is no second placement rule to drift.
 *
 * Each entry says where a region landed:
 *   q          top-level question number it belongs to, or null when none can be determined
 *   part       parsed part tail ("a", "a(ii)") or null
 *   counted    false only for an unlabeled region with no evidence (a structural region)
 *   unassigned true when it is a part but no parent question is known
 *   inferred   true when a bare part took its parent from reading order, not from its own label
 *
 * @param {Array<{order_index?: number, label: string|null, page: number|null, y: number|null, evidence: boolean}>} regions
 */
export function placeRegions(regions) {
  const used = new Set();
  let prevQ = null;
  let prevPage = null;
  const placed = [];

  for (const region of [...regions].sort(byReadingOrder)) {
    const { q, part } = parseQuestionLabel(region.label);
    const page = region.page ?? null;
    const entry = { region, q: null, part, counted: true, unassigned: false, inferred: false };

    if (q === null && part === null) {
      entry.counted = !!region.evidence;
      entry.unassigned = !!region.evidence;
      prevQ = null;
      prevPage = null;
    } else if (q !== null) {
      entry.q = q;
      if (part !== null) used.add(`${q}:${part}`);
      prevQ = q;
      prevPage = page;
    } else if (prevQ !== null && prevPage !== null && page !== null
        && page - prevPage >= 0 && page - prevPage <= 1
        && !used.has(`${prevQ}:${part}`)) {
      used.add(`${prevQ}:${part}`);
      entry.q = prevQ;
      entry.inferred = true;
      prevPage = page;
    } else {
      entry.unassigned = true;
      prevQ = null;
      prevPage = null;
    }
    placed.push(entry);
  }
  return placed;
}

/**
 * @param {Array<{order_index?: number, label: string|null, page: number|null, y: number|null, evidence: boolean}>} regions
 *   evidence is true when the region carries a mark, an answer or question text.
 */
export function countQuestions(regions) {
  const tops = new Set();
  let parts = 0;
  let unassigned = 0;
  for (const e of placeRegions(regions)) {
    if (!e.counted) continue;
    parts += 1;
    if (e.unassigned) unassigned += 1;
    if (e.q !== null) tops.add(e.q);
  }
  return {
    questions_total: tops.size,
    parts_total: parts,
    unassigned_parts: unassigned,
    raw_region_count: regions.length,
  };
}
