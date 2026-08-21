# IMAGE_PIPELINE.md

Replaces SCANNING_SYSTEM.md §4 (Conditioning) and §5 (Layer separation) in full.

You said the current preprocessing looks worse than no preprocessing. I believe
you, and I think I know why — the pipeline is following advice written for a
different decade, a different OCR engine, and a different document.

---

## 1. Why the current preprocessing degrades the image

Six mechanisms, roughly in order of how much damage they do on a graded exam
paper. Most pipelines built from standard "OCR preprocessing" guidance have all
six.

### 1.1 Chroma subsampling is eating the red ink

This is almost certainly the biggest one, and it's invisible in code review
because it lives in an encoder default.

JPEG at default settings uses 4:2:0 chroma subsampling — full resolution for
brightness, **quarter resolution for colour**. A thin red pen stroke on white
paper is barely a brightness event; almost all of its signal is in the chroma
channels. Halve the chroma resolution in both axes and a 2-pixel-wide tick mark
smears into pink mush or disappears entirely.

The student's black ink survives this fine, because black-on-white is pure luma.
The teacher's red ink — the thing the entire product depends on — is exactly the
signal that subsampling is designed to throw away.

**Fix: 4:4:4 chroma, always. Non-negotiable.**

### 1.2 Grayscale conversion destroys the layer separation

If anything upstream converts to grayscale "because OCR doesn't need colour,"
the red-ink mask is being computed from an image that no longer contains red.
For a normal document scanner this is sound advice. Here it deletes the primary
signal.

### 1.3 Binarization kills faint strokes and breaks handwriting

Adaptive or Otsu thresholding turns everything into pure black and white. Casualties:
pencil working, faint red pen, half-ticks written lightly, and the grey gradient
that distinguishes a struck-through word from an underlined one. It also
notoriously breaks cursive, which is most of what a class 11 student writes.

### 1.4 Sharpening creates halos that read as strokes

Unsharp mask puts a bright rim on one side of every edge and a dark rim on the
other. On a page of dense handwriting this manufactures edge structure that
wasn't there, and vision models — trained on photographs, not on sharpened
scans — read it as texture.

### 1.5 Contrast stretching and CLAHE blow out the highlights

Histogram equalisation and "illumination normalisation by dividing out a heavy
blur" both clip. On a page photographed under an overhead tubelight, the clipped
region is the bright patch — which is exactly where a faint red mark was already
struggling. You are brightening the part of the image that had the least
information left and calling it enhancement.

### 1.6 Repeated resampling compounds

Perspective warp, then resize to a target DPI, then JPEG encode, then maybe
resize again for upload. Each resample is an interpolation, each interpolation
is a low-pass filter, and thin strokes are high-frequency detail. Three passes
and the thinnest strokes are gone.

---

## 2. The research report

The report you uploaded is competent and internally consistent, and following it
here would produce exactly the degradation you're seeing. It's optimising for a
different problem.

It is written for **classical OCR engines reading printed black text**. Tesseract
and its relatives want binarized, grayscale, high-contrast input because their
front end is a connected-component analyser. Feeding them a photograph is
genuinely bad. That's where "+5–15% from binarization" comes from.

Mastery feeds **vision-language models a photograph of coloured handwriting**.
Those models were trained on natural images. A "scanner-ified" page is out of
distribution for them in a way a clean photo is not.

The report itself contains the counter-evidence, in three places:

- It notes that GPT-4 Vision achieved under 1% character error on historical
  prints with **no** preprocessing at all.
- Its own binarization row concedes it "may break cursive."
- Its own contrast row concedes it "may blow out highlights."

### What to keep from it

- **Resolution.** Its core claim — that resolution is the single highest-leverage
  variable — is correct and survives intact.
- **Deskew and perspective correction.** Geometric, information-preserving, worth
  doing.
- **Lossless or near-lossless formats.** Correct, and see §1.1 for why it matters
  more here than it does for printed text.
