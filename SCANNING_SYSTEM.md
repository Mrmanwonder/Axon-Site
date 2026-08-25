# SCANNING_SYSTEM.md

The ingestion pipeline. This is the highest-risk subsystem in Axon and the
one every other feature depends on — Insights, Library, and every explanation
are downstream of whatever this produces. If mark attribution is wrong, the
analytics are confidently wrong, which is worse than absent.

Supersedes the Scan section of ANALYTICS_LIBRARY_SCANNER.md, which was written
under the upload-first assumption. Camera is in v1. Screen-level UX in that file
still holds where it doesn't conflict with this.

---

## 1. What the system is actually doing

This is not document OCR. Document OCR reads one layer of text off a page.
A graded exam paper has three layers stacked on top of each other:

1. **The question** — printed on the paper, or handwritten by the student
   copying from a board or projector.
2. **The student's answer** — handwritten, blue or black ink, variable quality,
   often containing math, diagrams, chemical structures, or labelled figures.
3. **The teacher's marking** — red ink. Ticks, crosses, half-ticks, circled
   deductions, marginal numbers, strikethroughs, underlines, occasional
   comments, and a per-question mark in the margin.

The product isn't "read the page." It's **bind layer 3 to layer 2 to layer 1** —
attribute each teacher mark to the answer region it refers to, and that answer
region to its question. Everything Axon claims to know follows from that
binding being right.

### The hard rule this creates

**A field without provenance does not exist.** Every extracted value — question
number, answer text, marks awarded, marks available — carries the bounding box
on the source image it was read from. If the extractor produces a value it
cannot point at, that value is discarded and the field is marked unsure. This
is the primary defence against a vision model producing plausible fiction, and
it's what makes the review screen possible: every field can be shown against
its own crop.

---

## 2. Pipeline architecture

Ten stages. Stages 0–2 run on device. Stages 3–8 run server-side. Stage 9 is
the student. Stage 10 commits.

```
[0] Capture            device    camera or upload → raw page images
[1] Conditioning       device    deskew, crop, normalise, compress
[2] Layer separation   device    red-ink mask → teacher layer / content layer
[3] Structure pass     server    question segmentation, mark-column detection
[4] Content pass       server    per-region text + math recognition
[5] Mark attribution   server    bind teacher marks to question regions
[6] Reconciliation     server    arithmetic self-check against reported total
[7] Tier routing       server    Tier 1 vs Tier 2 scheme match
[8] Explanation        server    per-question tutor output (async, streaming)
[9] Review             student   confirm, correct, or reject
[10] Commit            server    write PaperGraph, invalidate analytics cache
```

Stages 3–6 are the extraction core. Stage 8 must not begin for a question until
that question has passed 6, because an explanation built on a misattributed mark
is the exact failure mode the product cannot survive.

---

## 3. Stage 0 — Capture

### Camera

In v1, as decided. The capture experience is a stated differentiator, which
means it has to be genuinely good, not present.

Requirements:

- **Edge detection with live quad overlay.** Corners tracked per frame, drawn as
  brackets per the prototype's viewfinder treatment.
- **Auto-capture on stability.** Fire when the quad is stable for ~600ms, the
  frame is in focus, and the page fills a minimum share of the viewport. Manual
  shutter always available; auto-capture is assistance, never the only path.
- **Glare detection.** Specular highlights over a threshold area inside the quad
  block auto-capture and prompt a tilt. Glare is the single most common cause of
  a lost mark on Indian classroom paper under tubelight, and it is silently
  destructive — a washed-out red tick reads as no tick at all.
- **Perspective correction and deskew** applied on accept, not later.
- **Multi-page batch.** Pages accumulate in a tray, reorderable, individually
  retakeable and deletable, with a running page count. A full answer booklet is
  15–20 pages; a flow that requires re-entering capture per page is unusable.
- **Per-page quality gate.** Blur, resolution, and glare scored on accept. A
  page that fails gets flagged in the tray immediately, while the paper is still
  physically in front of the student. Catching a bad page 40 seconds later at
  the review step, once the booklet is back in a bag, is a materially worse
  experience.

### The container problem — read this before building

