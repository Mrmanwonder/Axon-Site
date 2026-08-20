// The pipeline contract: the names, thresholds and shapes every stage agrees on.
//
// SCANNING_SYSTEM.md specifies ten stages that run in three different places —
// the device, an edge function, and the student's own hands at review. They only
// compose if they agree on what a box is, what a confidence tier means, and what
// counts as glare. That agreement lives here, in one dependency-free module, so a
// threshold cannot be tuned on the device and left stale on the server.
//
// The server mirror is supabase/functions/_shared/contract.ts. It is a copy on
// purpose: the browser is served from dist/ and the edge functions from Deno, and
// there is no build step that could bridge them. Change both, or neither.

export const PIPELINE_VERSION = '1.0.0';

// ── the one red ────────────────────────────────────────────────────────────
// Red means the teacher's pen. That is a pipeline fact — stage 2 separates the
// layers by hue — and it is also the design rule that keeps red out of the
// interface. They are the same rule, so they get one name, and anyone who later
// reaches for red as an error colour collides with this constant first.
export const TEACHER_INK = 'red';

// ── stage 0 · capture ──────────────────────────────────────────────────────

export const CAPTURE = {
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'],
  MAX_PAGES: 25,
  // Auto-capture fires only when the quad has held still this long. Shorter and
  // it fires mid-adjustment; longer and it feels broken and people reach for the
  // shutter, which is fine but wastes the feature.
  STABILITY_MS: 600,
  // Corner travel, as a share of the frame's short edge, still counted as still.
  STABILITY_TOLERANCE: 0.012,
  // The page must fill this share of the viewport before auto-capture will fire.
  // Below it the page is too far away to hold 300 DPI after warping.
  MIN_FILL: 0.35,
};

// ── quality gate ───────────────────────────────────────────────────────────
// Scored at capture, while the paper is still physically in front of the
// student. Catching a bad page at review, once the booklet is back in a bag, is
// a materially worse experience and often means the page is simply lost.

export const QUALITY = {
  // Variance of the Laplacian, normalised to 0–1 against this ceiling. Below
  // BLUR_WARN the page is soft; below BLUR_FAIL thin red strokes are gone.
  BLUR_NORMALISER: 900,
  BLUR_WARN: 0.22,
  BLUR_FAIL: 0.10,
  // Specular highlight: bright and colourless. A washed-out red tick reads as no
  // tick at all, which is silent destruction of the one layer that matters most.
  GLARE_V: 0.94,
  GLARE_S: 0.12,
  GLARE_WARN: 0.010,
  GLARE_FAIL: 0.035,
  // Long edge in pixels, after warping. Below FAIL there is no way back to 300
  // DPI without inventing detail.
  RESOLUTION_WARN: 1600,
  RESOLUTION_FAIL: 1100,
};

export const PAGE_VERDICT = /** @type {const} */ (['ok', 'warn', 'fail']);

// ── stage 1 · conditioning ─────────────────────────────────────────────────

export const CONDITIONING = {
  TARGET_DPI: 300,
  // A4 long edge. Every CBSE answer booklet and question paper is A4, so the
  // physical assumption is safe and gives a real DPI rather than a pixel count
  // that means nothing without knowing the page size.
  PAGE_LONG_EDGE_INCHES: 11.69,
  // Bytes. Indian mobile data is the binding constraint on time-to-result far
  // more often than server compute is, so this is a hard target, not a hope.
  TARGET_BYTES: 400 * 1024,
  // Quality is searched downward until the page fits, and stopped here whether
  // it fits or not: past this point the red channel starts losing thin strokes,
  // and a page that uploads fast and has lost the marks is worthless.
  QUALITY_MAX: 0.86,
  QUALITY_MIN: 0.52,
  // Red-stroke retention, measured against the unconditioned page. Compression
  // that drops below this is rejected even if it hits the byte target — the
  // usual JPEG profile optimises for legible black text, which is the wrong
  // target here.
  RED_RETENTION_MIN: 0.92,
  // Illumination is flattened against a heavily blurred estimate of the page's
  // own lighting, computed at this width. Small enough to be cheap, large
  // enough to follow a real gradient from a single overhead tubelight.
  ILLUMINATION_PROXY_WIDTH: 64,
};

// ── stage 2 · layer separation ─────────────────────────────────────────────

