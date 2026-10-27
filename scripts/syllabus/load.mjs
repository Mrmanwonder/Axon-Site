#!/usr/bin/env node
// Loads the SQL written by ingest.mjs (and the exam ingests) into the database
// named by SUPABASE_DB_URL, as one transaction.
// Same connection handling as scripts/migrations/apply.mjs: the URI becomes PG*
// variables, psql never sees it, and nothing it prints can leak it.
//
//   node scripts/syllabus/load.mjs [--skip-if-slow] <file.sql>
//
// Guard rails (AXO-291, after the 13 and 26 Oct stalls):
// - every statement is capped at 90 s and every lock wait at 10 s, so a load
//   can never hold locks for minutes on a struggling instance;
// - --skip-if-slow first runs a trivial query; if the database does not answer
//   it within a few seconds the load is skipped with a warning and exits 0. The
//   ingests are refreshes that run again the next day, and piling a bulk write
//   onto a database that is already starved is how a slow hour becomes an outage.
import { spawnSync } from "node:child_process";
import { appendFileSync, statSync } from "node:fs";
import { connectionEnv, redact, secretFragments } from "../migrations/connection.mjs";

const args = process.argv.slice(2);
const skipIfSlow = args.includes("--skip-if-slow");
const file = args.find((a) => !a.startsWith("--"));
const url = process.env.SUPABASE_DB_URL;
if (!file || !url) { console.error("usage: SUPABASE_DB_URL=... node scripts/syllabus/load.mjs [--skip-if-slow] <file.sql>"); process.exit(2); }
const env = connectionEnv(url);
const fragments = secretFragments(url, env);
const psqlEnv = { ...process.env, ...env, SUPABASE_DB_URL: "", PGCONNECT_TIMEOUT: "10" };
const warn = (m) => console.error(process.env.GITHUB_ACTIONS ? `::warning::${m}` : `warning: ${m}`);

if (statSync(file).size === 0) {
  console.error(`${file} is empty: nothing changed, nothing to load.`);
  process.exit(0);
}

/** Answers within the budget, or the reason it did not. */
function healthCheck(budgetMs = 5000) {
  const started = Date.now();
  const r = spawnSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", "set statement_timeout = '4s'; select 1"], {
    env: psqlEnv, encoding: "utf8", timeout: budgetMs + 10000,
  });
  const ms = Date.now() - started;
  if (r.error || r.status !== 0) return { ok: false, ms, reason: redact((r.stderr || String(r.error ?? "")).trim(), fragments) || "no answer" };
  return ms > budgetMs ? { ok: false, ms, reason: `answered in ${ms} ms` } : { ok: true, ms };
}

if (skipIfSlow) {
  const h = healthCheck();
  if (!h.ok) {
    warn(`database is not answering promptly (${h.reason}); load skipped, the next run will retry`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Load of ${file} skipped: the database was slow (${h.reason}).\n`); } catch { /* summary is optional */ }
    }
    process.exit(0);
  }
  console.error(`database answered in ${h.ms} ms`);
}

const r = spawnSync("psql", [
  "-X", "-v", "ON_ERROR_STOP=1", "--single-transaction",
  "-c", "set statement_timeout = '90s'; set lock_timeout = '10s';",
  "-f", file,
], { env: psqlEnv, encoding: "utf8" });
process.stdout.write(redact(r.stdout ?? "", fragments));
process.stderr.write(redact(r.stderr ?? "", fragments));
process.exit(r.status ?? 1);