- **Fix problems at capture.** Its advice on stable capture, even lighting, and
  re-shooting rather than deblurring is right and is where the effort belongs.

### What to drop

- **Grayscale conversion.** Deletes the teacher's ink. Never.
- **Binarization.** Never, at any threshold, by any method.
- **Denoising.** Median and NL-means both erode thin strokes. The "noise" on a
  phone photo of paper is mostly paper texture, which costs nothing to keep.
- **Sharpening.** Never.
- **Contrast stretching, histogram equalisation, CLAHE.** Never as a default.

### The through-line

Its checklist is a list of properties the image should *have*. The mistake is
treating that as a list of operations to *apply*. A high-resolution, level,
evenly-lit, unclipped image is the goal — and every one of those properties is
better obtained at capture than synthesised afterwards.

---

## 3. The new principle

**Correct the camera, not the page.**

Preprocessing may change *geometry* and *encoding*. It may not change *tone*.

| Allowed | Forbidden |
|---|---|
| Perspective correction | Grayscale conversion |
| Rotation / deskew | Binarization or thresholding |
| Cropping to the page | Sharpening, unsharp mask |
| Scaling (once, good kernel) | Denoising, median, bilateral, NL-means |
| Encoding at 4:4:4 | Contrast stretch, histogram EQ, CLAHE |
| Colour-space maths for the *mask* | Gamma, auto-levels, auto-white-balance |
| EXIF orientation normalisation | Any "document scan" filter or "magic colour" mode |

The mask is derived from the image. It never replaces it. Every tonal
computation feeds the mask and the quality scores; none of it writes back to the
pixels sent to a model.

---

## 4. Resolution, and where to spend it

The instinct is to send the highest-resolution page you can. That's wasted,
because every vision model tiles and downsamples on its own terms — a 3500px
page arrives at the encoder resampled to something far smaller, using a
resampler you don't control, after you paid to upload it.

The architecture already has the answer: **the models see crops, not pages.**

So resolution is spent asymmetrically:

| Artifact | Long edge | Format | Purpose |
|---|---|---|---|
| Original capture | native sensor | HEIC/JPEG as delivered | Archived, never modified |
| Conditioned page | 2400 px | WebP q92, 4:4:4 | Structure pass, crop source, review thumbnails |
| Question crop | 1400–1600 px | WebP q92, 4:4:4 | Content pass — this is where accuracy is won |
| Red-ink mask (page) | 2400 px | PNG, 8-bit grey | Derived, soft-valued |
| Red-ink mask (crop) | matches crop | PNG, 8-bit grey | Second image in the content call |

A typical question region is maybe a fifth of a page. Cropped and encoded at
1500px long edge, that region arrives at the model at roughly four to five times
the effective resolution it would have had inside a full-page image — while
being *smaller* in bytes. Crop routing was adopted in REVIEW_PIPELINE.md §7 to
control cost; it turns out to be the single largest accuracy lever too.

**Set `detail: "high"` (or the provider equivalent) on every image.** Handing a
model a well-cropped region and then letting it run in low-detail mode discards
everything above.

### On DPI

2400px on the long edge of A4 is roughly 205 DPI, below the report's 300 DPI
floor. That floor is calibrated for printed 10–12pt text read by a classical
engine. Exam handwriting is 4–8× larger than 10pt print, and the crop path
restores effective resolution where it matters. If the golden set says
otherwise, raise it — but raise it on evidence, not on a number borrowed from a
different document class.

---

## 5. Stage 1 — Conditioning (rewritten)

On device. One geometric operation, one encode, nothing else.

### 5.1 The single-resample rule

Compose the perspective correction and the scale-to-target into **one homography
matrix**, and apply it **once**, with a good kernel.

```
❌  warp() → resize() → encode() → resize()          four generations of loss
✅  compose(H_perspective, S_scale) → warpOnce() → encode()   one
```

