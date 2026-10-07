#!/usr/bin/env node
// Loads the SQL written by ingest.mjs into the database named by SUPABASE_DB_URL.
// Same connection handling as scripts/migrations/apply.mjs: the URI becomes PG*
// variables, psql never sees it, and nothing it prints can leak it.
import { spawnSync } from "node:child_process";
import { connectionEnv, redact, secretFragments } from "../migrations/connection.mjs";

const file = process.argv[2];
const url = process.env.SUPABASE_DB_URL;
if (!file || !url) { console.error("usage: SUPABASE_DB_URL=... node scripts/syllabus/load.mjs <file.sql>"); process.exit(2); }
const env = connectionEnv(url);
const fragments = secretFragments(url, env);
const r = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", file], {
  env: { ...process.env, ...env, SUPABASE_DB_URL: "" }, encoding: "utf8",
});
process.stdout.write(redact(r.stdout ?? "", fragments));
process.stderr.write(redact(r.stderr ?? "", fragments));
process.exit(r.status ?? 1);
