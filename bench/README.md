# bench/

Measurement, not tests. These answer questions where the honest answer is a
number and the tempting answer is an opinion.

| What | Run it |
| --- | --- |
| `bench.html` | Device pipeline timing — conditioning, layer separation, the whole stage 0–2 leg |
| `chroma.html` | How much of the teacher's ink each encoder destroys |
| `viewfinder.html` + `viewfinder.mjs` | The real capture controller against a page-on-a-desk scene streamed from a canvas |
| `capture.test.mjs` | The steadiness window and the shutter decision, as pure functions |
| `probe.html` | One page through conditioning, with the intermediate stages visible |

Serve the repo and open them, or drive them with Playwright:

```bash
python3 -m http.server 8765 &
PLAYWRIGHT_HOME=/path/with/node_modules node bench/viewfinder.mjs
node --test bench/capture.test.mjs
```

Playwright is not vendored — there is no `package.json` and `AGENTS.md` keeps it
that way. Point `PLAYWRIGHT_HOME` at an install you already have.

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
