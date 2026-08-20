# Mastery

A responsive web app that shows a student exactly where their marks go — built from
the original single-file device-frame prototype, now a real site rather than a
scaled-down phone mockup.

`index.html` is the front end and the design system. `src/` holds ES modules for data
and flow; `vendor/` holds the Supabase client. No bundler, no framework, no install.

It must be **served**, not opened as a file — ES modules do not load over `file://`.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## What works

- **Auth** — email or phone OTP, no passwords, no social sign-in. Only the guardian
  holds credentials; the student is a profile under that session.
- **Onboarding** — the eight steps in order, with the legally load-bearing ones
  enforced: no student data before consent, consent itemised per purpose with optional
  purposes off, payment after consent.
- **Guardian verification** — a swappable adapter. The development stub is wired;
  DigiLocker is the intended production adapter and needs a server-side token
  exchange. Only a reference and a timestamp are ever stored.
- **Settings** — appearance, text size, reduce motion, reasoning, and notification
  switches all persist. The weekly-digest and improve-extraction switches write to the
  consent ledger instead of preferences, so turning one off is a recorded withdrawal.
- **Capture** — a live viewfinder with page-edge detection, auto-capture when the page
  holds still, glare blocking, and a per-page quality verdict delivered while the paper
  is still in front of the student. Pages accumulate in a reorderable tray and are
  written to IndexedDB before anything uploads, so an interrupted booklet resumes at the
  first page that has not landed.
- **Ingestion** — upload from the gallery or files, or paste a link. Uploads take the
  same road as captures rather than bypassing conditioning. The paper type is asked once
  because it decides Tier 1 vs Tier 2.
- **The pipeline** — the ten stages of `SCANNING_SYSTEM.md`: conditioning and red-layer
  separation on device, then structure, content, mark attribution, reconciliation, tier
  routing and explanation server-side, then review, then commit.
- **Review** — required, not skippable, with unreadable and unsure questions first and
  every field shown against its own crop.
- **Data export and account deletion**, both from Settings.

## What does not work yet

**The golden set.** Twenty real marked papers, hand-labelled — see `harness/README.md`.
The harness runs and both gates are enforced, but until there are papers in it, nothing
about the pipeline's accuracy is known rather than assumed. Neither gate has been met,
because neither has been measured.

**PDFs.** They reach storage but are not rasterised, so nothing reads them, and the app
says so rather than accepting a file it cannot use. Photographs of the pages work.

**Links** are stored `pending`: a browser cannot fetch a cross-origin PDF and hand over
the bytes, so a server-side fetcher has to resolve them.

**The Tier 2 scheme library is empty.** Every paper falls back to Tier 1 and says so,
which is the correct behaviour with no scheme held — an approximated scheme would be a
fabricated authority and worse than none. Matching is by question text and deliberately
strict; matching on the paper code would be far better and needs the code extracted at
stage 3.

**The container question is open.** `SCANNING_SYSTEM.md` §3 recommends wrapping the app
in Capacitor and using the native document scanner for capture. What is built is the
pure-web alternative that document names as the honest fallback. Nothing below stage 0
depends on the answer.

## The pipeline, in short

Ten stages across three places. The device conditions each page and separates the
teacher's red ink from the student's writing before anything is uploaded — mobile data
is the binding constraint on time-to-result far more often than server compute is, and
the red mask is a map of every teacher mark on the page for the price of no model calls
at all. The server then finds the questions on downscaled proxies with a small model,
reads each question from its own crop with a frontier one, binds the marks to the
questions, and checks the arithmetic against the total the teacher wrote.

That last check is what lets the system know when it is wrong. If the per-question
marks sum to the reported total, the reading is very unlikely to be wrong in a way that
matters; if they do not, it is wrong somewhere, and the size of the gap narrows where.
Nothing anywhere adjusts a mark to close that gap.

Every extracted value carries the box on the page it was read from, and a value without
one cannot be stored. That is what makes the review screen possible: every field is
shown against the pixels it came from, and the student decides.

## Running the checks

