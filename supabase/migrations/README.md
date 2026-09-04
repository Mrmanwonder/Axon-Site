# Migrations

## Nothing applies these for you

There is no deploy-on-merge step. `.github/workflows/ci.yml` runs
`supabase db reset --local` against a throwaway database so the pgTAP suites in
`supabase/tests/` have a schema to run against, and then throws it away. The
live project is never touched by anything automatic.

**Applying a merged migration to the live project is a manual step, every
time.** If nobody does it, the migration silently never takes effect while the
code that depends on it ships anyway.

That is not hypothetical. Two instances, both real:

- **`20260825170000_honest_sweep_failure_messages.sql`** merged on 2026-08-25
  and has never been applied. As of 2026-09-04 `private.run_pages_stored` does
  not exist in the live project and both `private.sweep_dead_letters` and
  `private.sweep_stuck_runs` still carry the messages that migration was written
  to replace. It has been dead in the tree for ten days.
- **The two migrations from #33** shipped alongside code that needed them and
  stayed unapplied until someone tested the feature and found it inert.

The second one is the shape to fear most. When code *reads* a column a migration
adds, there is no graceful degradation: PostgREST rejects a select naming an
unknown column, so the request fails outright and takes the screen with it.
**Apply the migration before merging the code, not after.**

## The repository is not the schema

As of 2026-09-04 the live project has 43 applied migrations and this directory
has 26. Twenty were applied to production and have no file here at all:

```
apply_region_confidence_rpc                        model_call_error_detail
cloudflare_queue_fanout                            phase3_2_security_hardening
crop_functions_revoke_direct_grants                phase3_3_missing_fk_indexes
crop_stage_enum_and_status                         restrict_apply_region_confidence_to_service_role
crop_stage_feature_flag                            restrict_apply_region_confidence_to_service_role_v2
crop_stage_functions                               revoke_subscribers_public_access
document_service_role_only_tables                  submit_paper_accept_existing_draft
drop_legacy_planner_schema                         sweep_covers_crop
enable_rls_with_owner_policies                     sweep_resets_done_pages_too
harden_helpers_into_private_schema*                sweep_resets_done_pages_too_fix
```

<sub>* this one is only a filename difference — it is `20260810180400_harden_helpers.sql` here.</sub>

Two consequences worth being clear-eyed about:

1. **`supabase db reset --local` does not reproduce production.** The pgTAP
   suites run against a schema missing the crop stage, several security
   hardening passes, and the FK indexes. A suite passing in CI is weaker
   evidence than it looks.
2. **A rebuild from this directory would not produce the live database.** This
   directory cannot currently be treated as the source of truth for the schema.

Reconciling that — pulling the applied definitions back into files — is real
work and has not been done. It is worth doing before wiring up any automated
deploy, because a parity check added today would fail on all twenty from its
first run and be switched off within a day.

Versions also drift: migrations applied through the Supabase MCP's
`apply_migration` are stamped with the time they were *applied*, not the
filename here, so `supabase migration list` shows different version numbers on
each side for the same migration. Harmless on its own, and not worth renaming
files over while the gap above is the real problem.

## Applying one

```sh
supabase db push --project-ref dlgcqieyevoebefhcggi
```

Then confirm by querying the live project for the thing the migration was
supposed to create — a table, a column, a function body. `db push` reporting
success is not the same as the change being there, and the whole reason this
file exists is that "assumed applied" has been wrong twice.
