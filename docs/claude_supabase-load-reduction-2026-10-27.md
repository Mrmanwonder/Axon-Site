# Supabase load reduction (AXO-291), 27 Oct 2026

Written for the owner and for an agent with no other context. The evidence is from the production project `dlgcqieyevoebefhcggi` on 27 Oct 2026.

## What happened

From 26 Oct 20:35 to about 05:50 UTC on 27 Oct the database stalled again, the same way it did on 13 Oct (AXO-272).

- About 37 pg_cron "job startup timeout" failures an hour.
- 14 to 21 statement timeouts an hour.
- TLS handshakes dropped.
- At 20:35 a checkpoint that wrote 4 buffers took 67 s; it normally takes about 0.5 s.

The database was idle at the time. A checkpoint writing 4 buffers in 67 s means the instance itself was starved of disk IO, CPU or memory. It does not mean a query was slow.

The instance is **Nano**: 0.5 GB RAM and shared CPU. Its disk IO baseline is 5 MB/s and 250 IOPS. It can burst above that only while it has disk IO budget left, and once the budget is spent it drops back to the baseline. The dashboard on 27 Oct showed:

- Compute 62%.
- Memory 62%.
- Disk IO 29%, rising since 9 Oct.

## Causes we control, and what changed

**1. The ingest jobs rewrote unchanged data.** Every run deleted and re-inserted rows that had not changed. Each run did so after every "Apply migrations" run, and the exam ingest also ran daily. The two ingests ran at the same time.

| Table | Rows | Writes before AXO-291 |
|---|---|---|
| `syllabus_topic` | 12.5k | 302k updates |
| `exam_sitting` | 4.8k | 170k inserts, 165k deletes |
| `grade_threshold` | 7.9k | 52.9k inserts, 45k deletes |
| `exam_zone_location` | 266 | 12k updates |

`grade_threshold_set` and `grade_threshold_component` were also deleted and re-created on every run.

Changes:
- Every loader now writes only what changed:
  - **Syllabus documents and topics, zones and paper routes:** upserted only where `is distinct from` finds a difference.
  - **Timetables:** a timetable whose file SHA-256 matches the stored one is skipped.
  - **Grade thresholds:** a table whose file and weighting file are both unchanged is not rewritten. `known.mjs` reports both SHA-256 values.
- A push (a parser or manifest change) passes `--rewrite`, so a parser fix still reloads.
- The test is `tests/db/ingest-idempotency.test.mjs`: a second identical run leaves every row's `xmin` unchanged.
- The syllabus ingest now runs after the exam ingest, never beside it. It no longer runs after the exam ingest's daily run.
- The daily exam ingest moved from 03:41 to 22:37 UTC (04:07 IST).
- `load.mjs` now:
  - caps each statement at 90 s and each lock wait at 10 s;
  - skips an empty file;
  - with `--skip-if-slow`, skips the load and warns if the database takes more than 5 s to answer `select 1`. These are refreshes, so they run again the next day.

**2. Three cron jobs started on the same minute.** Stuck-run recovery, the learning roll-up and spend-alert detection all started together every 5 minutes. pg_cron starts every job in a new backend (`cron.use_background_workers` is off on this platform), so each of those minutes began with a burst of connections.

- Migration `20261027100000_axo_291_load_reduction.sql` spreads the jobs so no two share a minute:

  | Job | Schedule |
  |---|---|
  | Stuck-run recovery | `*/5` (unchanged, AXO-274) |
  | Learning roll-up | `1-59/15` |
  | Spend alerts | `4-59/15` |
  | Stripe sync | `:07` |
  | Model-call retention | 03:17 |
  | Work-journal retention | 03:43 |
  | Cron-history retention | 04:23 |

- Neither the learning roll-up nor spend alerts is student-facing.
- The per-paper spend check now reads only papers that had a model call in the last 2 days. A paper's total only rises when it gets a new call, and its alert is raised once, so the result is the same.

**3. A forgotten transaction could hold locks indefinitely.** `idle_in_transaction_session_timeout` was 0. It is now 30 s for `anon` and `authenticated`, and 60 s for `service_role`.

**4. Clean-up done on 27 Oct.** `vacuum (full, analyze) cron.job_run_details` shrank the table from 59 MB to 6.5 MB, and the database from 124 MB to 67 MB. The 7-day retention job (`axon-cron-history-retention`) stays.

## Checked and not changed

- **The sweep Worker** (axon-backend) calls only `claim_stage_outbox` every minute. Since AXO-243 everything else runs on its 15-minute tick. The RPC takes 0.5 ms warm. Its high mean in `pg_stat_statements` (898 ms) comes from cold connections and from the stalls, so there is no backend change to make.
- **`set_practice_pref`** reading `pg_timezone_names` was already fixed in `20261014020000`.
- **The learning signal table** is empty, and `learning.aggregate` uses a partial index.

## Open, for the owner

1. **Compute size (decision and money: yours).** The 26 Oct stall began on an idle database, so Nano itself is the limit. My recommendation is to move to **Micro**: 1 GB RAM, with a disk IO baseline of 11 MB/s and 500 IOPS. On a paid organisation, Nano is already billed at the Micro price, so this may cost nothing extra. Please check the price shown in the dashboard before switching. If stalls continue after the load reduction, move to Small.
2. **Library realtime.** The Library subscribes to `postgres_changes` on 4 tables. Realtime has polled `list_changes` 433k times since July. Moving to Realtime Broadcast from database triggers would remove that polling. This is a follow-up issue, not part of this change.
3. **AXO-272 root cause.** This change removes our own load. Whether Supabase's platform contributed (the checkpoint stall) can only be confirmed by Supabase support.

## How to tell it worked

- Re-measure 24 h after deploy.
- `cron.job_run_details` should show no "job startup timeout" failures.
- `pg_stat_user_tables.n_tup_upd/ins/del` on the ingest tables should stay flat across an ingest run with no new files. The daily run's step summary shows `unchanged` for most threshold tables.
- The Disk IO chart should flatten.
