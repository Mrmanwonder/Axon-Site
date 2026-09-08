# bench/

Mostly measurement, not tests — these answer questions where the honest
answer is a number and the tempting answer is an opinion. `golden.test.mjs`
is the one exception: real fixtures, real pass/fail assertions, wired into
`npm test`.

| What | Run it |
| --- | --- |
| `bench.html` | Device pipeline timing — conditioning, layer separation, the whole stage 0–2 leg |
| `chroma.html` | How much of the teacher's ink each encoder destroys |
| `anisotropy.html` | Whether a motion-blur measure can tell a shaken page from a ruled one |
| `conditioning.html` | One page through stage 1 and 2, timed under CPU throttling |
| `viewfinder.html` + `viewfinder.mjs` | The real capture controller against a page-on-a-desk scene streamed from a canvas |
| `tracking-continuity.mjs` | The same scene with the page *moving*: does the overlay stay on it, and how often does the pose refresh — see below |
| `capture.test.mjs` | The steadiness window and the shutter decision, as pure functions |
| `tracking.test.mjs` | The corner tracker and the local corner search, against synthetic corners with known answers |
| `probe.html` | One page through conditioning, with the intermediate stages visible |
| `detect.html` | Quad detection on the real fixtures below, with the quad drawn over each one — the visual version of `golden.test.mjs` |
| `golden.test.mjs` | The same fixtures, as an actual CI check — see below |
| `marks-report.mjs` | Whether the teacher's ink survives stage 2 on real submitted pages, and where the marked / wrote-in-red populations separate — see below |
| `flatten-report.mjs` | What illumination flattening does to a page's lighting, and what it costs the teacher's red ink — see below |
| `golden-report.mjs` | The same fixtures again, as a false-accept/false-reject rate report instead of pass/fail — `node bench/golden-report.mjs` |
| `verdict-agreement.mjs` + `.test.mjs` | Whether the live capture gate ever waves through a shot the final `scorePage()` then fails — see below |

Serve the repo and open them, or drive them with Playwright:

```bash
python3 -m http.server 8765 &
PLAYWRIGHT_HOME=/path/with/node_modules node bench/viewfinder.mjs
node --test bench/capture.test.mjs
```

Playwright is not vendored — there is no `package.json` and `AGENTS.md` keeps it
that way. Point `PLAYWRIGHT_HOME` at an install you already have.

## tracking-continuity.mjs

`viewfinder.mjs` asks whether a page held still gets photographed — the failure
that happened in the field. This asks the other question: while the page is
being *moved*, does the overlay stay on it?

That is not visible in a still scene, and it is the whole claim of the corner
tracker. A detector that re-searches the whole frame a dozen times a second
looks perfect standing still and has nothing at all to say between two
searches, which is when a moving page is somewhere new.

```bash
PLAYWRIGHT_HOME=/path/with/node_modules node bench/tracking-continuity.mjs
```

Measured across the change that added the tracker, same scene, same 12s window:

| | global search only | four tracked corners |
| --- | --- | --- |
| pose refresh | 1.6 Hz | **6.6 Hz** |
| frames with a page | 100% | 100% |
| longest blink | 0 frames | 0 frames |

Read the ratio, not the absolute numbers. Headless Chromium rendering and
capturing a 3024x4032 canvas stream is the bottleneck in both columns — a real
phone is not doing that — so what the run establishes is that the pose refreshes
about four times as often for the same scene, not what either rate would be on
a device. The scene is also an easy one (a bright page on a dark desk, moving
smoothly), which is why continuity is 100% in both columns: this measures the
refresh rate honestly and does not yet measure recovery from a genuinely hard
frame. A fixture that goes briefly out of focus or under a hand is what would.

## flatten-report.mjs

Illumination flattening used to run only on the rescue path, so a page large
enough not to need rescuing got no lighting correction at all — which is exactly
where a hand or a desk-lamp shadow shows up. It is considered for every page
now, and this is what says whether that was safe.

```bash
node bench/flatten-report.mjs
```

The thing it measures is not "did the shadow go" — that part was never in
doubt. It is what flattening costs the teacher's red pen, because any stage that
touches pixels before `separateLayers` sees them has to be shown not to cost it
anything.

