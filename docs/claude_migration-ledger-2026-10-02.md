# Migration ledger, reconciled — 2026-10-02

Production project `dlgcqieyevoebefhcggi`. Compared against `main` at `43117e3` plus this branch (Mrmanwonder/Axon-Site#165) and Mrmanwonder/Axon-Site#166.

## How this was checked

- **Ledger:** `supabase_migrations.schema_migrations`, which has 114 rows. It was matched to repo files by version, then by name.
- **Schema:** fingerprinted in production and in a local database built from `main`, with my five pending files left out. Both were hashed with the same queries:
  - function bodies, after stripping comments and whitespace;
  - `SECURITY DEFINER`, `search_path` and EXECUTE grants;
  - columns, constraints, indexes, triggers, RLS policies, table grants, enums, schema grants and cron jobs.
- **Result:** columns, constraints, indexes, triggers, policies, table grants, schema grants and cron match exactly. The legacy Stripe FDW `public."Subscribers"` table is the only exception, and it was already documented in `supabase/migrations/README.md`. Functions differ only in the six listed under "Live-only drift" below.

## Status of every migration that is not a plain one-to-one match

| Repo file (after this branch) | Production ledger | State | Action |
|---|---|---|---|
| `20261001164100_axo_124_model_cost_triggers` | none | **Live, unrecorded.** Functions and both triggers match. | `migration repair --status applied` |
| `20261001165344_axo_124_pipeline_integrity_columns` | `20261001165344` | Recorded, but no repo file existed. | File reconstructed verbatim from the ledger (this branch). |
| `20261001170000_axo_124_pipeline_integrity` | none | **Live, unrecorded.** `run_advance`, the sweeps, `retry_failed_explanations` and `stamp_explain_status_at` all match. | `migration repair --status applied` |
| `20261001173510_axo_105_share_loss_reasons_allowlist` | `20261001173510` | Applied. The file is in Axon-Site#166 only. | Lands on `main` when #166 merges. |
| `20261001180000_axo_116_structure_assembly` | none | **Pending.** | `db push` |
| `20261001180500_axo_124_paper_totals_follow_commit` | none | **Live, unrecorded.** `commit_extraction_run` matches; 0 papers have totals that disagree with their attempts. | `migration repair --status applied` |
| `20261001181000_axo_54_private_definer_grants` | none | **Pending.** | `db push` |
| `20261001183000_axo_57_guardian_verification_handshake` | none | **Pending.** | `db push` |
| `20261001190000_learning_schema` (#169) | none | **Live, unrecorded.** The `learning` schema, its functions, triggers, grants and cron job all match. | `migration repair --status applied` |
| `20261001191000_learning_review_signals` | none | **Pending.** It now also adds the `learning_signal_student` index the advisor asked for. | `db push` |
| `20261001202325_axo_124_cost_triggers_run_as_definer` | `20261001202325` | Applied. `main` had it as `20261002000100`. | File renamed to the ledger version (this branch). |
| `20261001204112_axo_124_no_printed_total_schema` + `…204131_…commit_and_view` | both recorded | Applied. `main` had one file, `20261002002000`. | File split at `create or replace function public.commit_extraction_run`. Each half hash-matches its ledger row (`e8ec6dc7…`, `4da537d6…`). |
| `20261002000200_axo_123_late_explanations_reach_the_card` | recorded, statement text "applied by hand in parts" | Applied. `sync_explanation_to_loss_event` and its trigger match. | None. |
| `20261002090000_reconcile_live_drift` | none | **Pending.** | `db push` |

### Live-only drift, fixed by `20261002090000_reconcile_live_drift`

- `public.ingest_reviewed_cbse_physics_2026_27(jsonb)` existed in production and in no repository. It is the one-shot, service-role-only ingest of the reviewed official CBSE 042 bundle. The migration carries it byte-for-byte, with the same grants.
- `private.enqueue_object_deletion`, `private.enqueue_paper_prefix_deletion` and `private.schedule_pipeline_tick` still use the pre-rename `mastery.*` GUC and job name; the repo uses `axon.*`. Production is internally consistent: the setter and the reader agree. The migration replaces both deletion functions in one transaction. No `mastery-tick` or `axon-tick` cron job exists.
- `private.share_loss_reasons` and `public.resolve_academic_share` come from AXO-105, which is already in the ledger. Its file is in #166.

### Ordering hazard (rehearsed)

Production will apply the five pending files *after* migrations whose versions are later (`…202325`, `…204112`, `…204131`, `…000200`). A fresh reset runs them in filename order. Both orders were run locally on 2026-10-02:

- **Production order:** a reset to merged `main` without the five files, then the five applied in order with `psql -1`, then all 41 SQL suites. Result: 41/41 pass, 0 failures.
- **Filename order:** `supabase db reset` (122 migrations), then all 41 suites. Result: 41/41 pass.

## Update 2026-10-02 ~06:00 UTC: migrate-on-merge exists now

`main` now has `.github/workflows/migrate.yml` (from #166). On each push to `main` it applies every file whose **name** the live ledger lacks, minus `supabase/migrations/BASELINE.txt`, one transaction per file.

- **Simulated against the live ledger** (now 118 rows: the other session also applied `axo_128_anonymise_telemetry_on_delete`, `axo_124_cached_rates_and_fx`, `axo_124_cost_alerts` and `axo_126_tutor_flag_and_purge`):
  - `planMigrations` returns **exactly** the five pending files below;
  - 0 unversioned ledger rows.
- The four live-but-unrecorded files are already in `BASELINE.txt`, so the `migration repair` step is no longer needed for applying. It would only make the ledger complete.
- **The workflow has failed on all 3 runs so far**, which is consistent with its "secret not set" guard. The one-time fix is the repository secret `SUPABASE_DB_URL`: Dashboard → Connect → Session pooler, `postgres` role.
- Once it's set:
  1. Run **Actions → Apply migrations → Run workflow**, with dry run on. Expect the five files.
  2. Re-run it with dry run off, or merge this PR.
- Rehearsed again on current `main` in production order: all five apply, and all 45 SQL suites pass.
- `axo_54_authority_surface` now also audits `public.tutor_enabled()` (AXO-126). It takes no arguments, reads only the caller's own flag, and has a B-vs-A test.

## Apply procedure via the CLI (alternative, BLOCKED-ON-HUMAN)

Applying through the migration tool from the agent session timed out twice on 2026-10-02, at 60 s each. Nothing was applied: the column, function and index were unchanged afterwards, there were no waiting locks, and `question_region` holds 107 rows. Writing ledger rows directly was refused by the session's permission policy. So this procedure needs a person with the database password.

From a checkout of `main` **after #165 and #166 are merged**. `db push` refuses if the remote has a version with no local file, and `…173510` is only in #166.

```bash
supabase link --project-ref dlgcqieyevoebefhcggi

# 1. Record the four live-but-unrecorded files (bookkeeping only; no SQL runs)
supabase migration repair --status applied 20261001164100 20261001170000 20261001180500 20261001190000
#    expect: "Repaired migration history: [20261001164100 …] => applied"

# 2. Local and remote should now differ by exactly five versions
supabase migration list
#    expect the Remote column empty only for 20261001180000, 20261001181000, 20261001183000,
#    20261001191000, 20261002090000

# 3. Dry run, then apply. Each file runs in its own transaction.
supabase db push --include-all --dry-run
#    expect: "Would push these migrations:" followed by exactly those five
supabase db push --include-all
```

Paste back the output of steps 2 and 3. Then the agent runs the post-checks below and the advisors.

**Post-checks (agent):**

```sql
select count(*) from pg_attribute where attrelid='public.question_region'::regclass and attname='continues_from_previous'; -- 1
select indexdef from pg_indexes where indexname='question_region_one_label_per_run';  -- contains: question_label ~ '[0-9]'
select count(*) from pg_proc where proname in ('assemble_structure','begin_guardian_verification','record_guardian_verification_callback','record_region_review'); -- 4
select has_function_privilege('anon','private.consent_is_granted(uuid,uuid,text)','execute'); -- false
select count(*) from pg_proc where prosrc ~ 'mastery\.deleting_paper|mastery-tick'; -- 0
```

**Rollback, per file:**

| File | Rollback |
|---|---|
| 116 | Recreate the old index (predicate without `~ '[0-9]'`). `create or replace` `advance_after_structure` from `20260906134509` / `main`, which is md5 `626ddab4…` live today. `drop function private.assemble_structure`. Keep the column: it is additive, and the old worker ignores it. |
| 54 | Re-grant the revoked EXECUTE and table privileges. `pg_proc.proacl` before apply is recorded in the AXO-54 Linear comment. |
| 57 | `drop function public.begin_guardian_verification, public.record_guardian_verification_callback; drop table private.guardian_verification_session;` |
| 121 delta | Drop the two triggers and functions, then the added columns, constraints and index. Re-add the `not null` on `attempt_id` only if no region-bound rows exist. |
| Reconcile | Re-run the previous production definitions (above) for the three rename functions. Keep the ingest function. |

**Deploy order after apply:** merge Mrmanwonder/axon-backend#143. Its push to `main` deploys the structure worker, which writes `continues_from_previous`. Then retry the 14-page paper.

## Advisors (baseline, before apply, 2026-10-02 05:30 UTC)

| Advisor finding | Disposition |
|---|---|
| `rls_enabled_no_policy` × 14 (learning, private, model/eval/billing tables) | Intended. These are service-role-only tables with deny-all for clients. AXO-54 also revokes their table grants. |
| `anon_security_definer_function_executable`: `resolve_academic_share` | Intended. It is the share-link resolver and the one anon RPC, pinned by `axo_54_authority_surface`. |
| `authenticated_security_definer_function_executable` × 10 | Each is in the audited allowlist in `axo_54_authority_surface.sql`, with a guardian-B-vs-A abuse case. After apply, `begin_guardian_verification` makes 11. |
| `auth_leaked_password_protection` | Dashboard toggle (human step). |
| `unindexed_foreign_keys`: `learning.signal.student_id` | Fixed in the pending `…191000` (`learning_signal_student`). |
| `unindexed_foreign_keys`: `stripe._managed_webhooks.fk_managed_webhooks_account` | Stripe-managed schema, created by the Stripe Sync integration and not ours to alter. It holds one row per webhook endpoint, so the scan cost is nil. Justified on AXO-22. |
| `unused_index` × 63 | INFO. These are low-traffic indexes on a 107-region database, so usage stats aren't meaningful yet. Revisit at scale. |

## Appendix: AXO-54 before-state (production, 2026-10-02), for rollback

**Tables.** Today each of these grants `anon` and `authenticated` full privileges (`arwdDxtm`). RLS with no policy is the only wall: `model_call`, `model_route`, `eval_run`, `eval_result`, `r2_deletion`, `stripe_event`. The rollback would be `grant all on <table> to anon, authenticated;`, which restores a weaker state. Don't do it unless the revoke itself breaks something.

**`private` SECURITY DEFINER functions with PUBLIC execute (`=X`) today:**
- `all_required_consents_granted(uuid,uuid)`
- `consent_is_granted(uuid,uuid,text)`
- `current_guardian_id()`
- `guardian_is_pro(uuid)`
- `owns_storage_student_prefix(text)`

All five also grant `authenticated`. AXO-54 keeps `authenticated` and `service_role` on them.

**Trigger functions with the default ACL (PUBLIC execute):**
- `enforce_{explanation,extraction,page,paper,student}_consent_gate`
- `enforce_student_profile_limit`
- `enqueue_{object,paper_prefix,student_prefix}_deletion`
- `snapshot_run_priority`

After AXO-54 they keep only the owner. Triggers fire as the table owner's trigger mechanism, not through an EXECUTE check on the caller, so behaviour is unchanged. The local suites prove it: consent gates, deletion enqueue and profile limit all pass.

**`anon` has no USAGE on schema `private`**, so the PUBLIC execute on these was never reachable by `anon` through PostgREST. AXO-54 closes it at a second, independent layer.
