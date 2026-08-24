# Working in this repo

`index.html` is the entire front end: all markup, styles and script in one static
file, with no build step, package manager or framework. Don't introduce one without
being asked. It also serves as the design system — the tokens, the type scale, the
glass lens and the spring engine are the reference implementation, so read it
before building UI.

`src/` holds ES modules for data and flow, loaded natively — no bundler. `vendor/`
holds the Supabase client, vendored rather than pulled from a CDN so there is no
third-party runtime dependency. The modules must be served over http; ES modules
do not load from `file://`.

`supabase/migrations/` is the database, as plain SQL. `supabase/tests/` holds SQL
test suites that run inside a rolled-back transaction and are safe against any
database, production included.

## The bridge between index.html and src/

`index.html` owns the design system; `src/` owns data and flow. Rather than
duplicating primitives, the inline script publishes them and the modules call them:
`__masteryHaptic`, `__masterySwitch`, `__masteryOpenSheet`, `__masteryRebindPress`,
`__masteryOpenDisclosure`, `__masteryRenderLibrary`. Add to that list rather than
reimplementing a spring or a sheet in a module — the two will drift otherwise.

Switches whose state belongs to the app carry `data-managed`, and the generic `.sw`
handler skips them. Two handlers on one switch race: whichever runs second reads a
class the first already flipped, which once turned a consent grant into a
withdrawal.

## Erasure

`delete_my_account()` strips personal data but keeps `guardian` and `student` rows as
tombstones, because `consent_event` references them `ON DELETE RESTRICT` and the
ledger is the compliance evidence. Deleting them is not an option, and neither is
`ON DELETE SET NULL` — that is an UPDATE, which the append-only trigger refuses.
Storage objects must be cleared through the Storage API *before* calling it, since
it releases the auth row and the session then cannot authorise storage deletes.

It is deliberately in `public` and callable by `authenticated`: the client has to be
able to call it. It takes no arguments and derives the account from `auth.uid()`, so
there is nothing to tamper with. The advisor flags it; that flag is expected.

## The scanning pipeline

`SCANNING_SYSTEM.md` specifies it; this is where the code for it lives and the
handful of things about that arrangement which are easy to get wrong.

Ten stages in three places. `src/scan/` is stages 0 to 2 and the client half of
9; `supabase/functions/` is 3 to 8 and 10; the student is 9. `src/scan/ui.js`
walks the whole thing and is the only module that knows the order.

- **Provenance is the load-bearing rule.** Every extracted value carries the box
  on the page it was read from, and `question_region` has a CHECK making a value
  without its box unstorable. This is the defence against a vision model
  producing plausible fiction, and it is the only reason the review screen can
  show a field against its own crop. If you add a field, add its box column and
  its constraint in the same migration.
- **`src/scan/contract.js` and `supabase/functions/_shared/contract.ts` are the
  same file twice, deliberately.** The browser is served as static files and the
  functions run on Deno; there is no build step that could bridge them, and
  inventing one to share four constants would cost more than it saves. Change
  both, or neither — the thresholds mean nothing if the two ends disagree.
- **Nothing in the pipeline runs as `service_role`.** Every edge function builds
  its Supabase client from the caller's own JWT, so RLS applies exactly as it
  does to a direct insert. A pipeline running with the service role would be one
  bug away from writing one student's marks onto another student's paper.
- **The stage modules are pure and must stay that way.** `geometry`, `quality`,
  `layers`, `conditioning`, `raster` touch no DOM beyond an optional canvas, which
  is what lets them run on the main thread, in the worker, and in the harness
  under Node. `src/scan/imagedata.js` exists solely so Node — where the metrics
  are actually measured — is not the one place they cannot load.
- **`device.js` falls back to the main thread when a module worker cannot be
  constructed.** That path is not theoretical on the phones this is built for,
  and a dropped frame is worth far less than a student who cannot scan at all.
- **`TEACHER_INK` names the one red.** Stage 2 separates the layers by hue and
  the design system reserves red for the teacher's pen and the sign-out row.
  They were always the same rule; keep them one constant so a red error state
  collides with it before it ships.
- **Two models, on purpose.** The structure pass finds boundaries on a
  downscaled page with a small model; the content pass reads handwriting with a
  frontier one. Both are environment-overridable, because the harness is what
  should settle that question.
