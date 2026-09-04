## What this changes

<!-- What moved, and why. The reasoning belongs here, not only in the commits. -->

## Verification

<!-- What you actually ran, and what it said. "Should work" is not verification. -->

## Database migrations

<!-- Delete this whole section if the PR does not touch supabase/migrations/. -->

**A merged migration does not reach the database on its own.** Nothing in CI
applies one. `supabase db reset --local` in `ci.yml` builds a throwaway database
to run the pgTAP suites against and then destroys it; the live project is never
touched by anything automated.

This has already cost us twice:

- `20260825170000_honest_sweep_failure_messages.sql` merged on 2026-08-25 and
  has still never been applied. `private.run_pages_stored` does not exist in
  production and both sweep functions still carry the old messages.
- The two migrations in #33 shipped with code that depended on them and sat
  unapplied until someone tested the feature and found it inert.

So, before merging:

- [ ] Applied to the live project, and confirmed by querying it — not by
      assuming the merge did it.
- [ ] If the code in this PR **reads** anything the migration adds, the
      migration went in **first**. PostgREST errors on an unknown column, so a
      select naming a column that does not exist yet does not degrade — it takes
      the whole screen down.
