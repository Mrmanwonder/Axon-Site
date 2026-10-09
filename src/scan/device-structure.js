/**
 * Conservative, local *visual* content-band proposals.
 *
 * This is not OCR and cannot name questions or associate marks with answers.
 * It only identifies substantial vertical whitespace between ink-bearing rows
 * of an already-conditioned page. Every proposal spans the full page width
 * so that marginal scores, coloured teacher marks and working survive.
 *
 * Proposals are advisory, untrusted metadata. The server must validate them
 * against the stored page and must preserve a full-page fallback before any
 * proposed crop can replace existing model evidence.
 */
export const DEVICE_STRUCTURE_VERSION = 1;

const MAX_PIXELS = 16_000_000;
const MAX_BANDS = 8;
// Deliberately permissive pencil threshold. A noisy/shadowed photograph then
// tends to fall back to the full page instead of silently excluding faint ink.
const INK_LUMA_CEILING = 242;
const TEACHER_MASK_FLOOR = 24;
const MIN_REMOVABLE_SHARE = 0.17;

/**
 * @param {{data: Uint8Array|Uint8ClampedArray, width: number, height: number}} image
 * @param {{data: Uint8Array|Uint8ClampedArray, width: number, height: number}} teacherMask
 */
export function proposeDeviceStructure(image, teacherMask) {
  const width = image?.width, height = image?.height;
  const base = {
    version: DEVICE_STRUCTURE_VERSION,
    coordinate_space: 'conditioned_page_pixels',
    width: Number.isSafeInteger(width) ? width : null,
    height: Number.isSafeInteger(height) ? height : null,
    status: 'fallback',
    bands: [],
  };
  const fallback = reason => ({ ...base, reason });

  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 32 || height < 64 || width * height > MAX_PIXELS ||
      image?.data?.length !== width * height * 4) {
    return fallback('invalid_page');
  }
  if (!teacherMask || teacherMask.width !== width ||
      teacherMask.height !== height || teacherMask.data?.length !== width * height) {
    return fallback('missing_teacher_mask');
  }

  // One scan of already-decoded pixels; no second bitmap, model, wasm download,
  // canvas, network request or main-thread copy. An isolated stroke anywhere
  // on a row counts as ink, even if it is only a tiny marginal number.
  const active = new Uint8Array(height);
  let inkRows = 0;
  const data = image.data, teacher = teacherMask.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      // Match actual RGBA alpha without assuming the paper is opaque.
      const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      if (luma <= INK_LUMA_CEILING || teacher[p] >= TEACHER_MASK_FLOOR) {
        active[y] = 1;
        inkRows++;
        break;
      }
    }
  }

  if (!inkRows) return fallback('no_detectable_ink');
  if (inkRows / height >= 0.91) return fallback('no_safe_whitespace');

  // Split only on wide, completely empty horizontal gaps. The deliberately
  // generous padding is measured against PAGE height, not text-line height.
  const minGap = Math.max(20, Math.ceil(height * 0.035));
  const pad = Math.max(12, Math.ceil(height * 0.025));
  const groups = [];
  let first = -1, last = -1, previous = -1;

  for (let y = 0; y < height; y++) {
    if (!active[y]) continue;
    if (first < 0) first = y;
    else if (y - previous - 1 >= minGap) {
      groups.push([first, last + 1]);
      first = y;
    }
    last = previous = y;
  }
  if (first >= 0) groups.push([first, last + 1]);

  if (!groups.length || groups.length > MAX_BANDS) return fallback('fragmented_layout');
  const bands = [];
  for (const [a, b] of groups) {
    const y = Math.max(0, a - pad);
    const bottom = Math.min(height, b + pad);
    if (bands.length && y <= bands[bands.length - 1].y + bands[bands.length - 1].h) {
      const prior = bands[bands.length - 1];
      prior.h = Math.max(prior.y + prior.h, bottom) - prior.y;
    } else {
      bands.push({ x: 0, y, w: width, h: bottom - y });
    }
  }
  if (bands.length > MAX_BANDS) return fallback('fragmented_layout');

  // Verify *all observed ink rows* survive the proposed band union. This is
  // not a claim that every pale glyph was recognized; a shadowy/ambiguous page
  // still requires the server's quality gate and full-page fallback.
  let covered = 0;
  for (let y = 0; y < height; y++) {
    if (!active[y]) continue;
    if (bands.some(b => y >= b.y && y < b.y + b.h)) covered++;
  }
  if (covered !== inkRows) return fallback('ink_outside_bands');

  const keptRows = bands.reduce((sum, band) => sum + band.h, 0);
  const removable = (height - keptRows) / height;
  if (removable < MIN_REMOVABLE_SHARE) return fallback('insufficient_whitespace');

  return {
    ...base,
    status: 'candidate',
    reason: null,
    bands,
    observed_ink_rows: inkRows,
    covered_ink_rows: covered,
    removable_height_share: Math.round(removable * 1000) / 1000,
  };
}
