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
  // Where a page actually came from, recorded rather than assumed. `source_kind`
  // was hardcoded to 'upload' on every page ever submitted, camera captures
  // included, which made the one question the scanner's own telemetry exists to
  // answer — is the camera path ever taken — unanswerable (AXON_FIX_BRIEF.md
  // §7.1). These are the `page_source` enum's values; the database is the
  // authority on the list and this mirrors it.
  SOURCE_KINDS: /** @type {const} */ (['camera', 'upload', 'pdf', 'link']),
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
  // Raised from 0.35 per AXON_FIX_BRIEF.md §7.3. It is not a resolution proxy —
  // the gate checks the projected long edge directly now — it is a framing one:
  // below this the page is small enough in frame that the quad is being fitted
  // to a few hundred pixels and the corner it finds is a guess.
  MIN_FILL: 0.6,
  // Searches in a row that must have found the page before auto-capture will
  // fire. A detector locked onto something large and wrong is extremely stable,
  // so stability alone is not evidence; several finds running is. §7.3 asks for
  // about five.
  CONSECUTIVE_FINDS: 5,
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
//
// Every threshold below was re-derived on 2026-09-01 against the real corpus in
// bench/fixtures/ — five photographs of marked pages, two production-scale
// scans actually submitted by a student, and synthesised failures built from
// those same pages. The numbers behind each one are written next to it. The
// previous set was not derived from anything, and three of the four metrics it
// gated on were measuring the wrong quantity — see AXON_FIX_BRIEF.md §7.4 and
// the notes in quality.js.

export const QUALITY = {
  // ── sharpness ────────────────────────────────────────────────────────────
  // The page is resampled so its long edge is exactly this before sharpness is
  // measured, which is what makes the number mean the same thing on a 240px
  // viewfinder proxy and on a 2400px conditioned page. Without it the metric
  // was not merely imprecise, it was inverted: the same fixture read 1.0000 at
  // 240px and 0.1393 at 1400px, because downscaling concentrates high-frequency
  // energy. That single defect broke both ends at once — the live gate's blur
  // check could never fire (everything looks sharp at 240px) while the final
  // gate warned on pages that were fine (AXON_FIX_BRIEF.md §B7).
  MEASURE_LONG_EDGE: 1400,
  // Sharpness is the 80th percentile of Laplacian variance over 128px patches,
  // not the whole-page variance. Whole-page variance mixes written areas with
  // blank paper, so a lightly-used page scored as "blurred" for having little
  // on it. A patch with less than MEASURE_MIN_RANGE of luma spread carries no
  // focus information at all and is dropped rather than counted as soft.
  MEASURE_PATCH: 128,
  MEASURE_MIN_RANGE: 24,
  MEASURE_QUANTILE: 0.8,
  // Laplacian variance, normalised to 0-1 against this ceiling. Real in-focus
  // pages at production scale measure 4693 and 6017 raw (the two submitted
  // pages in bench/fixtures/), so 2000 puts a good page at 1.0 with room to
  // spare rather than pinning the interesting range against the ceiling.
  BLUR_NORMALISER: 2000,
  // Gaussian blur sweep on those same two pages at the pipeline's own 2400px
  // target: sigma 1.0 -> raw 2200/2656, sigma 1.5 -> 852/944, sigma 2.0 ->
  // 311/340, sigma 3.0 -> 52/50. Warn sits at raw 900 (about sigma 1.5, the
  // point where softness is visible), fail at raw 200 (about sigma 2.2, past
  // which thin pen strokes stop surviving). Deliberately lenient at the fail
  // line: a false reject on a good page is the worst failure this product has.
  BLUR_WARN: 0.45,
  BLUR_FAIL: 0.10,
  // Not a gate. Measured, directional anisotropy cannot tell a shaken page from
  // a ruled one, and misses diagonal shake entirely — while plain
  // variance-of-Laplacian catches every direction. See bench/anisotropy.html.
  // It survives only to choose between "the phone moved" and "too blurred",
  // which is worth getting right because the two need different actions.
  ANISOTROPY_HINT: 0.35,

  // ── glare ────────────────────────────────────────────────────────────────
  // Glare is a *local* anomaly: a patch of the page markedly brighter than the
  // rest of that same page. The old measure counted bright, colourless pixels
  // absolutely, which is a description of white paper, not of glare — every
  // digital scan scored 0.94+ and production told a student who had submitted a
  // clean scan to "tilt it away from the light". Measured instead against the
  // page's own illumination field: cells of GLARE_CELL px, base = the median
  // cell, and a cell counts as blown when it clears both the lift above that
  // base and an absolute floor, and has no colour left in it.
  GLARE_CELL: 32,
  GLARE_LIFT: 24,
  GLARE_FLOOR: 235,
  GLARE_S: 0.12,
  // All seven real fixtures — five photographs and both submitted scans —
  // measure exactly 0.0000. Compositing a saturating specular blob onto a real
  // photograph gives 0.0050 at 3% of the page, 0.0161 at 8%, 0.0323 at 18%.
  // Warn is therefore about 2.5% of the page blown, fail about 11%.
  GLARE_WARN: 0.004,
  GLARE_FAIL: 0.02,

  // ── exposure ─────────────────────────────────────────────────────────────
  // Distinct from glare, and the reason both exist: glare finds a bright patch
  // on an otherwise normal page, and a uniformly over-exposed page has no
  // bright patch to find. What that page does have is ink driven into the paper
  // — a channel pinned at 255 while the pixel still has colour left, which is a
  // red stroke losing its red. Neutral white paper is not that and is not
  // counted, which is the whole difference from the old measure (the two
  // submitted scans went from 0.92 to 0.0002).
  CLIP_CHROMA: 24,
  // Real photographs of marked pages measure 0.0115-0.0375. Lifting exposure on
  // one of them gives 0.1146 at x1.15 and 0.1497 at x1.30. 0.06 separates the
  // two populations with room on both sides.
  CLIP_WARN: 0.06,
  // 255 minus the page's own base level. Recorded, not gated: it is what lets a
  // refusal explain that a page is uniformly blown rather than locally glared.
  // The same exposure sweep takes it from 64 (correct) to 14 (x1.30) to 4 (x1.80).
  HEADROOM_LOW: 12,

  // ── resolution ───────────────────────────────────────────────────────────
  // Long edge in pixels after warping. The floor is enforced at capture now
  // (CONDITIONING.MIN_LONG_EDGE), so these two are the backstop for pages that
  // reach scoring another way. RESOLUTION_FAIL is MEASURE_LONG_EDGE on purpose:
  // below the scale sharpness is defined at, the sharpness number is being read
  // off an upsample and cannot be trusted, so there is nothing honest left to
  // say about the page.
  RESOLUTION_WARN: 2400,
  RESOLUTION_FAIL: 1400,
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
  // The floor, and it is a refusal rather than a warning (AXON_FIX_BRIEF.md
  // §7.2). `targetSize` caps and never upscales — by design, since inventing
  // pixels would only move the failure downstream — so a source smaller than
  // this cannot produce a page at this size and there is nothing to be done
  // with it but say so while the paper is still in front of the student. It is
  // the same number as PAGE_LONG_EDGE: the guarantee is that a conditioned page
  // is *exactly* the target size, never a shortfall nobody was told about.
  MIN_LONG_EDGE: 2400,
  // A 512px copy of the page, written alongside it. Triage asks "is this a
  // marked exam paper", which a thumbnail settles, and sending full pages to
  // answer it is the single largest avoidable latency in the pipeline
  // (AXON_FIX_BRIEF.md §7.5).
  THUMB_LONG_EDGE: 512,
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
