# Postgres 17.6 → 17.11 upgrade runbook (AXO-112)

Project `dlgcqieyevoebefhcggi` · prepared 2026-10-01 · approved by Tanmay in principle on 2026-10-01.

**Who presses the button:** Tanmay. The managed upgrade is a dashboard (or Management API) action. This environment has neither a dashboard session nor a Management API token, and the Supabase MCP has no upgrade tool. Everything before and after the button is scripted below.

## 1 · Pre-flight (re-run 2026-10-01 17:20 UTC: all clean)

| Check | Result |
|---|---|
| Server version | `17.6.1.147`, release channel `ga` |
| `ltree` installed / ltree indexes | no / 0 |
| btree_gist GiST float4/float8 indexes | 0 (btree_gist 1.7 installed) |
| Non-extension operators with non-built-in selectivity estimators | 0 |
| Non-extension routines using `pgp_sym_*` / `pgp_pub_*` | 0 (pgcrypto 1.3 installed) |
| Extensions | btree_gist 1.7, pg_cron 1.6.4, pg_net 0.20.4, pg_stat_statements 1.11, pgcrypto 1.3, pgmq 1.5.1, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1, wrappers 0.6.2 |
| Database size | 71 MB (expect minutes of downtime, not hours) |
| Active extraction runs | 0 at check time; re-check immediately before |

Immediately before pressing the button, run:

```sql
select count(*) from extraction_run where status not in ('committed','failed','rejected','needs_review','ready');  -- want 0
select version();
```

## 2 · Backup and rollback

- **Backup:** In Dashboard → Database → Backups, confirm a daily backup from the last 24 h exists. If PITR is enabled, note the timestamp just before starting. If neither exists, take a manual `pg_dump` first (`supabase db dump --linked -f pre-17.11.sql`, plus `--data-only` for data).
- **Rollback:** Supabase doesn't support in-place downgrades. The rollback is **restore the pre-upgrade backup to a new project** (or PITR on the same one) and repoint `SUPABASE_URL` on the Workers and the site. Because of that cost, the post-checks below run before traffic is trusted again.
- **Pipeline quiesce (optional, recommended):** the upgrade restarts Postgres. In-flight queue messages retry (the workers' DB errors are classified retryable), and the sweep recovers stuck runs. No manual queue pause is needed with 0 active runs.

## 3 · Window

Measured from all 70 `extraction_run.started_at` rows: no runs ever started between 12:00 and 16:59 UTC, or between 19:00 and 22:59 UTC. Runs cluster at 05:00–11:59 UTC (10:30–17:30 IST). Recommended window: **19:00–22:00 UTC (00:30–03:30 IST)**. The sample is small, so check Realtime/Auth activity on the dashboard before starting.

## 4 · Post-checks (run in order; all must pass)

```sql
select version();                                              -- 17.11
select extname, extversion from pg_extension order by 1;       -- same set as §1
select count(*) from supabase_migrations.schema_migrations;    -- unchanged from pre-upgrade
-- the three detection queries from the Supabase changelog; each must return 0 rows
select count(*) from pg_index i join pg_opclass oc on oc.oid = any(i.indclass::oid[]) where oc.opcname ilike '%ltree%';
select count(*) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_am am on am.oid=c.relam
  join pg_opclass oc on oc.oid = any(i.indclass::oid[]) where am.amname='gist' and oc.opcname in ('gist_float4_ops','gist_float8_ops');
```

Then:
1. Run the Supabase security and performance advisors. They should match the pre-upgrade set.
2. API health: `curl -s -o /dev/null -w '%{http_code}' https://dlgcqieyevoebefhcggi.supabase.co/auth/v1/settings -H "apikey: <publishable>"` → 200.
3. Pipeline smoke: retry one stored paper from the Library, then confirm `extraction_run` reaches `committed`/`needs_review` with no `model_call.ok=false` from DB errors.
4. Logs: no `ERROR`/`FATAL` in Postgres logs for 30 minutes after restart, other than the restart itself.
5. Reindex **only** if a detection query returns a row (none expected).

Record results as a comment on AXO-112.
