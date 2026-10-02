// Decides which migration files still need applying to the live project.
//
// Identity is the migration NAME, not its version. The Supabase MCP stamps a
// migration with the time it was applied, so a file here and its ledger row
// routinely carry different versions (see supabase/migrations/README.md). A
// version comparison would re-run those. The ledger name is either the bare
// name ("axo_105_...") or, for the reconstructed rows, the whole file stem
// ("20260811120000_board_caie"), so both spellings count as applied.
//
// Pure on purpose: no database, no filesystem beyond the directory listing, so
// the same function runs in CI, in tests, and from a laptop.
import { existsSync, readFileSync, readdirSync } from "node:fs";

const FILE = /^(\d{14})_([a-z0-9_]+)\.sql$/;

export function parseMigrationFile(file) {
  const m = FILE.exec(file);
  if (!m) return null;
  return { file, version: m[1], name: m[2], stem: file.slice(0, -4) };
}

export function listMigrations(dir) {
  const bad = [];
  const rows = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const p = parseMigrationFile(f);
    if (p) rows.push(p);
    else bad.push(f);
  }
  if (bad.length) throw new Error(`Migration files that do not match <14-digit version>_<snake_name>.sql: ${bad.join(", ")}`);
  return rows;
}

export function readBaseline(path) {
  if (!existsSync(path)) return new Set();
  return new Set(readFileSync(path, "utf8").split("\n")
    .map((l) => l.replace(/#.*/, "").trim()).filter(Boolean));
}

export function planMigrations(files, ledger, baseline = new Set()) {
  // Two files may share a name (a migration re-applied after a fix keeps its
  // name), so a name is "applied" once per ledger row carrying it: with N files
  // and M rows of one name, the earliest M files are the applied ones.
  const rows = new Map();
  for (const r of ledger) rows.set(r.name, (rows.get(r.name) ?? 0) + 1);
  const take = (key) => { const n = rows.get(key) ?? 0; if (n > 0) rows.set(key, n - 1); return n > 0; };
  const pending = [];
  for (const f of [...files].sort((a, b) => a.version.localeCompare(b.version))) {
    if (baseline.has(f.stem)) continue;
    if (take(f.stem) || take(f.name)) continue;
    pending.push(f);
  }
  const known = new Set(files.flatMap((f) => [f.name, f.stem]));
  const unversioned = ledger.filter((r) => !known.has(r.name));
  return { pending, unversioned };
}