Kernel: Lanczos3 for downscale, or a proper area-average. Never nearest, never
plain bilinear on a large downscale — bilinear without prefiltering aliases thin
strokes into dashed lines, which looks like a stylistic quirk of the student's
handwriting and is not.

Where the native document scanner returns an already-corrected page (VisionKit,
ML Kit), **accept it and do not re-warp.** It has already done a single
high-quality resample. A second correction on top of a corrected page is pure
loss.

### 5.2 EXIF

Normalise orientation by rewriting pixels once, not by relying on the EXIF flag —
downstream consumers vary in whether they honour it, and a sideways page reaching
the structure pass produces plausible, confident nonsense.

Strip GPS. Keep capture timestamp and device model in the database, not the file.

### 5.3 Encoding

```ts
// Device-side, one encode, no re-encode later.
const encoded = await encode(pixels, {
  format: 'webp',
  quality: 92,
  chromaSubsampling: '4:4:4',   // the important line
  effort: 4,                     // battery-bounded
})
```

WebP at q92 4:4:4 is roughly 30–40% smaller than JPEG at equivalent visual
quality, which matters on Indian mobile data. If WebP encoding isn't available
on a given surface, fall back to **JPEG q90 with 4:4:4 explicitly set** — the
explicit flag is the point, since the default is 4:2:0 and the default is the bug.

Do not use PNG for photographs of pages. The report recommends it, and for
synthetic scans it's right, but a phone photo has sensor noise in every pixel and
PNG will encode all of it losslessly for several megabytes. That's a bandwidth
disaster with no accuracy gain.

**Never re-encode.** If a crop is needed, cut it from the decoded original in the
same pass that produced the conditioned page, not from the conditioned WebP.

### 5.4 Target sizes

Conditioned page at 2400px WebP q92 4:4:4 lands around 500–800KB for a dense
handwritten page. That's larger than the old 400KB target, and the extra bytes
are buying back the strokes the old target was destroying. A 16-page booklet is
~10MB, which is a 45–70 second upload on mid-tier 4G — acceptable with background
upload and a resumable queue, which the R2 presigned-PUT path in STORAGE_R2.md
provides.

If that proves too slow in the field, the lever is **fewer pixels, not more
compression**. Drop to 2000px before dropping quality or subsampling. Resolution
degrades gracefully; chroma subsampling degrades catastrophically.

---

## 6. Stage 2 — Red-ink separation (rewritten)

The prior spec called for an HSV mask. That works in a controlled scan and is
fragile on a phone photo, because hue is numerically unstable at low saturation —
and faint red pen under warm indoor light is exactly low saturation. Under a
tubelight, white paper itself drifts toward a hue that a naive red mask will
partially select.

### 6.1 Use an opponent-colour channel

CIELAB's `a*` axis runs green-to-red and is designed to be perceptually uniform
and reasonably illumination-stable.

```
1. sRGB → linear RGB → CIELAB
2. redness = a*                          (higher = more red)
3. estimate the paper's baseline a* from the page's modal colour
4. mask = smoothstep(baseline + t_low, baseline + t_high, a*)
```

Baseline subtraction is what makes this robust: it measures redness *relative to
this page's paper under this light*, rather than against a fixed threshold that
assumes daylight and white paper.

A cheaper approximation, if the LAB conversion proves too slow on low-end
Android:

```
redness = R / (G + B + ε)      // illumination-ratio, scale-invariant
```

Less principled, considerably faster, and still far better than HSV hue. Measure
both on the golden set and keep the winner.

### 6.2 The mask is soft

**Output an 8-bit greyscale probability map, not a binary mask.** A half-tick
written lightly and a bold cross both matter, and their difference is the mark
class. Binarising the mask reintroduces the same failure as binarising the page,
in the one place it actually costs you semantics.

Connected-component analysis for the mark map (positions, sizes, shape classes)
runs on a thresholded copy. The stored, transmitted mask stays soft.