A PWA is the wrong container for a camera that's supposed to be a
differentiator. On the web you get `getUserMedia` and raw frames; edge
detection, deskew, auto-capture, and glare scoring are all yours to build,
typically via OpenCV.js in a worker, and iOS Safari is the least reliable
surface for exactly this. Meanwhile both native platforms ship a document
scanner that already does all of it well: VisionKit's `VNDocumentCameraViewController`
on iOS, ML Kit Document Scanner on Android.

**Recommendation: wrap the existing web app in Capacitor and use the native
document scanner for capture only.** Same codebase, same routing, same design
system, one native plugin at the capture boundary. This gets best-in-class
capture on day one instead of a six-week OpenCV project that lands somewhere
short of it, and it also unlocks real haptics and proper background upload.

If Capacitor is rejected and it stays pure web, then capture quality is no
longer a defensible differentiator and the honest fallback is upload-first with
a competent-but-modest in-app camera. Pick one; the failure case is claiming
best-in-class capture on a stack that can't deliver it.

**Resolved, 2026-08:** stays pure web, not a from-scratch rewrite either way.
The root cause traced through a real production failure turned out to be
narrower than "the container is wrong" — the shutter was grabbing a
compressed video frame via canvas instead of a real photographic still, with
no re-validation between the live gate saying "go" and the frame actually
submitted. `capture.js` now takes the real still `ImageCapture.takePhoto()`
offers where the platform has it (Chromium/Android), with the old canvas
grab as a graded fallback (settle delay added, since that path had none) —
this closes most of the gap the Capacitor recommendation above was reaching
for, at a fraction of the cost of a rewrite. iOS Safari does not implement
`ImageCapture.takePhoto()` as of this writing and stays on the canvas-grab
path. Capture path is now recorded per page (`conditioning_meta.capture_path`),
so this is revisited with real numbers rather than argued again from
scratch: if production data shows iOS capture quality still meaningfully
lagging Android after this change, that is the trigger to bring Capacitor +
`VNDocumentCameraViewController` back for iOS specifically — a scoped,
evidence-driven decision about one platform's capture step, not the whole
container question reopened.

### Upload

Stays, permanently, as a first-class path — not a fallback. Gallery, files, and
a pasted link for a school-shared PDF or Drive link. PDFs are rasterised at
stage 1. A student who already photographed the paper last week should not have
to re-photograph it.

### Constraints

- Accepted: JPEG, PNG, HEIC, PDF.
- Max 25 pages per paper, 1 paper per session.
- HEIC transcoded on device.

---

## 4. Stage 1 — Conditioning

On device, before upload, because Indian mobile data is the binding constraint
on time-to-result far more often than server compute is.

- Perspective correction to a rectangle.
- Illumination normalisation — flatten the lighting gradient from a phone held
  over a page under a single overhead light.
- Resolution normalisation to ~300 DPI equivalent on the long edge. Higher is
  wasted bytes; lower loses thin red pen strokes.
- Adaptive compression: quality tuned to keep red-channel detail, since that
  channel carries the marks. **Do not use a compression profile tuned for
  legibility of black text** — it's the wrong optimisation target here.
- Target: under 400KB per page after conditioning.

A 16-page booklet should upload in under 30 seconds on a mid-tier 4G connection.
If it doesn't, students on the move will abandon mid-scan, and abandonment at
capture is the most expensive drop-off in the product because the paper is
physically present and won't be again.

---

## 5. Stage 2 — Layer separation

The cheapest high-value trick in the pipeline, and it happens on device.

Teacher's ink is red. Student's ink is blue or black. An HSV mask over the red
hue ranges (both ends of the wrap-around) separates the teacher layer from the
content layer **before any model sees the page** — no ML, no cost, no latency.

Two outputs per page:

- **Teacher layer** — red-ink mask, plus connected-component analysis giving the
  position, size, and shape class of every mark. Ticks, crosses, and marginal
  digits are structurally distinguishable at this level.
- **Content layer** — the page with red suppressed, which is a cleaner input for
  text recognition than the raw page, because teacher ink frequently overlaps
  and strikes through student writing.

This gives you a spatial map of every teacher mark on the page, with coordinates,
before spending a single token. Stage 5 is mostly a matter of joining that map
to the question regions from stage 3.

### Known failure modes, handle explicitly

- **Teacher marked in green, black, or pencil.** Common enough to matter. Detect
  by: red mask produces near-zero components while the page clearly has content.
  Fall back to a colour-agnostic path where marks are found by the model rather
  than the mask, and drop every field on that page one confidence tier. Do not
  fail the scan.
