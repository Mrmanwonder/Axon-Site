# Continuous audit runbook (AXO-24, AXO-81; covers the AXO-79/80 checks)

One scheduled run = one pass over the checks below, diffed against the last checkpoint, producing **only new or changed findings** in Linear and **one** consolidated summary. It is read-only everywhere except Linear.

Status: runbook complete; scheduled as a nightly Routine (see "Scheduling"). Daytime reconciliation uses the same runbook with `mode=quiet` (no summary, findings only) and is **not** scheduled yet (decision for the owner: it doubles run cost and mostly repeats the nightly result).

## 1. Authoritative sources (what each run inspects)

| System | Authority | How it is read | Access |
|---|---|---|---|
| Linear (team Axon-26, project Axon) | system of record for plans, status, evidence | `list_issues` (updated since checkpoint), `get_issue` + `list_comments` per changed issue | read + comment/status/document write |
| Axon-Site (`Mrmanwonder/Axon-Site`) | frontend, `supabase/migrations`, `supabase/tests`, CI | GitHub MCP: merged PRs since checkpoint, open PRs, `ci.yml` runs on `main` and each open PR head, file reads | read only |
| axon-backend (`Mrmanwonder/axon-backend`) | Cloudflare Workers + shared | same | read only |
| Supabase `dlgcqieyevoebefhcggi` | production database | `list_migrations`, `get_advisors` (security, performance), `execute_sql` **SELECT only** | read only; never `apply_migration` |
| Cloudflare | Worker deployments/versions | `workers_list`, `workers_get_worker` | read only; if not connected → "unavailable", never "verified" |
| Production site `https://axonstudy.online` | public delivery | `curl -I` on `/`, `/privacy/`, `/share/`, `/robots.txt`, `/sitemap.xml` | public GET/HEAD |
| PostHog project 620121 | analytics | **not readable by an agent** unless a connector exists → "unavailable" | — |

## 2. Run procedure

0. **Load checkpoint** (Linear document "Axon audit checkpoint"): `last_run_at`, `site_main_sha`, `backend_main_sha`, `last_migration_version`, `advisor_counts`, `findings{}` (fingerprint table, §4). If missing, treat as first run: build a baseline, post nothing but the baseline summary.
1. **Changes since last run:** merged PRs on both repos since the stored SHAs; Linear issues updated since `last_run_at`; new migrations.
2. **Reconcile requirements ↔ work:** for each merged PR, find the Linear issue it names (`AXO-n` in title/branch/body). Flag: *merged work whose issue has no comment/status change after the merge*; *PR with no AXO id*.
3. **Done without evidence:** for each issue moved to Done since checkpoint (and a rolling sample of older Done issues), require at least one evidence token in its comments or description: PR/commit SHA, CI run id/URL, query output, live URL/header excerpt, screenshot, test name. Absent → finding `done-without-evidence`. Real-device / legal / third-party items marked Done with only automated evidence → finding `device-evidence-missing`.
4. **Migration parity:** list `supabase/migrations/*.sql` on `main` vs `list_migrations`. Findings: file with no live row (`unapplied`), live row with no file (`unversioned`), version/name mismatch. A live version newer than any merged file is not a regression if an open PR carries it (record as `pending-merge`).
5. **Advisors:** `get_advisors` security and performance. Compare counts and finding names to `advisor_counts`. New finding or a count increase → finding. Known accepted items (Stripe-managed FK; `resolve_academic_share` anon SECURITY DEFINER) are suppressed by fingerprint, not by omission from the report.
6. **PRs and CI:** open PRs; for each, latest head CI conclusion; `main` CI. Red on `main` → `critical`. Red on a PR older than 24 h → finding. A PR whose head is behind `main` by > 5 commits and has migrations → finding.
7. **Production version/health:** `curl -I` the public routes; compare asset hash in `/` HTML against the last built `main` entry chunk if inferable; check `/share/` still has `X-Robots-Tag: noindex`, `robots.txt` text/plain, `sitemap.xml` XML, CSP present with only `https://*.posthog.com` added. Cloudflare Worker versions if connected.
8. **Regression invariants** (concrete, scriptable; run against `main`, not a PR):

