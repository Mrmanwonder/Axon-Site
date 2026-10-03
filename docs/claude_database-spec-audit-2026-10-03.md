# Axon database specification audit — 2026-10-03

Scope: adopted `claude_linear-agent-spec-2026-10-03.md`, WP-I/WP-H/WP-Q and database dependencies of WP-C/WP-E/WP-M. Production project `dlgcqieyevoebefhcggi`; canonical Site head `191e3057427b58a0284e76802512b47b96aaf5ec` (#186). Read-only production catalog, aggregates, function definitions and advisors; GitHub source/CI; full issue descriptions/comments reviewed. No production schema or data mutation, synthetic student, borrowed JWT, account deletion, retry, mint/revoke or manufactured acceptance evidence.

## Result

Migration **identity parity** is exact: 128 canonical SQL files and 128 ledger rows, one-to-one name multiset match, zero missing/extra names. Important object checks pass for AXO-54 hardening, AXO-105 sharing, AXO-116 structure assembly, learning and telemetry anonymisation. **Schema-effect parity is not fully complete:** the live `commit_extraction_run` definition has regressed to the older paper-totals body and no longer writes `total_basis` or `total_partial`, even though the later no-printed-total migration is recorded. There are also 156 model-call region identifiers used for synthetic evaluation cases, not deleted student regions; learning acceptance has not occurred.

Current-head CI is green: [CI 37065362371](https://github.com/Mrmanwonder/Axon-Site/actions/runs/37065362371) — from-scratch Supabase migration/SQL suites, node tests, typecheck, build, UI/DB, Chromium/WebKit E2E, accessibility, configuration and contract parity. [Apply migrations 37065362339](https://github.com/Mrmanwonder/Axon-Site/actions/runs/37065362339) and [CodeQL 37065361665](https://github.com/Mrmanwonder/Axon-Site/actions/runs/37065361665) also succeeded. These are automated tests, not authenticated production acceptance.

## 1. Migration reconciliation

Canonical inventory was enumerated from the [exact Git tree](https://api.github.com/repos/Mrmanwonder/Axon-Site/git/trees/191e305?recursive=1), not inferred from file count alone. Live `supabase_migrations.schema_migrations(version,name)` was matched by names with multiplicity. Matching only versions would misclassify historically renamed/applied migrations.

Historical exceptions remain documented in [migrations/README](https://github.com/Mrmanwonder/Axon-Site/blob/191e305/supabase/migrations/README.md), [BASELINE](https://github.com/Mrmanwonder/Axon-Site/blob/191e305/supabase/migrations/BASELINE.txt), and [2 Oct ledger audit](https://github.com/Mrmanwonder/Axon-Site/blob/191e305/docs/claude_migration-ledger-2026-10-02.md). Specifically:
- Abandoned planner RLS bootstrap is a replay-safe no-op marker.
- Legacy Stripe FDW statements are existence-guarded; Stripe-managed objects are not built by canonical migrations.
- Consolidated sweep history preserves later queue/page behavior rather than restoring an older historical body.
- The live-but-unledgered learning baseline was folded into the already-ledgered `20261001191000_learning_review_signals` by #186. There is no extra canonical `learning_schema` file to replay.
- The historical AXO-124 baseline names now also occur in the live ledger; their presence is not evidence that later replacements remain active.

### Verified effect drift — AXO-124

Canonical [`20261001204131_axo_124_no_printed_total_commit_and_view.sql`](https://github.com/Mrmanwonder/Axon-Site/blob/191e305/supabase/migrations/20261001204131_axo_124_no_printed_total_commit_and_view.sql) defines `v_skipped`, increments it for unreadable/missing-mark regions and sets:
- `total_basis = printed` when a printed total exists, otherwise `added_up`;
- `total_partial = v_skipped > 0`.

Live `pg_get_functiondef('public.commit_extraction_run(uuid)')` instead matches the older `...180500_paper_totals_follow_commit` shape: neither `v_skipped` nor the basis/partial writes occurs. Both migration names are recorded. Live body MD5 is `c81e463760b5d286b97ad5ba8dccd973`. Do not report full effect parity from the 128/128 name result.

The historical screenshot run still has correct persisted `added_up / partial=true / 23 of 29` metadata from prior/backfill state. That does not prove a **new commit** will preserve those facts under today's live function.

Required forward fix:
1. Create a new migration with the Supabase CLI; do not edit/replay an already-applied migration.
2. Restore the latest canonical commit behavior, retaining invoker/RLS, human-mark provenance, duplicate guard, adjudication guard and post-commit explanation design.
3. Review whether failed pages represented by `page_unreadable` should also force partial totals; `v_skipped` currently only sees question regions. Persist partial scope without fabricating omitted questions/marks.
4. Add a regression that starts from the production ordering (later no-printed-total migration followed by historical totals re-application) and proves the forward migration restores the final function.
5. On a disposable local stack, commit complete/no-printed-total, printed-total, unreadable-region, missing-mark and failed-page cases; assert basis/partial/attempt sums.
6. After merge/apply, inspect the live function, run advisors, then verify a genuine authorized submission. No mutation has been performed here.

## 2. WP-I security — AXO-54 / AXO-15 / AXO-105 / AXO-111

Live catalog: 83 SECURITY DEFINER functions in public/private/learning; zero PUBLIC EXECUTE; zero unpinned/unsafe search paths; zero client-executable definer triggers. anon/authenticated cannot CREATE in public/private/extensions/learning. anon has no USAGE on private or learning; authenticated has no USAGE on learning.

Exactly one anon-executable definer: `public.resolve_academic_share`. The 12 authenticated-executable public definers match the committed authority allowlist:
`begin_guardian_verification, claim_guardian_verification, clear_student_scope, delete_my_account, get_cross_subject_signal, get_entitlements, parent_mode_state, record_explanation_feedback, resolve_academic_share, set_student_scope, student_scope_state, tutor_enabled`.

Ownership definitions were re-read: account deletion derives auth.uid and fresh Parent Mode; guardian entitlements derive current guardian; scope creation checks student's owning guardian/session and requires fresh auth for sibling switching; scope read/revocation constrain both guardian and session; feedback derives the student from the attempt and checks Student Mode; tutor flag derives auth.uid; guardian verification begins from auth.uid/session and fresh auth and rejects stub provider; claim consumes the caller's verified assertion. The share resolver deliberately derives authority from the time-limited hashed bearer capability.

The invoker conversion requirement is a suitability review, not a demand to blindly convert every definer. Owner share/question facades already use SECURITY INVOKER/private bodies. Remaining privileged RPCs require their intentional authority crossing. [axo_54_authority_surface.sql](https://github.com/Mrmanwonder/Axon-Site/blob/191e305/supabase/tests/axo_54_authority_surface.sql) includes the exact catalog allowlist and guardian-B-versus-A abuse cases; the current-head SQL job passed.

All 21 RLS/no-policy tables have **no anon or authenticated SELECT/INSERT/UPDATE/DELETE grants**, not merely an RLS wall. They are intentional service/private deny-by-default stores. User-data views `paper_progress, paper_canonical_run, attempt_analytics, mark_loss_analytics, student_analytics_readiness` retain security_invoker=true.

### Advisor classification

- Security ERROR: none.
- [0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable): 1 intentional share resolver.
- [0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): 12 audited authority boundaries above.
- [0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): 21 service/private tables with client privileges revoked.
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): remains disabled; AXO-55 owner configuration action remains outstanding.
- Performance [0001](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys): one Stripe-managed webhook FK; no Axon/learning unindexed-FK finding. The learning student FK has `learning_signal_student`.
- Performance [0005](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index): 67 INFO findings; insufficient usage on a small database is not a deletion recommendation.

AXO-54's six implementation/review items can be checked with this live + CI evidence. AXO-15 remains open for the leaked-password policy/configuration gate. No privilege change was attempted in this audit.

### Sharing

Live poison fixture for `private.share_loss_reasons` returns only `error_type, marks, cause, note`; nested student identifiers, `mark_type`, `internal_trace` and non-object entries are excluded. Both resolver branches call the helper; neither serializes raw loss-reasons JSON. anon cannot execute the helper or use private; an invalid token returns `found=false`. No real capability token was read or logged.

AXO-105 remains In Review until real authenticated mint → signed-out/private-window render → revoke, and deletion behavior are evidenced. AXO-111 cache acceptance likewise requires a signed-in IndexedDB inspection; DB/source/CI cannot substitute for the browser observation.

## 3. WP-H learning / erasure — AXO-121 / AXO-128

### Learning foundations present

Live `learning.signal` has enum field/confidence, constrained kind/stage/prompt version, IDs and timestamps, no answer/question/teacher remark/predicted-value raw text column. Regions/attempts/students have ON DELETE CASCADE FKs. Triggers exist for explicit Review confirmation/correction, Review cause rejection, committed cause verdict, consent withdrawal and student soft deletion. Internal functions are inaccessible to clients.

`axon-learning-aggregate` is active every five minutes; latest observed success 2026-10-03 06:05 UTC, zero failed runs in preceding day. Aggregation publishes groups >=5; raw and daily tables are client-inaccessible. Source fixtures [learning_schema.sql](https://github.com/Mrmanwonder/Axon-Site/blob/191e305/supabase/tests/learning_schema.sql) and [axo_121_review_signals.sql](https://github.com/Mrmanwonder/Axon-Site/blob/191e305/supabase/tests/axo_121_review_signals.sql) cover consent, purges, field corrections, review-only rejection, minimisation, scope denial and small-group suppression. Current-head SQL CI passed.

Actual production acceptance remains missing:
- learning.signal: **0** rows;
- learning.signal_daily: **0** rows;
- eval_run: 1 finished synthetic explanation evaluation, version `explain-synthetic-v1`, 24 cases, **passed=false**.
A row's existence does not certify the route or establish a working correction loop. Do not backfill overwritten old predicted values or use synthetic production corrections as acceptance.

Remaining work: real opted-in production correction/verdict, weekly delivered report with explicit denominators for correction/rejection rates, stage/prompt dimensions, successful evaluation comparison and proof route-change gates enforce it. The five-minute aggregate cron is not a weekly report.

### Telemetry erasure — verified gap

Paper-delete and student hard/soft-delete triggers exist. `private.anonymise_model_telemetry` removes student/paper/region/run refs, image keys, error_detail, tool_calls and verification_failures while preserving model/tokens/cost/latency. Clients cannot call it. Live:
- orphaned model_call.paper_id: 0;
- orphaned model_call.student_id: 0;
- orphaned eval_result.paper_id: 0;
- orphaned learning student: 0;
- model_call.region_id not found in question_region: 156;
- **all 156 join to a synthetic eval_case and their run_id joins eval_run; student_id/paper_id are null**;
- genuine/unclassified missing-region references after excluding this intended evaluation contract: **0**.

The initial missing-region count was unclassified and must not be interpreted as erasure failure. A subsequent source + join audit established all 156 are intentional synthetic evaluation attribution: [explain-run.ts](https://github.com/Mrmanwonder/axon-backend/blob/31a11cf/shared/src/eval/explain-run.ts) assigns model_call.run_id=eval_run ID and region_id=eval_case ID. It never writes question_region. The 156 calls split into 78 paper_feedback.v2 and 78 eval_judge.v1 calls. Blanket cleanup would erase valid case/cost evidence. The original AXO-128 issue comment has been corrected. No raw student text/IDs were printed.

The previously documented single-question deletion **source gap** still exists: private.delete_question removes its committed question_region, but no question-region telemetry erasure trigger exists. Current data does not contain an identified genuine orphan demonstrating that path. Preserve this distinction.

Forward work plan:
1. Define retention for a region erased explicitly and one replaced during re-extraction. Preserve aggregate usage/cost history; remove region content references and content-bearing telemetry.
2. Add forward function/trigger handling question-region removal; cover delete_question's committed-attempt→region path. Do not silently alter applied migration files.
3. Before selecting full row anonymisation, verify run-cost rollup behavior when run_id is cleared; changing an erasure path must not rewrite financial sums incorrectly.
4. Backfill only genuine unclassified missing-region refs after excluding the documented synthetic evaluation mapping. Current eligible count is zero. Never touch the 156 valid eval-attribution rows.
5. Extend local SQL fixtures for a disposable committed question, an extraction retry replacement, paper deletion and student/account tombstone. Assert content refs are erased, intended cost facts survive, other questions/accounts are unchanged, and clients cannot call the privileged helper.
6. Verify exact-head SQL/CI and then one genuine authenticated disposable deletion. No production test deletion was executed here.
7. Synchronize app/Privacy retention copy (AXO-75/27); retain counsel/owner publication gates.

## 4. WP-C/WP-E screenshot run evidence

Run prefix `89c8d7a9`:
- database question_count_contract: **5 questions, 12 parts, 3 unassigned parts, 12 raw regions**;
- 14 stored pages; structure succeeded on 1,3,5,7,8,9,12,14 and failed on 2,4,6,10,11,13;
- region spans cover the 8 successful pages;
- **6 separate page_unreadable rows** represent the failed pages. These records live in `public.page_unreadable`, not question_region. There is durable visible-failure evidence; zero region placeholders alone must never be reported as six silently dropped pages.
- persisted committed metadata: no_printed_total, reconciled=null, four student corrections; added_up and partial=true, 23/29.
Thus the 5/12 count is a count of extracted readable scope, not proof the 14-page paper contains only five top-level questions. Original source/crops and human review are required before declaring extraction fidelity complete.

Across live regions: explain done6, pending84, skipped17; no running/queued in this snapshot. Two confirmed mark-losing regions on committed runs remain pending. Oldest pending committed region is dated 2026-08-31. `done` mark-losing regions without an explanation: zero. Queue a genuine authorized retry through the normal owner API if needed; do not manufacture a background service retry as user acceptance.

The canonical commit contract explicitly permits explanation to continue after commit (AXO-124), so absence of an explain-terminal block is not by itself a bug. The required invariant is eventual honest terminal state/retry. Current sweep addresses running/queued; inspect the two confirmed pending losses to decide whether they need explicit scheduling or terminal status.

AXO-116 objects verified: `continues_from_previous` exists, `private.assemble_structure` exists, and the unique question-label index now only guards labels containing a digit. This is deployed-schema evidence; an authenticated retry demonstrating complete 14-page extraction remains separate.

## 5. WP-M exact scheme provenance

One reproduction-permitted official scheme is ready: CBSE Physics 042 2026–27, source version `2026-27:7aec844a3c6f4c4d`, SHA256 `7aec844a3c6f4c4dbec23daed6553e5ea6e9e61624cce6a8cc5c2dd86d4b8f80`. 31 canonical records, all 31 have exact assessment/source/version bindings.

Production: **40 papers, 0 assessment-bound; 6 region_explanation rows, 0 full assessment + scheme_document + canonical_question provenance chains**. AXO-34's two remaining real Tier-2 boxes remain open. A genuine authenticated eligible Physics submission must establish exact binding and student-visible provenance. Do not relabel historical Cambridge material or bypass source licensing.

## 6. WP-Q Postgres upgrade owner gate

Live ACTIVE_HEALTHY project still reports **17.6.1.147**, database about 75 MB, zero active extraction runs at observation. The [Supabase release guidance](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) was checked. Its key-column-aware catalog detections return:
- ltree / _ltree indexed keys: 0;
- GiST float4/float8 indexed keys: 0;
- non-extension custom selectivity-estimator operators: 0.
pgcrypto 1.3 is installed; no non-extension live routine calls pgp_sym/pub encrypt/decrypt. Existing source runbook documents no canonical PGP use; this audit did not scan arbitrary encrypted customer values or claim a data decryption trial.

Managed upgrade is an owner dashboard action. Reconcile the commit-function effect drift before declaring the pre-upgrade baseline clean. Confirm backup/restore point, choose low-traffic window from recent traffic, apply the managed upgrade, then rerun version/extensions, name and effect parity, detections, advisors, authenticated application smoke and clean-log observation. Reindex only if detection returns a relevant row. No upgrade was attempted.

## 7. Exact remaining gates

| Owner | Issue | Required next evidence |
|---|---|---|
| Agent + production migration operator | AXO-124/80 | Forward restore of live commit basis/partial behavior; inspect effect after apply; genuine paper acceptance |
| Agent + owner policy | AXO-128 | Region-deletion retention policy and forward migration/test; preserve 156 synthetic eval-attribution rows; real disposable deletion |
| Agent + opted-in student/guardian | AXO-121 | Genuine correction/verdict, weekly rate report, passing evaluation comparison |
| Owner dashboard | AXO-55 | Enable leaked-password protection or enforce documented server-side password policy |
| Owner dashboard + agent postflight | AXO-112 | Managed 17.11 upgrade after clean baseline; postflight/authenticated smoke |
| Owner authenticated browser | AXO-105/89 | Mint/open/revoke + deletion tests, without logging capability |
| Owner authenticated browser | AXO-111 | New guardian cache rows contain only id/auth_user_id/name/contact |
| Owner genuine submission + agent trace | AXO-34 | Eligible exact-scheme provenance chain and source indicator |
| Owner authenticated retry + agent audit | AXO-116/122/138 | Retry original14-page scope, count/continuation/failed-page/fidelity evidence |

This report records verified work and explicit gates. No issue is complete solely because its implementation merged or a migration name appears in the ledger.

## Concrete fix proposals prepared, not applied

- [Commit metadata SQL proposal](https://github.com/Mrmanwonder/Axon-Site/blob/codex/spec-execution-2026-10-03/docs/sql/claude_restore-commit-totals-2026-10-03.sql): latest canonical invoker function, with durable page_unreadable scope included in total_partial.
- [Disposable local regression](https://github.com/Mrmanwonder/Axon-Site/blob/codex/spec-execution-2026-10-03/docs/sql/claude_restore-commit-totals-regression-2026-10-03.sql): reproduces the older migration overwriting the latest function, restores it, tests complete/no-printed-total, printed total, unreadable marks and a failed page without a region, preserves repeat-commit refusal and teacher marks. Explicit local fixture guard; changes roll back. UNEXECUTED because local shell/Postgres runtime is unavailable. It is review material, not passing evidence or production acceptance.
- Region retention proposal explicitly distinguishes optional full unlinking (requires a separate cost attribution design) from minimal removal of region/content references while retaining the still-owned paper/run for cost accounting. No new migration filename was invented; create the forward migration via CLI when available.
