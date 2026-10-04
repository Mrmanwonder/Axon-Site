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
 * @param {Array<{order_index?: number, label: string|null, page: number|null, y: number|null, evidence: boolean}>} regions
 *   evidence is true when the region carries a mark, an answer or question text.
 */
export function projectQuestionRegions(regions) {
  const tops = new Set();
  const used = new Set();
  let prevQ = null;
  let prevPage = null;
  let parts = 0;
  let unassigned = 0;
  const entries = [];

  for (const region of [...regions].sort(byReadingOrder)) {
    const { q, part } = parseQuestionLabel(region.label);
    const page = region.page ?? null;
    let question = q;
    let inherited = false;
    const counted = q !== null || part !== null || !!region.evidence;

    if (q === null && part === null) {
      if (region.evidence) { parts += 1; unassigned += 1; }
      prevQ = null;
      prevPage = null;
    } else if (q !== null) {
      tops.add(q);
      parts += 1;
      if (part !== null) used.add(`${q}:${part}`);
      prevQ = q;
      prevPage = page;
    } else {
      parts += 1;
      if (prevQ !== null && prevPage !== null && page !== null
          && page - prevPage >= 0 && page - prevPage <= 1
          && !used.has(`${prevQ}:${part}`)) {
        used.add(`${prevQ}:${part}`);
        question = prevQ;
        inherited = true;
        prevPage = page;
      } else {
        unassigned += 1;
        prevQ = null;
        prevPage = null;
      }
    }
    entries.push({ region, question, part, inherited, counted });
  }

  return {
    entries,
    counts: {
      questions_total: tops.size,
      parts_total: parts,
      unassigned_parts: unassigned,
      raw_region_count: regions.length,
    },
  };
}

/** Count and reading/grouping surfaces consume the same assignment decision. */
export function countQuestions(regions) {
  return projectQuestionRegions(regions).counts;
}

/** Display only; takes the shared projection's assignment, never changes storage. */
export function questionDisplayPath(question, part) {
  const suffix = part ? (part.startsWith('(') ? part : `(${part[0]})${part.slice(1)}`) : '';
  return question == null ? `Unassigned part${suffix ? ` ${suffix}` : ''}` : `Question ${question}${suffix}`;
}
