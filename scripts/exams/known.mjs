#!/usr/bin/env node
// Prints the grade threshold tables already fully verified in the database
// (every linear and AS route verified), one source URL per line, so the daily
// refresh does not download them again. Drafts are left out on purpose: a new
// weighting factors file may let them verify on the next run.
// Same connection handling as scripts/syllabus/load.mjs: the URI becomes PG*
// variables, psql never sees it, and nothing printed can leak it.
import { spawnSync } from "node:child_process";
import { connectionEnv, redact, secretFragments } from "../migrations/connection.mjs";

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error("SUPABASE_DB_URL is not set"); process.exit(2); }
const env = connectionEnv(url);
const fragments = secretFragments(url, env);
const sql = `select source_url from public.grade_threshold_set
              group by source_url
             having bool_and(status = 'verified' or assessment = 'staged')
                and bool_or(status = 'verified')
             order by 1`;
const r = spawnSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
  env: { ...process.env, ...env, SUPABASE_DB_URL: "" }, encoding: "utf8",
});
if (r.status !== 0) { process.stderr.write(redact(r.stderr ?? "", fragments)); process.exit(r.status ?? 1); }
process.stdout.write(r.stdout);
