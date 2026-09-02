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
- `supabase/tests/entitlements_and_billing.sql` — 39 assertions, all passing
  against a from-scratch migration replay (see below): free-tier depth is never
  gated on a recent paper, an old paper still lists in the library, cross-subject
  rows return zero rows to Postgres itself for a free account (not just a hidden
  UI element), the existence-only teaser is visible regardless of tier, the
  `max_student_profiles` trigger fires only from the parent-driven "add a
  student" path, and a past_due account loses Pro immediately while keeping
  everything the free tier is owed.

Verified end-to-end against a disposable local Postgres (`supabase/local/shim.sql`
harness already in the repo): all four migrations replay clean from empty, and
all four test suites (137 assertions total, including the three pre-existing
ones) pass — `rls_and_hard_rules.sql`, `extraction_pipeline.sql`,
`ingestion_prefs_erasure.sql` are unaffected by this change.

## Amendment (2026-09-02) — past_due ends Pro immediately

`20260902120000_past_due_ends_pro_immediately.sql` reverses the 7-day grace
window this pass shipped. A failed payment now ends Pro entitlement at the
moment Stripe reports it. Decided deliberately, not discovered as a bug — so
what the original migration's comments describe as the grace period no longer
holds, and `subscription_grace_until` is dropped rather than left unread.

- `private.guardian_is_pro` is still the only place the line is drawn, so all
  five gates follow it without being touched.
- `get_entitlements()` gained `billing_state` — the raw `subscription_status`,
  carried so the downgrade can be *explained* on the parent surface rather than
  appearing as an unaccountable loss of features. It is a reason code, never a
  gate.
- The webhook no longer computes a deadline in either direction: a failed
  invoice writes `past_due` on the first failure, and a successful Smart Retry
  restores Pro on the next `customer.subscription.updated`.
- Nothing already created under Pro is taken away: a second student profile
  stays (the limit trigger is INSERT-only), every paper keeps its place in the
  library, and the student's own scan → understand → act loop is unchanged. What
  lapses immediately is depth on OLD papers and the four Pro reads.

Two consequences worth naming rather than burying, both still open:

- **The parent has to be told, and there is no surface to tell them on** (open
  item 1 below). Until a parent billing screen exists, `billing_state` is
  carried but rendered nowhere, so a card that fails on Tuesday silently costs
  the account its Pro reads. Shipping this without that copy is the gap.
- **The archive-depth gate is the one downgrade a student can feel.** It is not
  a paywall in their app — nothing is upsold, no prompt fires, and the current
  term stays full-depth — but an old paper they opened last week can lose its
  per-question detail with no warning and no grace. That is the price of
  immediacy, and it argues for the parent-facing warning above landing in the
  same pass as any real launch.

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
