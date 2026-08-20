// Stage 5 · mark attribution.
//
// Joining the device's map of teacher marks to the question regions the
// structure pass found. No model runs here — stage 2 already located every red
// mark on the page and measured its shape, and stage 3 knows where the questions
// are, so this is geometry.
//
// This is where the product's central claim is either true or false. Everything
// Mastery says it knows follows from each teacher mark being bound to the answer
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

/**
 * Which region does this mark belong to?
 *
 * A mark inside a region's box belongs to it, plainly. A mark in the margin band
 * belongs to whichever region it sits alongside — which is why finding the band
 * is worth a pass of its own: it turns a two-dimensional search across the page
 * into a one-dimensional one down it. Ties go to reading order.
 */
export function assignToRegion(
  mark: { page: number; box: { x: number; y: number; w: number; h: number } },
  regions: Region[],
): number | null {
  const c = centre(mark.box);
  const onPage = regions
    .map((r, i) => ({ index: i, span: r.spans.find((s) => s.page === mark.page) }))
    .filter((r): r is { index: number; span: RegionSpan } => !!r.span);
  if (!onPage.length) return null;

  const inside = onPage.filter(({ span }) =>
    c.x >= span.box.x && c.x <= span.box.x + span.box.w &&
    c.y >= span.box.y && c.y <= span.box.y + span.box.h);
  if (inside.length === 1) return inside[0].index;
  if (inside.length > 1) {
    // Nested or overlapping regions: the tightest one wins, because a region
    // that contains another is the outer question and the mark is on the part.
    inside.sort((a, b) => (a.span.box.w * a.span.box.h) - (b.span.box.w * b.span.box.h));
    return inside[0].index;
  }

  // Outside every box — the usual case for a margin mark. Nearest vertical span,
  // measured to the band the region actually occupies rather than to its centre,
  // so a long region is not penalised for being long.
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const { index, span } of onPage) {
    const top = span.box.y, bottom = span.box.y + span.box.h;
    const distance = c.y < top ? top - c.y : c.y > bottom ? c.y - bottom : 0;
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  }
  return best;
}

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
      out.push({
        page_number: page,
        box,
        shape: 'unknown',
        mark_class: 'comment',
        value: null,
        region_index: assignToRegion({ page, box }, regions),
        metrics: { grouped_from: group.length },
      });
    }
  }

  for (const mark of marks) {
    if (commentMembers.has(mark)) continue;
    const band = marginBands.get(mark.page) ?? null;
    const c = centre(mark.box);
    const inBand = !!band && c.x >= band.x0 && c.x <= band.x1;
    out.push({
      page_number: mark.page,
      box: mark.box,
      shape: mark.shape,
      mark_class: classifyMark(mark, inBand),
      value: null,
      region_index: assignToRegion(mark, regions),
      metrics: { ...mark.metrics, in_margin_band: inBand },
    });
  }

  return out;
}