- **Student wrote in red.** Rare, and it breaks the assumption completely. Same
  detection route — implausibly large red component area — same downgrade.
- **Faded or washed-out red under glare.** Caught at stage 0 by the quality gate,
  which is why the gate is at capture rather than here.

### Design system connection

Red is reserved for teacher's ink and never appears in interface chrome. That
rule was made on design grounds and it turns out to be the same rule the
pipeline runs on. Worth keeping them named as one thing in code — a single
`TEACHER_INK` semantic — so nobody later introduces a red error state without
noticing what they've collided with.

---

## 6. Stage 3 — Structure pass

Cheap, fast, whole-page. The goal is to slice the booklet into question regions
without reading the content.

Anchors, in priority order:

1. **Question numbering.** `1.`, `Q1`, `(a)`, `(i)`, `Ans 3` — the strongest
   structural signal on the page. Numbering is monotonic within a paper, which
   makes gaps detectable: if the sequence reads 1, 2, 4, either question 3 was
   skipped by the student or missed by the extractor, and those are different
   things that must be disambiguated, not assumed.
2. **The margin column.** Teacher marks cluster in a vertical band, usually
   right-hand. Detecting that band converts mark attribution from a
   two-dimensional search into a one-dimensional one.
3. **Whitespace and rule-line breaks** between answers.
4. **Page boundaries.** A question can straddle pages; a question region is a
   list of page-plus-box pairs, never a single box. Long-answer questions in
   classes 11–12 routinely run two to three pages.

Output: an ordered list of question regions, each with page spans, boxes, a
candidate number, and a structure confidence.

Run this with a fast, cheap vision call on downscaled pages, or a layout model.
It does not need to read handwriting — it needs to find boundaries.

---

## 7. Stage 4 — Content pass

Per-region, not per-page. Crops from stage 3 go to the vision model
individually.

Cropping matters for three reasons: token cost drops sharply against sending
full pages; accuracy improves because the model isn't holding a whole booklet in
context; and failures localise to one question instead of poisoning a page.

Per region, extract:

- Question text, where present on the page.
- Student answer text.
- Marks awarded and marks available, if written in this region.
- Region type: `prose`, `math`, `diagram`, `table`, `mcq`, `mixed`.

### Math and diagrams

Do not attempt to transcribe a diagram into text. A labelled biology diagram, a
free-body diagram, or a construction in geometry does not survive being
described, and a model asked to describe one will produce something fluent and
wrong. Mark the region `diagram`, keep the crop, and let the explanation stage
work from the image plus the teacher's mark rather than from a fabricated
description.

Math gets transcribed to LaTeX where the model is confident and kept as a crop
where it isn't. A mangled equation is worse than an honest image.

### Prompting rules for the extractor

- Return structured output only, with a bounding box for every field.
- Return `null` for anything not visible. **Never infer.** A missing mark is
  data; a guessed mark is corruption.
- Do not evaluate correctness. Stage 4 reads; it does not judge. The teacher has
  already judged, and the model's opinion about whether an answer deserved the
  mark it got is not wanted anywhere in this product.

---

## 8. Stage 5 — Mark attribution

Join the stage 2 teacher-mark map to the stage 3 question regions.

For each teacher mark: assign to the question region whose span contains it, or
whose margin band it sits in. Resolve ambiguity by vertical proximity to the
region's baseline, then by reading order.

Classify each mark:

- **Marginal number** — the awarded mark for the region. Highest weight.
- **Tick / half-tick** — credit, possibly partial.
- **Cross / strikethrough** — no credit, or a struck-out portion.
- **Circle / underline** — an error indicator, usually pointing at a specific
  span. Retain its box; it's the highest-value input to the explanation stage,
  because it's the teacher pointing directly at what went wrong.
- **Comment** — free text, transcribed verbatim, never paraphrased.

Where a marginal number and the tick pattern disagree, **the marginal number
wins.** The teacher wrote it deliberately.

---

## 9. Stage 6 — Reconciliation

This is the most important stage in the pipeline and the reason the system can
claim to know when it's wrong.

The paper has a reported total, usually on the front page, usually circled. The
sum of per-question awarded marks must equal it. Likewise the sum of per-question
available marks must equal the paper's maximum.

