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
| `capture.test.mjs` | The steadiness window and the shutter decision, as pure functions |
| `probe.html` | One page through conditioning, with the intermediate stages visible |
| `detect.html` | Quad detection on the real fixtures below, with the quad drawn over each one — the visual version of `golden.test.mjs` |
| `golden.test.mjs` | The same fixtures, as an actual CI check — see below |
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