### 6.3 Detection of the non-red case

Compute two page-level statistics and store them in `pages.quality`:

- `red_component_area_ratio` — near zero on a page with obvious content means the
  teacher didn't use red. Route to the colour-agnostic path and downgrade the
  paper one confidence tier.
- If the ratio is implausibly high (over ~15% of written area), the *student*
  wrote in red. Same downgrade, different reason, both logged distinctly because
  they need different fixes later.

Triage confirms this at the paper level (see REVIEW_PIPELINE.md §8.1); this is
the cheap on-device pre-check that lets the client warn before the upload rather
than after.

---

## 7. Quality gates at capture

Everything that cannot be fixed later gets caught here, while the paper is still
physically in front of the student. Scores land in `pages.quality`.

| Metric | Method | Threshold | Action |
|---|---|---|---|
| Focus | variance of Laplacian, normalised by page area | below threshold | block auto-capture |
| Motion blur | directional gradient anisotropy | above threshold | block auto-capture |
| Glare | fraction of pixels above 250 in all channels, inside the quad | > 0.5% | block, prompt tilt |
| Clipping | fraction at 255 in any single channel | > 2% | warn |
| Resolution | quad long edge in source pixels | < 1800 | prompt to move closer |
| Skew | quad corner angles | > 15° from rectangular | prompt to square up |

Glare is the one to be strict about. A blown highlight is unrecoverable — there
is no information under it to enhance — and it lands preferentially on the glossy
ridge of a fresh ink stroke. Every "contrast enhancement" that appears to help a
glare-damaged page is inventing detail.

---

## 8. How to decide anything else

Every tonal operation is **off by default and stays off** unless it wins on the
golden set.

The harness in SCANNING_SYSTEM.md §18 already supports this: `route_override` was
built to A/B models, and the same mechanism takes a `preprocess_version`. Run the
twenty labelled papers through both, compare mark attribution accuracy first and
answer WER second.

Record `preprocess_version` on every page row. Without it, a preprocessing change
and a prompt change become indistinguishable in the metrics, and you will spend a
week tuning a prompt to compensate for a resampler.

The prior is strong and worth stating: **on this document class, with these
models, I expect every tonal operation to lose.** If one wins, that's a real and
interesting finding — but it needs the golden set behind it, because "it looks
cleaner to me" is precisely the intuition that produced the current pipeline.

---

## 9. Implementation notes

**Native path (Capacitor, recommended).** VisionKit and ML Kit already return a
corrected, single-resampled page. Take it, normalise orientation, encode WebP
q92 4:4:4, compute the mask. Do not warp again. This is a few dozen lines.

**Web path.** `createImageBitmap` with `resizeQuality: 'high'` for the resample,
OffscreenCanvas in a worker for the homography, `canvas.convertToBlob({ type:
'image/webp', quality: 0.92 })`. Note that browser WebP encoders do not all
expose subsampling control — verify on your target devices, and if you cannot
force 4:4:4, that is a concrete argument for the native path rather than
something to work around.

**Mask computation** runs on a downscaled copy (800px long edge) and the result is
upsampled to mask resolution. The mask is spatial guidance, not a precision
instrument, and computing it at full resolution burns battery for nothing.

**Never on the server.** The 2-second Edge Function CPU limit forbids it, and the
device has already decoded these pixels once.

---

## 10. Migration

1. Add `pages.preprocess_version`, default `'v2'`. Existing rows get `'v1'`.
2. Ship v2 conditioning behind a client flag.
3. Re-run the golden set on both. Expect the v1 numbers to be the ones you're
   currently unhappy with; if v2 doesn't clearly beat them, something in this
   document is wrong and it's worth finding out which part before rolling out.
4. Papers already scanned stay on v1 and are not reprocessed — the originals are
   archived under the R2 layout, so reprocessing is *possible* if a later version
   proves substantially better, but it is a deliberate migration, not automatic.
