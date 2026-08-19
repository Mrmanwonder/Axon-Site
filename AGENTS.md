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
`__masteryOpenDisclosure`, `__masteryInsightsReady`, `__masteryRenderHome`,
`__masteryRenderInsights`, `__masteryRenderScan`, `__masteryRenderLibrary`. Add to that
list rather than reimplementing a spring or a sheet in a module — the two will drift
otherwise.

The render bridges take data and return nothing: the app layer decides *what* is true,
this file decides how it looks. Two rules they exist to hold:

- A surface with no data says so. It never falls back to the numbers this file was
  prototyped with — those read as this student's marks, which is the most confident lie
  the interface can tell.
- Which Insights view is shown is a data question (`__masteryInsightsReady`), not a tap
  affordance. It used to toggle on a second tap, which showed a populated chart to a
  student who had nothing in it.

`src/curriculum.js` is the single source for the board, the stages, the class-level
mapping and the syllabus codes. Nothing else should hardcode "CAIE", a stage name or a
four-digit code.

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

The onboarding overlay is the same trap one level down. `.obwrap` is absolute, so
`inset:0` resolves against `#obroot`'s *padding* box — padding on `#obroot` cannot
cap the column, and the overlay carries `--ob-side` per element instead, with
`.obview` reaching the same width through `.view`'s own `--vmax`. `#obroot` also
zeroes `--rail-w` and `--view-bottom`: there is no rail and no tab bar inside it,
and leaving either set pushes the column off-centre or strands it above dead space.

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

## Verifying

There's no test runner. Changes to layout, the lens or the haptics should be checked
in a real browser at phone, landscape-phone, 768px and 1024px+ widths — the lens
alignment and the sheet's height cap are the things that break silently.