Three independent arithmetic checks:

1. Σ awarded == reported total
2. Σ available == stated maximum
3. For every question: awarded ≤ available

**This gives ground truth without ground truth.** Any extraction that reconciles
is very unlikely to be wrong in a way that matters, and any extraction that
doesn't is definitely wrong somewhere — and the size of the delta narrows where.
A discrepancy of exactly one question's typical value points straight at a
missed or double-counted question.

### When reconciliation fails

Route to review with the delta surfaced and the least-confident regions ordered
first. Never auto-correct to force a match — silently adjusting a mark to make
the arithmetic work is the single worst thing this system could do, because it
produces a clean-looking paper that is quietly fictional.

### When the teacher's arithmetic is wrong

It happens. The app must never say so. A 15-year-old being told by software that
their teacher can't add is a product that gets deleted, and a stated
non-negotiable is that the AI never contradicts the teacher's marks.

Framing: *"Our reading of this paper doesn't add up — worth checking these
questions."* That puts the student in the position of checking the scan, not
auditing the teacher. Internally, log as an unreconciled paper; if the student
confirms every question as correctly read and the total still doesn't match,
accept the per-question data, keep the paper's total as the teacher wrote it,
and never surface the contradiction.

---

## 10. Confidence model

Confidence is not the model's token probability. That number is
overconfident on handwriting and correlates poorly with being right.

Composite over four independent signals:

| Signal | What it measures |
|---|---|
| Recognition | Model-reported confidence on the field |
| Structural | Question numbering monotonic, no sequence gaps |
| Arithmetic | Whether this question's paper reconciled |
| Plausibility | awarded ≤ available, mark within the type's normal range |

They're independent, which is what makes the composite meaningful — a field can
be read cleanly and still be structurally suspect.

Three tiers, mapping to the existing confidence chips:

- **Confident** — all four pass. Shown normally.
- **Unsure** — any one fails. Surfaced first in review, chip shown, included in
  analytics but tagged.
- **Couldn't read** — recognition failed or provenance is missing. Shown as a
  crop with an honest statement. **Excluded from analytics entirely** until the
  student resolves it.

That last exclusion is load-bearing. An unresolved field must never silently
enter the pattern analytics, because the whole value proposition of Insights is
that a trend across papers means something.

---

## 11. Stage 7 — Tier routing

Unchanged from prior decisions, restated because it lives here.

Test type decides routing, and it's the highest-leverage field in the app:

- **Unit test, mid-term, class test** → Tier 1. Explanation from the teacher's
  marks, the student's answer, and syllabus knowledge. No scheme.
- **PYQ, sample paper, board paper** → attempt Tier 2. Match against the CBSE
  marking scheme library on board, class, subject, year, and paper code. On a
  confident match, the scheme's step-marking becomes the spine of the
  explanation. On no match, **fall back to Tier 1 and say so** — an approximated
  scheme is a fabricated authority and is worse than none.

Tier 2 is CBSE-only and stays that way. Cambridge and Pearson refuse third-party
reproduction rights. IB and Cambridge students get Tier 1, which must be good
enough to stand alone, because for a meaningful share of the global user base
it's the entire product.

---

## 12. Stage 8 — Explanation

Per question, async, streaming into the paper as each one completes. A student
should be reading question 1's explanation while question 9 is still generating.

Inputs per question: question text, student answer, marks awarded and available,
teacher's marks including the boxes of any circles or underlines, teacher's
comment verbatim, the crop itself, and the scheme extract if Tier 2.

Hard constraints, restated from CLAUDE.md because this is where they'd erode:

- Never dispute the mark. The starting premise is always that the teacher was
  right, and the job is explaining *why* — reconstructing the reasoning behind
  the deduction, not evaluating it.
- Never say the student was right and the teacher wrong. If the model cannot
  construct a reason for the deduction, it says so plainly and suggests asking
  the teacher. That's an honest and genuinely useful outcome.
- Explain the gap, name the concept, give one concrete thing to do differently.
- No praise inflation, no consolation. The design register is Linear, not a
  cheerleader.
- Cite the teacher's own marking where it exists — a circled word is a better
  explanation anchor than anything the model can infer.

---

## 13. Stage 9 — Review

The screen already specified, with the pipeline's contract behind it.