```bash
psql -d mastery -f supabase/local/shim.sql     # then migrations/, then tests/
deno test --allow-env supabase/functions/_shared/pipeline_test.ts
node --test harness/metrics.test.mjs
node harness/run.mjs harness/runs/EXAMPLE-run.json --goldenset example
```

No Supabase project and no API key needed for any of them.

## Deploying

`netlify.toml` copies `index.html`, `src/` and `vendor/` into `dist/` and publishes
that. The publish directory is explicit rather than the repo root, so the Constitution
specs, the blueprint and the design reference images stay out of the deployed site.

There is nothing to install — no `package.json`, no framework, no build step beyond
the copy.

The four edge functions in `supabase/functions/` deploy separately and need
`ANTHROPIC_API_KEY` set on the project. `MASTERY_MODEL_STRUCTURE`,
`MASTERY_MODEL_CONTENT` and `MASTERY_MODEL_EXPLANATION` override the models per stage;
the defaults are a small model for finding boundaries and a frontier one for reading
handwriting, which is the cost lever `SCANNING_SYSTEM.md` §15 names.

The Supabase publishable key is committed in `src/config.js` on purpose. It carries no
authority: every table has RLS with no policy for `anon`, so the key alone reaches
nothing, and it is the signed-in session that grants access.

## Typography

Onest is embedded in the document as a base64 `woff2` (the latin variable subset,
covering 400–700 in one 32KB file). Self-hosting it removes two external requests
and a render-blocking stylesheet, so the real face paints on the first frame with
no fallback flash — and the page renders correctly with no network at all.

## Layout

| Viewport | Navigation | Content |
| --- | --- | --- |
| `< 768px` | Floating glass tab bar, bottom | Single column |
| `≥ 768px` | Persistent left rail, icons only (76px) | Home two-up, Insights in 2 columns |
| `≥ 1024px` | Same rail with labels (216px) | Content column caps and centres |

Between those points, type and spacing scale continuously with `clamp()` — the
gutter, heading sizes, insight headline and card radius all ramp with the viewport
rather than snapping at a breakpoint, so the two layouts read as one design.

Library rows stay single-column at every width; they're already dense, and a second
column would only shorten each row's usable text.

## The glass and the physics

Both are carried over from the prototype intact, not re-approximated.

**The lens.** The tab bar's highlight is a real `feDisplacementMap`, not a
`backdrop-filter`. `generateLensMap()` renders a signed-distance normal map to a
canvas and feeds it to the filter as a data URI, so the pill genuinely refracts the
content behind it. The nav is one DOM subtree in both orientations, and every
coordinate — `x`, `y`, `width`, `height` — comes from measuring the real tab rects,
which is what lets the same code drive a horizontal tab bar and a vertical rail.
The map is regenerated on resize and on every breakpoint crossing, then cached by
size so a resize storm doesn't rebuild an identical canvas each frame.

Measurements are taken against `#refractlayer`, the filter's own reference box, so
the pill, the displacement map and the icons all share one origin.

**The springs.** `spring()` is the original velocity-integrating solver. Press
states, the pill glide, switch thumbs and sheet transitions all run through it. The
pill's squash-stretch follows the axis of travel — horizontal in the tab bar,
vertical in the rail.

## Haptics

`navigator.vibrate`, weighted to the interaction, feature-detected and silent where
unsupported (which is every desktop browser):

- **10ms tick** — tab bar selection, settings switch toggles, camera shutter
- **18ms pulse** — confirming something consequential: the board/class warning
  sheet's primary button, and *Confirm & save to Library*

Deliberately silent on scrolling, row taps, filter chips, disclosure toggles, and
the lightweight link/upload confirmations that share the warning sheet's markup.
The tick is bound to the tab elements rather than to `pick()`, so programmatic
navigation doesn't buzz.

## Themes

Dark and light are equal first-class modes, defined as custom properties on the root
element. Switch via Appearance in Settings (Light / Dark / System) or the corner
button. `prefers-reduced-motion` collapses transitions.