export const RED = {
  // Hue in degrees, both ends of the wrap-around.
  HUE_LOW_MAX: 14,
  HUE_HIGH_MIN: 340,
  SATURATION_MIN: 0.34,
  VALUE_MIN: 0.22,
  // Ballpoint red on white under warm light often reads as low-saturation pink
  // to an HSV test but is unambiguous as a channel margin, so the two tests are
  // a union rather than an intersection.
  CHANNEL_MARGIN: 26,
  // Ink is anything meaningfully darker than the page.
  INK_LUMA_MAX: 165,
  // Components smaller than this are speckle, not marks.
  MIN_COMPONENT_PX: 12,
};

export const LAYER_FALLBACK = {
  // The teacher marked in green, black or pencil: the page clearly has content
  // and the red mask found essentially nothing. Common enough to matter.
  NON_RED_MARKING: 'non_red_marking',
  // The student wrote in red, which breaks the layer assumption completely.
  STUDENT_WROTE_RED: 'student_wrote_red',
  // Red share of ink below this, with real ink present, means nobody marked in red.
  RED_INK_SHARE_MIN: 0.002,
  // Above this, red is not marginalia — it is the body of the page.
  RED_INK_SHARE_MAX: 0.34,
};

// Structural shape of a teacher mark, as the device can tell it from geometry
// alone. This is deliberately not the same list as MARK_CLASS: the device knows
// a component encloses a hole, it does not know that means "circled deduction".
export const MARK_SHAPE = /** @type {const} */ ([
  'stroke',     // linear — an underline or a strikethrough
  'crossing',   // two strokes meeting — a cross, or a tick
  'enclosure',  // encloses background — a circle around something
  'glyph',      // compact, in the margin band — almost always a number
  'blob',       // dense and shapeless
  'unknown',    // measured, unclassifiable; never guessed
]);

// What the mark means once stage 5 has bound it to a question. Assigned
// server-side, from shape plus position plus what the content pass read.
export const MARK_CLASS = /** @type {const} */ ([
  'marginal_number',  // the awarded mark for the region. Highest weight.
  'tick',
  'half_tick',
  'cross',
  'strikethrough',
  'circle',           // an error indicator — retain its box, it points at the fault
  'underline',
  'comment',          // free text, transcribed verbatim, never paraphrased
  'unknown',
]);

// ── stage 4 · content ──────────────────────────────────────────────────────

export const REGION_TYPE = /** @type {const} */ (['prose', 'math', 'diagram', 'table', 'mcq', 'mixed']);

// ── stage 10 · confidence ──────────────────────────────────────────────────
// Not the model's token probability, which is overconfident on handwriting and
// correlates poorly with being right. Four independent signals, and the
// composite is meaningful precisely because they are independent: a field can be
// read cleanly and still be structurally suspect.

export const CONFIDENCE_SIGNALS = /** @type {const} */ ([
  'recognition',   // model-reported confidence on the field
  'structural',    // question numbering monotonic, no sequence gaps
  'arithmetic',    // whether this question's paper reconciled
  'plausibility',  // awarded <= available, mark within the type's normal range
]);

export const TIER = {
  CONFIDENT: 'confident',
  UNSURE: 'unsure',
  UNREADABLE: 'unreadable',
};

/**
 * Map a pipeline tier to the three-value `confidence` enum the database holds.
 *
 * SCANNING_SYSTEM.md §10 says an unsure field is "included in analytics but
 * tagged". CLAUDE.md hard rule 3 says unsure data never reaches analytics until
 * a student confirms it, and that rule is enforced by the analytics views rather
 * than by convention. The hard rule wins, and this mapping is where the two
 * documents are reconciled: an unsure field lands as `unsure`, which the views
 * exclude until `student_confirmed_at` is set at review.
 */
export function tierToConfidence(tier) {
  if (tier === TIER.CONFIDENT) return 'likely';
  return 'unsure';
}

/** Provenance is not optional. A field that cannot point at pixels does not exist. */
export function hasProvenance(field) {
  const b = field?.box;
  return !!b && Number.isFinite(b.x) && Number.isFinite(b.y) &&
    Number.isFinite(b.w) && Number.isFinite(b.h) && b.w > 0 && b.h > 0 &&
    Number.isInteger(b.page) && b.page > 0;
}
