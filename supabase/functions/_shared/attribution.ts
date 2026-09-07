// Stage 5 · mark attribution.
//
// Joining the device's map of teacher marks to the question regions the
// structure pass found. No model runs here — stage 2 already located every red
// mark on the page and measured its shape, and stage 3 knows where the questions
// are, so this is geometry.
//
// This is where the product's central claim is either true or false. Everything
// Axon says it knows follows from each teacher mark being bound to the answer
// it refers to, and that answer to its question.

import type { MarkClass, MarkShape, TeacherMarkInput } from './contract.ts';

export interface RegionSpan { page: number; box: { x: number; y: number; w: number; h: number } }

export interface Region {
  order_index: number;
  label: string | null;
  spans: RegionSpan[];
}

export interface AttributedMark {
  page_number: number;
  box: { x: number; y: number; w: number; h: number };
  shape: MarkShape;
  mark_class: MarkClass;
  value: number | null;
  region_index: number | null;
  /**
   * How the binding above was arrived at, kept beside it rather than folded
   * into it. A mark bound at 0.41 because it was the nearest thing on the page
   * and one bound at 0.95 because it sits inside the question are both
   * `region_index: 4`, and review needs to be able to tell them apart.
   */
  attribution: Attribution;
  metrics: Record<string, unknown>;
}

const centre = (b: { x: number; y: number; w: number; h: number }) =>
  ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/**
 * Name what a mark is, from its measured shape and where it sits.
 *
 * The device reports geometry — this component encloses background, that one is
 * two strokes meeting. Only here, with the margin band and the question regions
 * known, does geometry become meaning.
 *
 * Underline and strikethrough are deliberately not separated. Telling them apart
 * needs the text-line geometry the device does not compute, and to the
 * explanation stage they say the same thing: the teacher pointed at this span.
 * Guessing between them would add a distinction nothing downstream can use and
 * the review screen would have to show.
 */
export function classifyMark(
  mark: TeacherMarkInput,
  inMarginBand: boolean,
): MarkClass {
  const q = (mark.metrics?.quadrants as number[] | undefined) ?? [0, 0, 0, 0];

  switch (mark.shape) {
    case 'glyph':
      // A digit in the margin is the awarded mark. The same digit written among
      // the answer is far more likely to be part of a correction than a score,
      // so position decides and the ambiguity is not resolved by hope.
      return inMarginBand ? 'marginal_number' : 'unknown';
    case 'crossing':
      if (q.every((v) => v >= 0.15)) return 'cross';
      // A tick leaves its top-left corner comparatively empty; a cross reaches
      // all four. Where neither holds, the honest answer is that we do not know.
      if (q[0] < 0.10) return 'tick';
      return 'unknown';
    case 'enclosure':
      return 'circle';
    case 'stroke':
      return 'underline';
    default:
      return 'unknown';
  }
}

/**
 * Group loose glyphs into the teacher's handwritten comment.
 *
 * A remark is a row of small components with ordinary word spacing, away from
 * the margin band. Individually they classify as nothing; together they are the
 * most valuable thing on the page, because they are the teacher saying what went
 * wrong in their own words.
 */
export function groupComments(marks: TeacherMarkInput[], pageWidth: number): TeacherMarkInput[][] {
  const candidates = marks.filter((m) => m.shape === 'glyph' || m.shape === 'unknown');
  const groups: TeacherMarkInput[][] = [];
  const used = new Set<TeacherMarkInput>();

  for (const seed of candidates) {
    if (used.has(seed)) continue;
    const rowHeight = Math.max(seed.box.h, 8);
    const row = candidates.filter((m) =>
      !used.has(m) &&
      m.page === seed.page &&
      Math.abs(centre(m.box).y - centre(seed.box).y) < rowHeight * 0.8);

    if (row.length < 4) continue;
    row.sort((a, b) => a.box.x - b.box.x);

    // A row is a comment only if the pieces sit close enough to be words rather
    // than three unrelated marks that happen to share a line.
    const gaps = row.slice(1).map((m, i) => m.box.x - (row[i].box.x + row[i].box.w));
    const median = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    if (median > rowHeight * 2.5) continue;
    if ((row[row.length - 1].box.x + row[row.length - 1].box.w - row[0].box.x) < pageWidth * 0.08) continue;

    row.forEach((m) => used.add(m));
    groups.push(row);
  }
  return groups;
}