It found something. Flattening raises the **red share of a page's ink**, and
`LAYER_FALLBACK.RED_INK_SHARE_MAX` decides on exactly that number whether a page
is a teacher's marking or a student who wrote in red. On the corpus's real
production scan — an evenly lit sheet with nothing to correct — flattening moved
the share from 0.126 to 0.233, past the 0.15 line, and took a page carrying 141
genuine teacher marks to **zero**.

That is why flattening is gated on `ENHANCE.FIELD_FLAT_ENOUGH`: a page whose
lighting is already even is left byte-for-byte alone. Measured across the
corpus, with a synthetic hand's shadow as the second row of each pair:

| | illumination spread | what happens |
| --- | --- | --- |
| real pages, as shot | 1.11 – 1.22 | left alone |
| the same pages, shadowed | 1.90 – 2.24 | flattened |

Nothing sits near the 1.35 line. Every real page as shot keeps exactly the marks
it had; every shadowed page has its shadow removed (mean evenness 0.383 → 0.273,
and 0.224 → 0.097 on the worst one). Mean cost is 94ms a page on a bench
machine, most of which is the pages that skip the full-resolution pass —
`conditioning_meta.flatten_ms` is the number from a real device.

**Resolved, and it was not what it looked like.** This report first showed
flattening pushing shadowed marked pages past `RED_INK_SHARE_MAX` and losing
every mark on them (291 → 0, 126 → 0), which read as a threshold that needed
raising. The threshold was wrong, but the reason those pages moved so far was a
bug in `modeOf` — see `marks-report.mjs` below. With that fixed and the
threshold re-derived, flattening changes **no** page's colour verdict and costs
four marks across the whole corpus (951 → 947), while still removing the shadow
it exists for.

## marks-report.mjs

Does the teacher's ink survive stage 2, on the pages a real student actually
submitted? For a long time the answer was no, and nothing said so.

```bash
node bench/marks-report.mjs
```

`modeOf` in `colour.js` built one histogram from the redness plane's raw minimum
to its raw maximum. `redRatio` is `(r+1)/(g+b+2)`, so a single pixel with almost
no green or blue in it reads 85 or more, while the paper the function exists to
find sits near 0.5. All 512 bins went on outliers, leaving the paper's mode
resolved to two bins — and which one it landed in was decided by whichever pixel
happened to be reddest:

| page width | red share | verdict | marks |
| --- | --- | --- | --- |
| 1600 | 0.117 | marked | 151 |
| 1634 | 0.126 | marked | 141 |
| **1636** | **0.257** | **student_wrote_red** | **0** |
| 1640 | 0.118 | marked | 138 |

1636×2400 is exactly what conditioning produces for that fixture. An unstable
measurement has two answers and production was always going to get one of them.

Fixed by measuring the mode over a trimmed range instead. On the real submitted
page that recovers **144 teacher marks where there were none** — the same count
`extraction_run fc030c2a` got from those exact pixels, which `golden.test.mjs`
has cited all along while the live pipeline returned nothing. This is very
likely most of `scanner-and-post-scan-plan-2026-08-31`'s finding that 48/48
question regions came back unsure or unreadable: stage 2 was handing every stage
after it an empty map.

### Re-deriving RED_INK_SHARE_MAX

Only possible once the number it judges was stable. At the size conditioning
produces:

| | red share |
| --- | --- |
| teacher marked, real | 0.117 – 0.183 |
| student wrote red, synthetic | 0.292 – 0.361 |

The old 0.15 sat *inside* the marked population, so a heavily-marking teacher's
page was classified as written-in-red. It is 0.22 now — in the gap and
deliberately on its lower half, because the two errors are not equally bad. Too
low discards every mark on a marked page, which is at least visible. Too high
hands stage 5 a map of the student's own answer and calls it the teacher's
marking, which is a confident wrong answer about what a teacher wrote.

Four samples from two photographs is thin, and the two synthetics are derived
from the two reals rather than independent of them. What would settle it is a
genuinely red-penned student answer and a page from a heavier-marking teacher.

**Scale is load-bearing here and the report prints it on every line.** The same
measurement on the corpus's 1000px derivatives reads 0.56 on a marked page —
chroma bleeding across strokes, and the reason the pipeline has a resolution
floor. Three separate wrong conclusions in this codebase have come from a
number taken at a scale the pipeline never uses: the sharpness bug in
AXON_FIX_BRIEF.md §B7, `flatten-report.mjs`'s first pass, and the report that
first claimed these pages already yielded nothing.

