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
  // Corner travel away from the pose the steady window began at, as a share of
  // the frame's short edge, still counted as still.
  //
  // This was 0.012 — about three pixels on the 240px search proxy — and measured
  // frame to frame rather than against an anchor. Between a hand-held phone and
  // a detector that fits lines afresh every search, the corners move further
  // than that essentially always, so the clock reset on every search and
  // auto-capture never fired once. Ten pixels around a fixed pose is what
  // holding a phone over a desk actually looks like.
  STABILITY_TOLERANCE: 0.04,
  // A page found and unblocked for this long fires even if it never satisfies
  // the stillness test. The gate assists; it does not get to refuse forever.
  PATIENCE_MS: 3500,
  // The page must fill this share of the viewport before auto-capture will fire.
  // Below it the page is too far away to hold 300 DPI after warping.
  MIN_FILL: 0.35,
  // Paused between "the gate said go" and the frame actually grabbed, on the
  // canvas-grab fallback path only. A live stream's autofocus is asynchronous;
  // grabbing with zero wait after a focus-affecting event (tap-to-focus, or
  // just arriving at "Ready") is grabbing mid-focus. `ImageCapture.takePhoto()`
  // does not need this — it reconfigures the camera hardware for the shot and
  // returns once that pass is done.
  SETTLE_MS: 200,
};

// ── quality gate ───────────────────────────────────────────────────────────
// Scored at capture, while the paper is still physically in front of the
// student. Catching a bad page at review, once the booklet is back in a bag, is
// a materially worse experience and often means the page is simply lost.

export const QUALITY = {
  // Variance of the Laplacian, normalised to 0–1 against this ceiling.
  BLUR_NORMALISER: 900,
  BLUR_WARN: 0.22,
  BLUR_FAIL: 0.10,
  // Not a gate. Measured, directional anisotropy cannot tell a shaken page from
  // a ruled one, and misses diagonal shake entirely — while plain
  // variance-of-Laplacian catches every direction. See bench/anisotropy.html.
  // It survives only to choose between "the phone moved" and "too blurred",
  // which is worth getting right because the two need different actions.
  ANISOTROPY_HINT: 0.35,
  // Specular highlight: bright and colourless. IMAGE_PIPELINE.md §7 is stricter
  // than the old threshold, and right to be — a blown highlight is unrecoverable,
  // there is no information under it to enhance, and it lands preferentially on
  // the glossy ridge of a fresh ink stroke.
  GLARE_V: 0.94,
  GLARE_S: 0.12,
  // Two different bars for the same measurement, on purpose. GLARE_WARN is
  // the live gate's blocking line — asking for a retake costs nothing while
  // the page is still in front of the student, so it fires early. GLARE_FAIL
  // is where scorePage() actually marks the *submitted* page unreadable —
  // forgiving a level between the two, because a page already through the
  // gate and conditioned is a page that costs a trip back to the schoolbag
  // to redo, and the honest line for "genuinely unreadable" sits higher than
  // the honest line for "worth one more try while it's easy". Not a stale
  // holdover; recalibrate both together against the golden set (§4.5 of the
  // scan audit) rather than merging them into one number.
  GLARE_WARN: 0.005,
  GLARE_FAIL: 0.035,
  // Any single channel pinned at maximum. Distinct from glare: a page can clip
  // red without clipping to white, which is precisely the teacher's ink going.
  CLIP_WARN: 0.02,
  // Long edge in pixels after warping. Still a placeholder until the golden set
  // can measure where extraction actually degrades — but advisory, never
  // blocking, because it is the one gate a student's hardware may make
  // unreachable.
  RESOLUTION_WARN: 1800,
  RESOLUTION_FAIL: 1000,
  // Corner angles further than this from square. A prompt to square up, not a
  // refusal: perspective correction handles a great deal of tilt, and the
  // warning is for the case where it will have to stretch one end badly.
  SKEW_WARN_DEG: 15,
};

export const PAGE_VERDICT = /** @type {const} */ (['ok', 'warn', 'fail']);

// ── stage 1 · conditioning ─────────────────────────────────────────────────

export const CONDITIONING = {
  // IMAGE_PIPELINE.md §4. Not 300 DPI: that floor is calibrated for 10-12pt print
  // read by a classical OCR engine, and exam handwriting is four to eight times
  // larger. The models see crops, not pages, and a crop of a fifth of a page at
  // 1500px arrives at four to five times the effective resolution the same
  // region would have had inside a full-page image — while being smaller.
  PAGE_LONG_EDGE: 2400,
  CROP_LONG_EDGE: 1500,
  // Quality, not a search. The old build walked JPEG quality down while
  // measuring how much red survived, which was fighting a problem the format
  // was creating. One encode, no re-encode. See bench/README.md.
  ENCODE_QUALITY: 0.92,
  // WebP where the browser has it, JPEG where it does not. Neither can be made
  // to write 4:4:4 from a canvas — measured, see bench/README.md — which is why
  // the mask carries the fine detail rather than the page.
  ENCODE_TYPES: ['image/webp', 'image/jpeg'],
  PREPROCESS_VERSION: 'v2',
};

// ── stage 2 · layer separation ─────────────────────────────────────────────

export const RED = {
  // IMAGE_PIPELINE.md §6. Hue is out; it is numerically unstable at exactly the
  // saturation faint red pen lives at, and white paper under a tubelight drifts
  // toward a hue a naive red test partly selects.
  //
  // Both replacements are kept because §6.1 says to measure rather than choose.
  // Thresholds are distances *above the page's own paper*, never absolute — the
  // baseline is what makes this work in a kitchen and a classroom alike.
  CHANNEL: 'ratio',
  // CIELAB a*. Blue-black ink reads around +12 above paper, faint red around
  // +32, so the band sits between them with room on both sides.
  LAB_T_LOW: 18,
  LAB_T_HIGH: 30,
  // R/(G+B). Blue ink goes *negative* here, which is a cleaner separation than
  // a* manages, for one divide instead of two cube roots.
  RATIO_T_LOW: 0.12,
  RATIO_T_HIGH: 0.25,
  // Above this the soft mask counts as ink for component analysis. The stored
  // mask stays soft; only the shape analysis thresholds a copy.
  COMPONENT_THRESHOLD: 128,
  // Ink is anything meaningfully darker than the page.
  INK_LUMA_MAX: 165,
  MIN_COMPONENT_PX: 12,
};

export const LAYER_FALLBACK = {
  // The teacher marked in green, black or pencil: the page clearly has content
  // and the red mask found essentially nothing. Common enough to matter.
  NON_RED_MARKING: 'non_red_marking',
  // The student wrote in red, which breaks the layer assumption completely.
  STUDENT_WROTE_RED: 'student_wrote_red',
  RED_INK_SHARE_MIN: 0.002,
  // IMAGE_PIPELINE.md §6.3 puts this at about 15% of written area.
  RED_INK_SHARE_MAX: 0.15,
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