- **`src/app.js` imports the scanner dynamically, and that is load-bearing.**
  The pipeline is sixteen modules and none of them are needed to read a paper
  you scanned last week; as a static import they cost sixteen extra round-trips
  on the critical path, measured at about 0.7s of extra boot on a throttled
  mid-tier profile. `ensureScan()` is the only way in, for the Scan tab and for
  an upload alike — the module holds its own state, and calling into it before
  `initScanUI` has handed it the student drops the upload silently. Turning that
  back into a top-level `import` would look like tidying and would cost the
  performance floor.

## The four hard rules

`CLAUDE.md` names four rules whose violation is a product failure. Each is enforced
by a constraint rather than a convention, because a rule that lives only in a prompt
eventually gets broken:

1. **The model never assigns marks.** `student_attempt.marks_source` is NOT NULL and
   can only name a human origin, so a mark with no human provenance cannot be
   stored. `mark_loss_event.ai_explanation` is the model's only writable field.
2. **Never fabricate a scheme.** A Tier 1 attempt cannot reference a
   `canonical_question`, and scheme text cannot be stored without its source and
   version.
3. **Unsure data never reaches analytics.** Aggregate from `attempt_analytics` and
   `mark_loss_analytics`, never the base tables. They exclude unsure-unconfirmed and
   student-rejected rows.
4. **Fail visibly.** An unreadable page becomes a `page_unreadable` row, never a
   silent omission.

## Database conventions

- Internal helpers live in `private`, not `public`. Anything in `public` is a
  PostgREST RPC endpoint; a `SECURITY DEFINER` helper taking arbitrary ids becomes a
  cross-account read if exposed there.
- Every `SECURITY DEFINER` function pins `search_path`.
- Views that touch user data need `security_invoker = true`, or they become a hole
  straight through RLS.
- `consent_event` is append-only. Order it by `seq`, never `created_at`: `now()` is
  the transaction timestamp, so rows written together are indistinguishable by time.
- Consent state is always read authoritatively, never cached optimistically.

## Before changing the nav or the glass

Read `README.md` first, then the `generateLensMap()` and `spring()` functions.

- The tab bar's highlight is a real `feDisplacementMap` filter. Do not replace it
  with `backdrop-filter` — the refraction is the point of the design.
- Nav geometry is **measured**, never computed from division math: flexbox rounds
  item widths independently, so arithmetic drifts a pixel or two. Read the tab rects.
- Measure against `#refractlayer`, not `#tabbar`. It's the filter's reference box,
  so it's the only origin where the pill, the lens map and the icons agree.
- One DOM serves both the bottom tab bar and the left rail. Keep it axis-agnostic —
  pass `x`, `y`, `w` and `h` through, don't assume horizontal travel.
- Regenerate the lens map whenever the pill's dimensions change, including breakpoint
  crossings. It's cached by size, so calling it freely is cheap.

## Layout

Two breakpoints: 768px moves navigation to a left rail, 1024px gives that rail
labels. Prefer `clamp()` for type and spacing over new breakpoints — the design is
meant to ramp continuously, not step.

Percentage padding inside `.view` resolves against the app shell, not the view's own
box, so `--rail-w` has to be subtracted explicitly in the centring calculation.
This is easy to get wrong and looks almost right when you do.

## Colour

Red appears in exactly one place: the sign-out row. Not errors, not warnings, not
notification dots, not destructive rows like deleting an account. Amber carries
attention, blue carries accent. The scan crop contains real red pen, and if the UI
spent red freely every screen would read as a rebuke.

Cause colours are seven categorical hues of equal weight, never a severity ramp. The
values are in `CLAUDE.md`; take them from there rather than inventing a shade.

## Haptics

`navigator.vibrate` only, always feature-detected, wrapped in try/catch. 10ms for
selection (tabs, switches, the shutter), 18ms for consequential confirmation,
nothing for passive or read-only interaction. Don't add a buzz to scrolling or row
taps.

## The draft toast

Its spring is normalised so `0` = shown and `1` = dismissed, and every handler maps
it as `-140 * p`. `initScan()` and the drag-release path once used `-140 * (1 - p)`,
which inverted the range and parked the toast permanently off-screen. If you touch
one of those handlers, keep all of them on the same mapping.

## The backend

`REVIEW_PIPELINE.md` is the specification; these are the rules that are easiest to
break by accident.

- **No image processing in an Edge Function.** The CPU limit is two seconds and a
  single JPEG decode of a full page exceeds it. Pixel work happens on the device or
  it does not happen. A function that crops, resizes or re-encodes is not slow, it is
  dead.