- Unsure and unreadable fields **first**, not last.
- Every field shown against its own crop. This is only possible because of the
  provenance rule.
- Correction ladder: pick an alternative → type it → rescan that one page.
- Reconciliation delta shown at the top when it fails, in plain numbers.
- Never silently drop a page or a field. An admitted gap is recoverable; an
  invisible one corrupts every downstream insight quietly and permanently.

Review is a required step in v1. Not skippable, not defaulted-to-accept. Once
extraction accuracy is measured rather than assumed, a confident-paper fast path
becomes reasonable — but that's earned with data, not assumed at launch.

---

## 14. Stage 10 — Commit and data model

```
Paper
  id, student_id, board, class, subject, chapter[], test_type,
  date_taken, tier, total_awarded, total_available,
  reconciled: bool, source_pages[], created_at

Page
  id, paper_id, index, storage_key, quality_score, conditioning_meta

Question
  id, paper_id, number, order_index, page_spans[],
  text, answer_text, region_type,
  marks_awarded, marks_available,
  confidence_tier, confidence_signals{}, needs_review: bool

TeacherMark
  id, question_id, page_id, box, mark_class,
  value, comment_text, confidence

Explanation
  id, question_id, tier, body, concepts[], cause_category,
  model_version, prompt_version, generated_at

ExtractionRun
  id, paper_id, pipeline_version, model_versions{},
  stage_timings{}, reconciled, corrections_count, cost_paise
```

`ExtractionRun` is not optional. Without per-run versioning and correction
counts there is no way to tell whether a pipeline change improved anything, and
this system will be changed constantly for its first year.

Every paper is pinned to the board and class it was scanned under and is never
re-mapped when the student advances or changes board.

---

## 15. Cost and latency

Two-pass — cheap structure then cropped content — exists to make this
affordable. Full-page-to-frontier-VLM on a 16-page booklet is roughly an order
of magnitude more expensive than crop-routed extraction, and less accurate.

Budget targets per paper:

| | 6-page test | 16-page booklet |
|---|---|---|
| Upload complete | 12s | 30s |
| Structure visible | 15s | 25s |
| Extraction complete | 45s | 110s |
| First explanation | 50s | 60s |

Progress messaging is per-page and specific — *"reading page 3 of 6"* — never a
generic bar and never a spinner. Skeleton treatment per DESIGN_SYSTEM.md.

Cost control levers, in order of preference: crop routing over full pages;
downscaled pages for the structure pass; a smaller model for structure and a
frontier model only for content; caching scheme lookups; and never regenerating
an explanation that hasn't had its inputs corrected.

Instrument cost per paper from day one. It's the number that decides whether the
pricing model works, and it's much harder to retrofit than to log.

---

## 16. Failure taxonomy

Every one of these needs a defined, tested behaviour. None of them may fail
silently.

| Failure | Behaviour |
|---|---|
| Page too blurred | Caught at capture. Flag in tray, prompt retake. |
| Glare over marks | Caught at capture. Block auto-capture, prompt tilt. |
| Teacher marked in non-red | Detect, downgrade confidence, colour-agnostic path. |
| No question numbers | Segment by whitespace, mark all structure unsure, review. |
| Question spans pages | Region carries page spans; not a failure if handled. |
| Missing page in booklet | Sequence gap detected at stage 3, prompt for the page. |
| Reconciliation fails | Surface delta, order by confidence, never auto-fix. |
| Total not found | Skip checks 1–2, keep check 3, downgrade whole paper. |
| Illegible handwriting | Region marked couldn't-read, crop shown, manual entry. |
| Diagram-heavy answer | Region typed `diagram`, crop retained, no transcription. |
| No Tier 2 scheme match | Fall back to Tier 1 and say so explicitly. |
| Upload interrupted | Resume from local draft, per-page, no re-capture. |
| Model API failure | Retry with backoff, then queue, then honest failure with the paper preserved. |
| Not a graded exam paper | Detect at structure pass, refuse politely, don't process. |

That last row matters more than it looks. Students will upload homework, blank
question papers, textbook pages, and things that aren't schoolwork at all. A
system that dutifully extracts a textbook page into the analytics quietly
degrades every insight downstream.

---

## 17. Privacy and legal

