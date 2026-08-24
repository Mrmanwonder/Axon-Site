# UX & monetization thesis — implementation notes and open items

Companion to `UX_AND_MONETIZATION_THESIS.md`. Per that workstream's instructions
("file discrepancies as issues rather than quietly patching around them"), this
records what this pass built, what it verified was already true of the existing
build, and what is still open — rather than claiming a full UI rebuild that
didn't happen.

## What this pass built

The **entitlements and billing backbone** — the part of the thesis with a
literal, checkable spec (Parts 1 and 5 of the workstream instructions):

- `supabase/migrations/20260821100000_entitlements_and_billing.sql` — subscription
  state on `guardian`, `public.get_entitlements()`, `public.get_cross_subject_signal()`,
  `pattern_insight`, `parent_progress_report`, `stripe_event`, and every gate as
  an RLS policy or CHECK constraint rather than a client-side flag.
- `supabase/functions/stripe-webhook`, `billing-checkout`, `billing-portal` —
  Checkout + Customer Portal only, no custom card form, Stripe Tax left on so
  GST and other jurisdictions resolve correctly.
- `supabase/functions/patterns` — the cross-paper detector from Part 2.4/§3:
  runs the same way regardless of tier, writes a `single_subject` row (always
  free) and a `cross_subject` row (Pro-gated on read, never on write) from a
  fixed template, never a model call — nothing here can violate hard rule 1
  because there is no model output in the path.
- `src/entitlements.js`, `src/billing.js` — thin client wrappers. Load-bearing
  comment in both: entitlements gate nothing by themselves (RLS does), and
  `billing.js` exists to be imported only from a parent surface.
- `supabase/tests/entitlements_and_billing.sql` — 28 assertions, all passing
  against a from-scratch migration replay (see below): free-tier depth is never
  gated on a recent paper, an old paper still lists in the library, cross-subject
  rows return zero rows to Postgres itself for a free account (not just a hidden
  UI element), the existence-only teaser is visible regardless of tier, the
  `max_student_profiles` trigger fires only from the parent-driven "add a
  student" path, and the past_due grace period holds and then expires correctly.

Verified end-to-end against a disposable local Postgres (`supabase/local/shim.sql`
harness already in the repo): all four migrations replay clean from empty, and
all four test suites (137 assertions total, including the three pre-existing
ones) pass — `rls_and_hard_rules.sql`, `extraction_pipeline.sql`,
`ingestion_prefs_erasure.sql` are unaffected by this change.

## Non-negotiables — how the schema itself holds them

- **Free is never a demo.** There is no tier check anywhere near
  `student_attempt`/`mark_loss_event` *writes*, and the only *read* restriction
  added is time-windowed (`in_free_archive_window`), never per-paper — a
  freshly scanned paper is full-depth free the moment it's scanned, forever.
  Asserted directly in the test suite ("NOTHING is gated on the recent paper").
- **Pro gates depth-over-time.** Every Pro flag in `get_entitlements()`
  (`cross_subject_patterns`, `full_historical_archive`, `parent_progress_reports`,
  `priority_processing`) is structurally a multi-paper/multi-subject/multi-term
  question. None of them is "a better version" of anything free — same detector,
  same template, different SELECT policy.
- **The paywall is never mid-session.** `student_profile_limit` fires only from
  the "add a student" insert (a parent-account action by construction — students
  aren't auth principals at all), and `cross_subject_signal`/`pattern_insight`
  carry no UI of their own; whichever screen renders them decides that, which is
  the next section's open item.
- **No dark patterns / no gamification.** Nothing built here has a countdown,
  a fake-scarcity string, or a pre-checked toggle — there's no UI in this pass
  to have one. The cancellation path is Stripe's own Customer Portal, which
  this repo does not customize beyond branding.

## Open items — not built in this pass, flagged rather than skipped silently

1. **No parent billing/account UI exists yet.** `index.html` currently has a
   Settings screen with one parent-facing toggle (weekly digest) and no
   dashboard, no plan/pricing surface, no "Upgrade" entry point, no
   cross-subject-teaser render, no progress-report view. `src/billing.js` and
   `src/entitlements.js` are ready to be called from such a screen, but that
   screen is genuinely new UI work this pass did not attempt — building it
   inside the single `index.html` design-system file without a design pass
   risks exactly the "reaching for a common default" trap CLAUDE.md warns
   against for paywall-shaped screens. Recommend a dedicated pass once this
   backend is reviewed.
2. **The `patterns` edge function is not wired into the pipeline yet.** Nothing
   currently calls it after a paper commits. It needs a call site in
   `src/scan/ui.js` (or wherever `finalize()`/`explainQuestion()` are awaited)
   once the paper's extraction run reaches `committed`.
3. **150-day free-archive window is an inferred constant**, not sourced from
   the thesis (which names "current term" but not a day count) or from any
   real CBSE term calendar in this codebase. Flagged in the migration's own
   comment; revisit once term-boundary data exists rather than trusting the
   guess in production pricing decisions.
4. **`priority_processing` is a snapshot column with no queue behind it.**
   `extraction_run.priority` is set correctly at run creation, but there is no
   worker or queue in this codebase that currently reads it — the scanning
   pipeline runs synchronously per-request today. Wiring it in is out of scope
   until a queue exists to prioritize against.
5. **Stripe Portal branding/dark-mode config, tax-inclusive pricing display,
   and the Stripe CLI webhook test suite** are Dashboard/ops configuration per
   workstream §5, not code — nothing to build here, but noting they are not
   done and must happen before enabling billing in production.

## Anti-gamification / tone audit against the existing build

Spot-checked, not exhaustive: `index.html` already has no streak, badge, XP,
leaderboard, or confetti UI (`grep` for those terms turns up only an unrelated
`.badge` notification dot and an explicit Settings note: *"Notifications report
state. There are no streak reminders or return nudges."*). Red (`--red`) is used
in exactly two places — the teacher's ink layer and the sign-out row — matching
CLAUDE.md's rule already. Capture already does auto-capture-on-stability with
real-time in-frame feedback (`src/scan/capture.js`), not a manual-shutter primary
path. This is worth stating plainly: **the existing build was already largely
aligned with this thesis before this pass**, which is why this pass focused on
the one part of the thesis that had no prior implementation at all — billing.