| ID | Invariant | Check |
|---|---|---|
| R1 | No silent Cambridge fallback | `npx vitest run tests/ui/curriculum-identity.test.ts` and `grep -rn "?? 'cambridge'\|= 'cambridge'\|return 'cambridge'" src` returns no default |
| R2 | Red only for sign-out | `npx vitest run tests/ui/design-rules.test.ts` (fails on any `var(--red)`/red hex outside `tokens.css`; `--signout` consumed only by Settings sign-out) |
| R3 | Model never writes marks | DB: `marks_source` enum has no model value; `mark_loss_event` is the only model-written table |
| R4 | Share resolver allow-lists reasons | `npm run test:db` includes `share-loss-reasons.test.mjs`; live `pg_get_functiondef(resolve_academic_share)` contains `share_loss_reasons(` twice |
| R5 | Analytics off before consent, replay masked | `unit: tests/ui/analytics-privacy.test.ts`; `node scripts/verify-replay-masking.mjs` exits 0 |
| R6 | All UI tests actually run | `vitest.config.ts` include covers `.test.ts` and `.test.tsx`; file count in `tests/ui` equals files run |
| R7 | Guardian cache minimal | `tests/ui/guardian-cache.test.ts` passes; `grep "select('\*')" src/supabase.js` shows no guardian read |
| R8 | FK index coverage | performance advisor `unindexed_foreign_keys` count ≤ 1 (the Stripe-managed FK) |
| R9 | No student-facing paywall | `get_entitlements` free tier still has scan + per-paper analysis (RPC read-only call or test) |
| R10 | Mastery-api service-role routes join ownership | backend grep for `SERVICE_ROLE` use paired with an ownership predicate; any new route without one → finding |

9. **Write findings** (§4) and **the one summary** (§5). 10. **Save checkpoint** last, only if steps 1–8 completed (a partial run saves a partial checkpoint flagged `partial:true` with the failed steps listed, so the next run re-checks them).

## 3. Verified vs inferred vs unavailable

Every line in findings and the summary carries one of three labels and its evidence source:
- **VERIFIED** — observed this run (command/tool output cited).
- **INFERRED** — derived from other verified facts; state the inference.
- **UNAVAILABLE** — the check could not be performed; state the tool/connector, the error, and which evidence is therefore missing. A task is **never** marked verified, nor a Linear box ticked, on the basis of an UNAVAILABLE check.

## 4. Fingerprints and deduplication

`fingerprint = sha256(issue_id | system | check_id | evidence_key)` where `evidence_key` is the stable identity of the thing found (PR number, migration version, advisor name + object, invariant id, URL path) and **never** a timestamp, run id or count.

Checkpoint entry per fingerprint: `{severity, state: open|resolved, first_seen, last_seen, last_posted_state, last_posted_severity, linear_comment_id}`.

Posting rule: write to Linear only if the fingerprint is **new**, its **severity changed**, or its **state flipped** (open → resolved is posted once as "resolved: <evidence>"). Otherwise update `last_seen` silently. Severity: `critical` (red CI on `main`, production regression, hard-rule breach), `high`, `medium`, `low`. Where to post: a comment on the canonical issue named in the finding; if none exists, create one issue (label none, title `Audit: <check_id> <evidence_key>`) and link the finding. Never open a second issue for the same fingerprint.

## 5. Nightly summary (one per night)

A Linear **project status update** (health: on track / at risk / off track from the highest open severity) with fixed sections, each linking canonical issues: **Completed** (issues done with evidence since last run) · **Newly blocked** (new `BLOCKED-ON-HUMAN`) · **Regressions** (new/changed findings) · **Production health** (labelled VERIFIED/UNAVAILABLE) · **Next critical actions** (≤ 5). If nothing new: one line, "No new findings since <time>"; do not restate old findings. Optional: an HTML page in Axon's design language (dark, Onest, tokens from `tokens.css`, cause hues only for causes, **no red**, no score-style big numbers, amber for attention).

## 6. Credentials, permissions and failure behaviour

- Linear: workspace connector (read/write). GitHub: connector with repo read for both repos. Supabase: read connector; `execute_sql` limited to `SELECT`. Cloudflare: read connector if present. No secrets are printed, stored in Linear, or committed.
- If a connector is missing or errors, record `UNAVAILABLE: <tool>: <error>` once per distinct error (fingerprint `audit-tooling|<tool>|<error class>`), continue with the remaining checks, and mark the checkpoint `partial`.
- If Linear itself is unreachable, write nothing; the next run re-diffs from the unchanged checkpoint.
- Rate limits / timeouts: retry once, then UNAVAILABLE.
- The run never merges, pushes, applies migrations, deploys, or changes issue status except: adding `BLOCKED-ON-HUMAN` comments, posting findings, and reverting a status it can prove is wrong **only by commenting** (it does not move Done issues itself).

## 7. Scheduling

Implemented as a Routine (nightly, 22:47 IST) whose prompt is this runbook's procedure verbatim in short form and which keeps its checkpoint in the Linear document above. Pause with `update_trigger enabled=false`; delete with `delete_trigger`. The first run builds the baseline and posts only the baseline summary.