The scan is the most sensitive object in the product. A CBSE answer booklet
front page carries the student's full name, roll number, school, and class —
children's personal data under DPDP, and under every framework in the
eleven-jurisdiction review.

Requirements:

- **Subprocessors disclosed.** Any hosted OCR or vision provider is a
  subprocessor and must be named in the privacy policy.
- **No training on student data.** Contractually with providers, and stated in
  the policy. Zero-retention endpoints where available.
- **Encryption at rest**, keyed per account.
- **Deletion is real.** Deleting a paper deletes the page images, crops,
  derived text, and explanations. Not a soft flag.
- **Retention.** Raw page images have a shorter life than derived data. Once a
  paper is reviewed and committed, the full-resolution originals aren't needed —
  keep crops for the review UI and the explanation stage, drop the originals on
  a defined schedule. Less stored data is less to lose.
- **Residency.** India-resident accounts keep scans in-region.

### The teacher's-data question — flag for counsel

The student uploads a document containing a third party's handwriting,
comments, and professional assessment. The teacher hasn't consented, likely
doesn't know, and in some jurisdictions their marginalia is their personal data
being processed by a commercial service.

Nothing in the research report covered this. It's a real and non-obvious
exposure, and it's the kind of thing that surfaces late and expensively. Add it
to the list for the legal review that's already pending on the policy and terms.

---

## 18. Accuracy harness

v1 is not done when scanning works. It's done when scanning is measured.

**Golden set:** 20 real marked papers minimum, spanning classes 9–12, at least
four subjects, and deliberately including the bad cases — a green-pen marker, a
glare-damaged page, a diagram-heavy biology answer, a three-page long answer, a
paper with a teacher arithmetic error. A golden set of only clean papers
measures nothing worth knowing.

Hand-label every paper once: question boundaries, per-question marks awarded and
available, teacher mark positions and classes.

**Metrics, in priority order:**

1. **Mark attribution accuracy** — the share of questions with the correct
   awarded mark bound to the correct question. This is the north-star metric.
   Everything else is diagnostic.
2. **Reconciliation rate** — share of papers where the arithmetic closes
   unaided. The best single proxy for end-to-end health, and it's measurable in
   production without labels, which makes it the production monitor.
3. **Question segmentation F1** — over- and under-segmentation reported
   separately; they have different causes and different fixes.
4. **Answer text WER** — matters least. Explanations tolerate imperfect
   transcription far better than analytics tolerate a misattributed mark.
5. **Correction rate in review** — from production, per field type. The best
   ongoing signal of where the pipeline is actually weak, as opposed to where
   it's weak on twenty papers from one city.

**Gates:**

- Mark attribution ≥ 98% on the golden set before Insights ships against real
  data. Below that, per-question errors compound across papers and the trend
  lines become confidently misleading — which is worse than an empty state.
- Reconciliation ≥ 90% unaided before the review step can ever be made
  skippable.

Run the harness on every pipeline change. `ExtractionRun.pipeline_version` is
what makes that comparison possible.

---

## 19. Deliberately excluded from v1

- **No auto-accept path.** Review is mandatory until accuracy is measured.
- **No multi-paper sessions.** One paper per pass.
- **No offline extraction.** Capture offline and queue; processing needs the
  network. Reading past papers offline still works as specified.
- **No correctness judgement.** The system never forms an opinion on whether a
  mark was deserved.
- **No teacher-facing anything.** Not this year.
- **No handwriting-quality feedback.** Technically easy from this pipeline,
  socially awful, and off-mission.

---

## 20. Build order

1. Conditioning and red-layer separation, on device. Cheap, self-contained,
   testable in isolation, and everything downstream is easier with it working.
2. The golden set. Twenty labelled papers before pipeline work, not after —
   otherwise every subsequent decision is made blind.
3. Structure pass and question segmentation. Measure F1 against the golden set.
4. Content pass on crops. Measure WER.
5. Mark attribution and reconciliation. Measure the north-star metric. **This is
   the milestone that determines whether the product is viable** — if mark
   attribution can't clear the bar here, no amount of design work downstream
   matters.
6. Review UI against real extraction output, not fixtures.
7. Explanation stage, Tier 1 only.
8. Tier 2 scheme matching.
9. Capture — camera, quality gates, batching. Last, because upload feeds every
   earlier stage during development and capture polish is wasted on a pipeline
   that isn't yet accurate.