/** What binding a mark to a question is actually claiming, and how strongly. */
export interface Attribution {
  /** null means unattributed, which is a result and not a failure. */
  region_index: number | null;
  confidence: number;
  /** Which relations produced this, for the review screen and for debugging. */
  method: string[];
  /** Runners-up worth keeping, best first. Populated when the choice was close. */
  alternatives: { region_index: number; confidence: number }[];
  /** Two or more candidates were too close to separate; nothing was bound. */
  ambiguous: boolean;
}

// Below this, a mark is not near enough to any question to say it belongs to
// one. Expressed in multiples of the median region height on the page rather
// than in pixels, so it scales with the document instead of assuming a
// resolution: a mark a whole question-height clear of every question is a mark
// about nothing we can name.
const MAX_GAP_IN_REGION_HEIGHTS = 1.0;
// Two candidates closer together than this are a coin toss, and a coin toss
// that lands on the wrong question is the most expensive error this system
// makes (§134). Neither wins.
const AMBIGUITY_MARGIN = 0.12;
// A candidate has to be at least this convincing to be bound at all.
const MIN_CONFIDENCE = 0.35;

const UNATTRIBUTED: Attribution = {
  region_index: null, confidence: 0, method: [], alternatives: [], ambiguous: false,
};

/**
 * Which region does this mark belong to — or none of them?
 *
 * Two rules changed here, and both were cases of the code being more certain
 * than the page warranted.
 *
 * **It considered one span per region.** `spans.find(s => s.page === page)`
 * takes the first span on the page and ignores the rest, so a question split
 * around a diagram, or with two answer boxes, was matched on its first piece
 * only — a mark sitting squarely inside the second piece scored as "outside
 * every box" and fell through to the distance rule below. Every span on the
 * page is a candidate now.
 *
 * **It always returned something.** The distance rule had no ceiling, so the
 * nearest question won however far away it was: a mark at the foot of the page
 * bound to the last question on it, always, with no way for the result to say
 * that nothing on this page plausibly owns this mark. That is the failure the
 * spec calls catastrophic, because the OCR is right and the paper is still
 * wrong, and it is silent — a mark bound to the wrong question looks exactly
 * like a mark bound to the right one. Unattributed is now a real outcome, and
 * so is ambiguous.
 */
