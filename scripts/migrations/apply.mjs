// Applies the migrations in supabase/migrations/ that the live ledger does not
// have, in version order, each in its own transaction together with its ledger
// row, so a failure leaves nothing half-applied and the next run retries it.
//
//   SUPABASE_DB_URL=postgres://... node scripts/migrations/apply.mjs [--dry-run]
//
// Needs `psql` on PATH. Never prints the connection string.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listMigrations, planMigrations, readBaseline } from "./plan.mjs";

const DIR = "supabase/migrations";
const dry = process.argv.includes("--dry-run");
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set; nothing was applied.");
  process.exit(2);
}

function psql(args, input) {
  const r = spawnSync("psql", [url, "-X", "-v", "ON_ERROR_STOP=1", ...args], { encoding: "utf8", input });
  if (r.status !== 0) {
    // psql echoes the failing statement, never the URL; keep stderr only.
    console.error(r.stderr.trim());
    throw new Error(`psql exited with ${r.status}`);
  }
  return r.stdout;
}

const ledger = psql(["-At", "-F", "\t", "-c", "select version, name from supabase_migrations.schema_migrations order by version"])
  .split("\n").filter(Boolean).map((l) => { const [version, name] = l.split("\t"); return { version, name }; });

const { pending, unversioned } = planMigrations(listMigrations(DIR), ledger, readBaseline(join(DIR, "BASELINE.txt")));

console.log(`ledger rows: ${ledger.length}; pending: ${pending.length}`);
for (const u of unversioned) console.log(`::warning title=Live migration has no file::${u.version} ${u.name} is in the ledger but not in ${DIR}`);
if (!pending.length) { console.log("Nothing to apply."); process.exit(0); }
for (const p of pending) console.log(`  pending ${p.file}`);
if (dry) process.exit(0);

for (const p of pending) {
  const sql = readFileSync(join(DIR, p.file), "utf8");
  const dir = mkdtempSync(join(tmpdir(), "mig-"));
  const wrapped = join(dir, p.file);
  const lit = (s) => `'${s.replace(/'/g, "''")}'`;
  writeFileSync(wrapped, `begin;\n${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name) values (${lit(p.version)}, ${lit(p.name)});\ncommit;\n`);
  console.log(`applying ${p.file}`);
  psql(["-f", wrapped]);
  console.log(`applied  ${p.file}`);
}