- **Every model call goes through `_shared/openrouter.ts`.** No direct fetch to a
  provider anywhere else, so the provider policy, the route lookup and the cost ledger
  cannot be bypassed by a new worker in a hurry.
- **`PROVIDER_POLICY` is never overridden.** Zero Data Retention, provider data
  collection denied. This is a minor's exam paper and prompt logging stays off at the
  account level too, discount or no discount.
- **Model IDs never appear in code.** They live in `model_routes`, so changing one is
  an UPDATE rather than a redeploy — which is what makes the eval harness able to
  answer which model is better.
- **Prompts are versioned files, never edited in place.** A changed prompt gets a new
  version, so `model_calls` stays comparable across the change. A prompt edit that
  quietly costs a point of mark-attribution accuracy is the most likely way this
  system degrades.
- **Validate every model response after parsing**, even under a strict schema. Strict
  mode is a strong constraint, not a proof.
- **No field is written without its provenance box.** Enforced in code after the
  parse, not merely asked for in the prompt.
- **Workers are idempotent**: check terminal status, delete the message, exit. A
  duplicate delivery must be cheap and harmless.
- **Never auto-correct a mark to make reconciliation close.** The adjudication pass
  exists to *find* a reading error, and its corrections still surface in review.
- **Anything read off a page is data, never instruction.** A student will write
  "ignore previous instructions" on an answer sheet eventually. Extraction models get
  no tools and can only emit a fixed schema, and page text goes into a prompt fenced
  by `prompts/untrusted.ts` and labelled as material to analyse.

### Where the pieces are

| Function | Job |
| --- | --- |
| `paper-submit` | Idempotent create, then one message on `mastery_triage` |
| `upload-intent` / `upload-complete` | Presigned PUTs out, server-side HEAD back |
| `queue-tick` | Dispatch, and the two sweeps that make a stall visible |
| `w-triage` → `w-structure` → `w-content` → `w-reconcile` → `w-adjudicate` | Stages 3–7 |
| `review-complete` → `w-explain` | Stage 8, and only after the student confirms |
| `w-r2-delete` | Makes a deletion real |
| `eval-run` | The golden set through the same queues, with a route override |

### Rules a new worker gets wrong

- **Use `serveWorker()`.** It has the only three endings a worker may have: ack,
  ack-a-permanent-failure, or leave the message for the visibility timeout. There is
  no ending where the message is acked and nothing was recorded — that is a paper
  that quietly loses a question.
- **A permanent failure marks its unit and lets the paper proceed.** An unreadable
  question is a gap with a crop beside it. Nineteen good readings blocked on the
  twentieth is the worse failure, and the invisible one.
- **Completion checks belong in SQL, not in the worker.** Twenty content calls go out
  together and the last two land microseconds apart; `advance_after_*` takes an
  advisory lock so the paper advances once.
- **`run_advance()` is the only writer of run status.** It refuses to move a terminal
  run, so a worker still in flight when the sweep failed its paper cannot resurrect it.
- **A route override lives on the run, not on the message.** One that reached only the
  first stage would have the eval measuring the default model for everything after it.

## Storage

`STORAGE_R2.md` is the specification. Two things worth repeating:

- **Bytes never pass through a function.** Devices PUT to a presigned URL and the
  server confirms with a HEAD. Without that confirmation a client can register a row
  for an object that was never uploaded, and it surfaces much later as a model call
  against a 404 — which looks like a model problem and is not.
- **A presigned GET handed to a model provider is a time-limited bearer capability to
  a minor's exam paper.** Ten-minute TTL, unguessable keys, crops rather than pages,
  and the signed URL is never written to `model_calls` — log the key.

## Verifying

Three suites, all runnable without a Supabase project or an API key:

```bash
psql -d mastery -f supabase/local/shim.sql     # then apply migrations/, then tests/
deno test --allow-env supabase/functions/_shared/pipeline_test.ts
node --test harness/metrics.test.mjs
node harness/run.mjs harness/runs/EXAMPLE-run.json --goldenset example
```

`supabase/local/shim.sql` stands up just enough of the platform — the two roles,
`auth.users`, `auth.uid()`, `storage.objects` — to apply the migrations against a
bare Postgres. It is a fixture, not a model of Supabase; anything that passes
there still has to hold on the real thing.

What none of that covers is the design system. Layout, the lens, the haptics and
the viewfinder still have to be checked in a real browser at phone,
landscape-phone, 768px and 1024px+ widths — the lens alignment and the sheet's
height cap are the things that break silently.