export function assignToRegion(
  mark: { page: number; box: { x: number; y: number; w: number; h: number } },
  regions: Region[],
): Attribution {
  const c = centre(mark.box);
  // Every span on this page, not the first one per region.
  const onPage: { index: number; span: RegionSpan }[] = [];
  regions.forEach((r, index) => {
    for (const span of r.spans) if (span.page === mark.page) onPage.push({ index, span });
  });
  if (!onPage.length) return UNATTRIBUTED;

  const inside = onPage.filter(({ span }) =>
    c.x >= span.box.x && c.x <= span.box.x + span.box.w &&
    c.y >= span.box.y && c.y <= span.box.y + span.box.h);

  if (inside.length) {
    // Nested or overlapping regions: the tightest one wins, because a region
    // that contains another is the outer question and the mark is on the part.
    // Containment is strong evidence, so this does not go to the ambiguity
    // test — but the others are still reported as alternatives.
    const ranked = [...inside]
      .sort((a, b) => (a.span.box.w * a.span.box.h) - (b.span.box.w * b.span.box.h));
    const chosen = ranked[0].index;
    return {
      region_index: chosen,
      confidence: ranked.length === 1 ? 0.95 : 0.8,
      method: ranked.length === 1 ? ['inside_span'] : ['inside_span', 'tightest_of_nested'],
      alternatives: dedupe(ranked.slice(1).map((r) => ({ region_index: r.index, confidence: 0.5 })), chosen),
      ambiguous: false,
    };
  }

  // Outside every box — the usual case for a margin mark. Distance is measured
  // to the band the region actually occupies rather than to its centre, so a
  // long region is not penalised for being long.
  const heights = onPage.map(({ span }) => span.box.h).filter((h) => h > 0).sort((a, b) => a - b);
  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  // With no usable height there is no scale to judge "near" against, and
  // guessing one would be the old behaviour wearing a threshold.
  if (!medianHeight) return UNATTRIBUTED;
  const reach = medianHeight * MAX_GAP_IN_REGION_HEIGHTS;

  const scored = onPage.map(({ index, span }) => {
    const top = span.box.y, bottom = span.box.y + span.box.h;
    const gap = c.y < top ? top - c.y : c.y > bottom ? c.y - bottom : 0;
    return { index, confidence: gap >= reach ? 0 : 1 - (gap / reach), overlaps: gap === 0 };
  }).sort((a, b) => b.confidence - a.confidence || a.index - b.index);

  // Several spans of the SAME region are not competing candidates — the best
  // of them is that region's score.
  const byRegion = new Map<number, { index: number; confidence: number; overlaps: boolean }>();
  for (const s of scored) if (!byRegion.has(s.index)) byRegion.set(s.index, s);
  const candidates = [...byRegion.values()].sort((a, b) => b.confidence - a.confidence || a.index - b.index);

  const best = candidates[0];
  if (!best || best.confidence < MIN_CONFIDENCE) return UNATTRIBUTED;

  const runnerUp = candidates[1];
  const alternatives = candidates.slice(1)
    .filter((c2) => c2.confidence > 0)
    .map((c2) => ({ region_index: c2.index, confidence: round2(c2.confidence) }));

  if (runnerUp && best.confidence - runnerUp.confidence < AMBIGUITY_MARGIN) {
    // Two questions equally close. The old code took the lower index; the
    // honest answer is that the page does not say, and review can.
    return {
      region_index: null,
      confidence: round2(best.confidence),
      method: ['ambiguous_vertical_gap'],
      alternatives: [{ region_index: best.index, confidence: round2(best.confidence) }, ...alternatives],
      ambiguous: true,
    };
  }

  return {
    region_index: best.index,
    confidence: round2(best.confidence),
    method: best.overlaps ? ['vertical_overlap'] : ['nearest_vertical_gap'],
    alternatives,
    ambiguous: false,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const dedupe = (
  list: { region_index: number; confidence: number }[],
  exclude: number,
) => {
  const seen = new Set<number>([exclude]);
  return list.filter((a) => !seen.has(a.region_index) && seen.add(a.region_index));
};

/**
 * Stage 5 in one call: classify every mark, bind it to a region, and read the
 * awarded mark for each region off the marginal numbers.
 *
 * The numeric value of a marginal number is not read here — that is the content
 * pass's job, because it needs to actually recognise a digit. What this returns
 * is where each number is, so the content pass can be pointed at it and the
 * review screen can show the student the crop it came from.
 */
export function attribute(opts: {
  regions: Region[];
  marks: TeacherMarkInput[];
  marginBands: Map<number, { x0: number; x1: number } | null>;
  pageWidths: Map<number, number>;
}): AttributedMark[] {
  const { regions, marks, marginBands, pageWidths } = opts;
  const commentMembers = new Set<TeacherMarkInput>();
  const out: AttributedMark[] = [];

  for (const [page, width] of pageWidths) {
    const pageMarks = marks.filter((m) => m.page === page);
    for (const group of groupComments(pageMarks, width)) {
      group.forEach((m) => commentMembers.add(m));
      const x = Math.min(...group.map((m) => m.box.x));
      const y = Math.min(...group.map((m) => m.box.y));
      const box = {
        x, y,
        w: Math.max(...group.map((m) => m.box.x + m.box.w)) - x,
        h: Math.max(...group.map((m) => m.box.y + m.box.h)) - y,
      };
      const attribution = assignToRegion({ page, box }, regions);
      out.push({
        page_number: page,
        box,
        shape: 'unknown',
        mark_class: 'comment',
        value: null,
        region_index: attribution.region_index,
        attribution,
        metrics: {
          grouped_from: group.length,
          // §37: aggregation may not destroy the evidence it aggregated. The
          // pieces are what a reviewer needs to see when the grouping is wrong.
          component_boxes: group.map((m) => m.box),
        },
      });
    }
  }

  for (const mark of marks) {
    if (commentMembers.has(mark)) continue;
    const band = marginBands.get(mark.page) ?? null;
    const c = centre(mark.box);
    const inBand = !!band && c.x >= band.x0 && c.x <= band.x1;
    const attribution = assignToRegion(mark, regions);
    out.push({
      page_number: mark.page,
      box: mark.box,
      shape: mark.shape,
      mark_class: classifyMark(mark, inBand),
      value: null,
      region_index: attribution.region_index,
      attribution,
      metrics: { ...mark.metrics, in_margin_band: inBand },
    });
  }

  return out;
}
