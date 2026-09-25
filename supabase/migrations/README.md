# Migrations

## Nothing applies these for you

There is no deploy-on-merge step. `.github/workflows/ci.yml` runs
`supabase db reset --local` against a throwaway database so the pgTAP suites in
`supabase/tests/` have a schema to run against, and then throws it away. The
live project is never touched by anything automatic.

**Applying a merged migration to the live project is a manual step, every
time.** If nobody does it, the migration silently never takes effect while the
code that depends on it ships anyway. `20260825170000_honest_sweep_failure_messages.sql`
merged on 2026-08-25 and was never applied — ten days dead in the tree, and by
then no longer applicable verbatim (see below).

When code *reads* a column a migration adds, there is no graceful degradation:
PostgREST rejects a select naming an unknown column, so the request fails
outright and takes the screen with it. **Apply the migration before merging the
code, not after.**

## The reconciliation (2026-09-04)

This directory previously held 26 files against the live project's 43 applied
migrations. All 19 that had no file here have been reconstructed from
`supabase_migrations.schema_migrations` and committed. Eighteen are byte-exact
after normalising comments and whitespace; the exceptions are called out below.

The matched pairs were checked too, and the headline is that **none of them
diverged in schema.** Comparing both sides under identical normalisation
(strip `--` comments, strip whitespace, lowercase), 20 of 25 hash-match
exactly. The six that do not — `identity_and_consent`, `academic_model`,
`rls_and_analytics`, `preferences_and_erasure`, `r2_and_runtime`,
`pipeline_runtime` — differ only inside `comment on ...` string literals:
reworded prose, and the `mastery` → `axon` rename that reached the repo but not
the database. No DDL, no policy, no function body differs.

An earlier note claimed `entitlements_and_billing` had divergent content
because the file is 18,563 bytes and the stored statement 12,986 characters.
It does not; that gap is comments and whitespace, and it hash-matches exactly.

Three reconstructed files are deliberately **not** verbatim, each for a reason
recorded in its own header:

- `20260810130016_enable_rls_with_owner_policies.sql` — a documented no-op. Its
  real body enables RLS on sixteen tables of an abandoned study-planner schema
  that no migration here creates and that the next migration drops. Replayed
  verbatim it is the first statement of `db reset` and it fails.
- `20260826073407_phase3_2_security_hardening.sql` and
  `20260901050006_revoke_subscribers_public_access.sql` — the Stripe FDW
  statements are wrapped in existence guards. `public."Subscribers"` and the
  `stripe` schema come from a dashboard-configured wrapper that no migration
  here creates, so unguarded they fail a fresh reset. Where they exist the
  behaviour is unchanged, and production has already run both.

## Parity audit (2026-09-23)

A fresh repo-vs-live audit found six migration names in `main` that were not
recorded in the live migration ledger:

- `frontend_atomic_mutations`
- `atomic_student_profile_edit`
- `parent_mode_requires_interactive_amr`
- `reassert_consent_parent_mode_policy`
- `billing_fields_are_server_authored`
- `extraction_priority_is_server_authored`

This was not just bookkeeping drift. The first migration's table, 62-row
curriculum catalog, RLS policy, grants and two RPCs were already live, and the
consent policy was already in its intended form, but other effects were missing
or stale: `update_student_profile` did not exist, `auth_age()` still accepted
background AMR entries, the billing guard omitted `subscription_grace_until`,
and the extraction-priority immutability trigger did not exist.

The audit reconciled the already-live first migration only after checking its
objects, row count, RLS and grants, then applied the remaining migrations and
verified their concrete schema effects. Supabase MCP originally stamped these
with their application time. The repository filenames were reconciled to those
production versions on 2026-09-25 so previews, fresh resets, and the production
ledger now compare by the same version and name.

The live ledger also contains `sweep_dead_letters_discovers_queues`. Its final
queue-discovery behavior is folded into
`20260904113038_honest_sweep_messages_for_real.sql`, the replayable
consolidated migration produced by the 2026-09-04 reconciliation. The matching
`20260904113950_sweep_dead_letters_discovers_queues.sql` file is therefore a
documented no-op ledger marker: replaying the older production function body
would discard the consolidated page-status reset behavior.

The same audit ran Supabase's security advisor. It found
`paper_canonical_run` executing with view-owner rights over an RLS-protected
base table and two private helpers with mutable search paths. The live database
was hardened first, and
`20260923061333_supabase_advisor_security_hardening.sql` records the exact
change for fresh environments.

## What this directory still is not

Reconciled is not the same as authoritative. Two things are still true:

1. **The Stripe FDW is not in the migration history.** `public."Subscribers"`
   and the `stripe` schema exist in production and are created by nothing here.
2. **The production ledger records historical application order.** Local files
   use those exact versions now. Do not rename a migration after it is applied;
   add a forward migration instead.

## Applying one

```sh
supabase db push --project-ref dlgcqieyevoebefhcggi
```

Then confirm by querying the live project for the thing the migration was
supposed to create — a table, a column, a function body. `db push` reporting
success is not the same as the change being there, and "assumed applied" has
been wrong more than once.
