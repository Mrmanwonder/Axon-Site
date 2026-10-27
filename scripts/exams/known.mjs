#!/usr/bin/env node
// Prints what the database already holds for each grade threshold table, so
// the daily refresh neither downloads a fully verified table again nor
// rewrites a table whose file and weighting file are unchanged. Drafts are
// re-checked every day: a new weighting factors file may let them verify.
// Same connection handling as scripts/syllabus/load.mjs: the URI becomes PG*
// variables, psql never sees it, and nothing printed can leak it.
import { spawnSync } from "node:child_process";
import { connectionEnv, redact, secretFragments } from "../migrations/connection.mjs";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("SUPABASE_DB_URL is not set"); process.exit(2); }
const env = connectionEnv(url);
const fragments = secretFragments(url, env);
// Two kinds of line, tab-separated (AXO-291):
//   verified <url>            every linear and AS route verified, and its
//                             component thresholds stored: not downloaded again.
//   loaded <url> <sha> <wsha> already loaded from exactly this file and this
//                             weighting file: downloaded and checked, but not
//                             written again unless one of the two changed.
// A table loaded before its component thresholds were stored (AXO-270) is
// not verified yet, so the next run reads it again and fills them in.
const sql = `select 'verified' || chr(9) || s.source_url from public.grade_threshold_set s
              where exists (select 1 from public.grade_threshold_component c where c.source_url = s.source_url)
              group by s.source_url
             having bool_and(s.status = 'verified' or s.assessment = 'staged')
                and bool_or(s.status = 'verified')
             union all
             select 'loaded' || chr(9) || s.source_url || chr(9) || min(s.source_sha256) || chr(9) || min(s.weights_source_sha256)
               from public.grade_threshold_set s
              where exists (select 1 from public.grade_threshold_component c where c.source_url = s.source_url)
              group by s.source_url
             having count(distinct s.source_sha256) = 1 and count(distinct s.weights_source_sha256) = 1
                and bool_and(s.weights_source_sha256 is not null)
             order by 1`;
const r = spawnSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
  env: { ...process.env, ...env, SUPABASE_DB_URL: "" }, encoding: "utf8",
});
if (r.status !== 0) { process.stderr.write(redact(r.stderr ?? "", fragments)); process.exit(r.status ?? 1); }
process.stdout.write(r.stdout);
