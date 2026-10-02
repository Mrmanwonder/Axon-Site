import test from "node:test";
import assert from "node:assert/strict";
import { readBaseline, parseMigrationFile, planMigrations, listMigrations } from "../../scripts/migrations/plan.mjs";

const f = (s) => parseMigrationFile(`${s}.sql`);

test("a file already applied under a different version is not pending", () => {
  const files = [f("20261002000100_axo_124_cost_triggers_run_as_definer")];
  const ledger = [{ version: "20261001202325", name: "axo_124_cost_triggers_run_as_definer" }];
  assert.deepEqual(planMigrations(files, ledger).pending, []);
});

test("reconstructed rows carry the whole stem as their name", () => {
  const files = [f("20260811120000_board_caie")];
  const ledger = [{ version: "20260824063718", name: "20260811120000_board_caie" }];
  assert.deepEqual(planMigrations(files, ledger).pending, []);
});

test("an unapplied file is pending and order follows the file version", () => {
  const files = [f("20261001190000_learning_schema"), f("20260101000000_a_old")];
  const { pending } = planMigrations(files.sort((a, b) => a.version.localeCompare(b.version)), []);
  assert.deepEqual(pending.map((p) => p.name), ["a_old", "learning_schema"]);
});

test("a ledger row with no file is reported, not applied", () => {
  const { pending, unversioned } = planMigrations([], [{ version: "1", name: "ghost" }]);
  assert.equal(pending.length, 0);
  assert.equal(unversioned[0].name, "ghost");
});

test("a name used by two files is applied once per ledger row", () => {
  const files = [f("20260101000000_x"), f("20260102000000_x")];
  assert.deepEqual(planMigrations(files, [{ version: "9", name: "x" }]).pending.map((p) => p.file), ["20260102000000_x.sql"]);
  assert.deepEqual(planMigrations(files, [{ version: "8", name: "x" }, { version: "9", name: "x" }]).pending, []);
  assert.equal(planMigrations(files, []).pending.length, 2);
});

test("every file in the repository is named so it can be planned", () => {
  const files = listMigrations("supabase/migrations");
  assert.ok(files.length > 100);
});

test("a baselined file is never pending, whatever the ledger says", () => {
  const files = [f("20261001170000_axo_124_pipeline_integrity")];
  assert.equal(planMigrations(files, [], new Set(["20261001170000_axo_124_pipeline_integrity"])).pending.length, 0);
});

test("every BASELINE.txt entry names a real file", () => {
  const stems = new Set(listMigrations("supabase/migrations").map((m) => m.stem));
  for (const s of readBaseline("supabase/migrations/BASELINE.txt")) assert.ok(stems.has(s), s);
});