## golden.test.mjs

`detectQuad`, `paperScore` and `scorePage` are pure functions with no DOM
dependency, so the only thing that ever stood between "measured by hand in a
browser" and "checked in CI" was a way to decode a real JPEG into the plain
`{data, width, height}` shape they expect. `decode.mjs` does that with
`sharp` — a devDependency used only here, never shipped to the browser
bundle — and `golden.test.mjs` runs the real fixtures below through the real
detector and gate, pinned to today's measured behaviour:

```bash
node --test bench/golden.test.mjs   # or: npm test, alongside harness/
```

This is a first instance of the golden-set harness `scansystemredesign.md`
§4.5 asks for, not the thing in full — that wants a checked-in corpus
spanning the whole failure taxonomy (blurry, glared, low-resolution, blank,
ungraded, non-schoolwork...), and this repo has real photographs for only a
slice of that so far: five real captured pages across a skew/tilt range, the
two real viewfinder frames the live gate actually sees, and one deliberate
non-page scene. That last one is a known, currently-passing false accept —
`golden.test.mjs` pins it rather than hiding it, so a change that makes
detection *more* permissive is caught even though this one specific gap isn't
closed yet. Fixing quad-detector accuracy itself is out of scope for that
pass — see the audit's own phasing.

`golden-report.mjs` runs the same fixtures and prints the false-accept and
false-reject rates directly, plus a per-fixture quality-gate breakdown, for
looking at after a threshold change rather than only finding out a pinned
assertion broke. The two real viewfinder frames currently sit close to the
blur line — one scores under `BLUR_WARN` — which reads as the detector
being marginal on real phones, but is a screenshot-of-a-screenshot artifact
of those specific fixtures (a phone's own screen re-captured, then encoded
again) rather than evidence about camera stills; worth knowing before acting
on it, not a finding to chase.

## verdict-agreement.mjs / .test.mjs

The redesign plan's acceptance criterion was "95% live/final verdict
agreement". Measured directly, a naive symmetric agreement score turns out to
be the wrong thing to chase against this codebase's *current* design: the
live gate is deliberately more sensitive to glare than the final check
(`GLARE_WARN` vs `GLARE_FAIL` in `contract.js`) because blocking the shutter
is free while the paper is still in the student's hands, and a page already
through the gate costs a trip back to the schoolbag to redo. On the six real
fixtures this repo has today, that shows up as a 4/6 "live blocked, final
would have accepted" rate — which is the gate working as designed, not a
defect, and reporting it as a failure would push a future change toward
loosening the live gate to chase a number.

The disagreement that actually matters is the other direction: the live gate
says "Ready" and the final check on the resulting still rejects it anyway —
the exact failure the gate exists to prevent. `verdict-agreement.mjs` reports
both rates and names which one is directional-only; `verdict-agreement.test.mjs`
pins the one that counts (`falseGo`) at zero. Both call the real
`liveGateVerdict()` extracted from `capture.js`'s own `step()`, not a
reimplementation that could drift from what a phone actually runs.

```bash
node bench/verdict-agreement.mjs        # the report
node --test bench/verdict-agreement.test.mjs   # the pinned check, also in npm test
```

---

## What chroma.html found

`IMAGE_PIPELINE.md` §1.1 says JPEG's 4:2:0 chroma subsampling is eating the red
ink: a thin red stroke on white paper is almost entirely a chroma event, so
quartering the colour resolution turns a 2px tick into "pink mush". The build it
describes then prescribes WebP q92 at 4:4:4.

Measured on a synthetic page — ticks, underlines and circles at four stroke
widths, in a fresh-pen red and a running-out red, over blue-black handwriting —
the share of red mask pixels that survive a round trip:

| encoder | bold 1px | bold 2px+ | faint 1px | faint 2px+ | bytes |
| --- | --- | --- | --- | --- | --- |
| JPEG q0.76 *(what shipped)* | 87% | 100% | **12%** | 100% | 172KB |
| JPEG q0.92 | 98% | 100% | **24%** | 100% | 451KB |
| WebP q0.92 | 99% | 100% | **33%** | 100% | 320KB |
| WebP lossless | 100% | 100% | 100% | 100% | 1888KB |

Three things follow, and only one of them is in the document.

**§1.1 is right about the case that matters.** Not about the general one — a bold
2px mark is intact at every setting, and the alarm about ticks in general is
overstated. But a faint 1px stroke, which is what a lightly-written half-tick
is, loses 88% of itself at the quality that shipped. Half-ticks carry partial
credit, so that is the product's own semantics being destroyed.

**Its prescribed fix does not work on the web.** WebP q0.92 recovers the faint
thin case only to 33%, because Chromium's canvas encoder subsamples lossy WebP
too and exposes no way to ask for 4:4:4. §9 anticipates this and calls it "a
concrete argument for the native path". It is — but only lossless clears it, and
1.9MB a page is 30MB for a booklet, which the 4G budget in §5.4 cannot absorb.

**The mask is the way out, and both documents already have it.** The red mask is
computed on device from the decoded pixels, before any lossy encode, and travels
to the model as a second image (`REVIEW_PIPELINE.md` §7.3, `IMAGE_PIPELINE.md`
§6). A faint stroke the page encoder loses is still at full fidelity in the mask,
and an 8-bit greyscale PNG of a mostly-empty page is small. That makes the mask
load-bearing rather than a hint — which is a change in how much it matters, and
the reason it is computed from raw pixels and never from the encoded page.


---

## What anisotropy.html found

`IMAGE_PIPELINE.md` §7 asks for motion blur as a gate of its own, measured by
directional gradient anisotropy — the idea being that a shaken frame smears
along one axis while an out-of-focus one loses detail evenly.

It does not work, and it fails in a way worth recording so nobody implements it
again. Measured on a synthetic ruled page, clean and then smeared in three
directions:

| page | gradient anisotropy | axis sharpness | plain sharpness |
| --- | --- | --- | --- |
| clean, ruled | 0.218 | 0.171 | **0.529** |
| shaken sideways 5px | 0.464 | 0.571 | 0.150 |
| shaken sideways 11px | 0.561 | 0.711 | 0.098 |
| shaken vertically 5px | 0.210 | 0.264 | 0.041 |
| shaken vertically 11px | **0.101** | 0.408 | 0.010 |
| shaken diagonally 7px | 0.272 | **0.058** | 0.050 |

First-order gradients measure which way the *content* runs, not which way it was
smeared. An exam page is ruled, so it is lopsided before anyone shakes anything
— and smearing it vertically destroys horizontal edges, which makes it read as
*more* balanced than a clean page. On this measure, vertical shake scores better
than no shake at all.

Second derivatives are closer, because curvature dies along the smeared axis
while ruled lines keep theirs. But diagonal shake degrades both axes equally and
is invisible to any two-axis ratio — 0.058, below the clean page.

The last column settles it. Plain variance-of-Laplacian, which was already
there, puts every smeared page under the blur threshold of 0.22 and leaves the
clean ruled page at 0.529. One gate catches all three directions; the proposed
second gate catches two, misses one, and fires on every ruled page.

So anisotropy is kept as a recorded signal and used only to choose between "the
phone moved" and "too blurred to read" — the two need different actions from the
student — and it decides nothing on its own.

## `enhance.test.mjs` — the rescue path

`node --test bench/enhance.test.mjs`

`src/scan/enhance.js` brings a page that arrives under the resolution floor up
to it, rather than refusing it outright. That is only acceptable because of two
properties, and an argument in a comment is not worth much, so both are checked
directly:

- **It cannot disturb the red separation.** Every operation is a per-pixel
  scalar gain on RGB, and `colour.js`'s shipping redness measure is a ratio a
  scalar cancels out of. Measured: under 1.5% drift across the whole range
  paper, faint pen and bold pen occupy, and under 1% of a real page's pixels
  move by more than 5%.
- **It cannot invent detail.** The sharpening is clamped to each pixel's own
  neighbourhood range, so no output value can fall outside what genuinely
  occurred beside it. Checked over a few hundred thousand real pixels; an
  unclamped unsharp mask fails it immediately, which is the point.

There is a third band of drift the tests pin rather than hide: below luma 15 the
epsilon guarding `redRatio`'s divide dominates and the ratio moves by several
per cent. Those pixels are ink by luma alone (`RED.INK_LUMA_MAX`), so nothing
downstream turns on it — and that test exists because the first version of this
comment claimed the drift was "well under a thousandth" everywhere, and the
measurement said otherwise.
