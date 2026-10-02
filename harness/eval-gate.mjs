// The eval gate (AXO-41/44/125). Nothing that changes which model answers a student, or how it
// is prompted, lands without a passing eval run linked to it.
//
//   model_route is a database table, so a route change is a migration. A migration that touches
//   it must carry a header line
//       -- eval-run: <uuid>
//   and the run's evidence file must be committed at evals/runs/<uuid>.json, passed, and cover
//   every model the migration names. An emergency rollback to a route that was already in service
//   instead carries
//       -- eval-run: rollback <migration version it restores>
//   and an evidence file of kind "rollback" naming that version. Nothing else is waived.
//
// CI cannot read the production database, so the link is enforced against the committed evidence
// summary, which is exported from the eval_run rows. It holds numbers, model names and case ids,
// never student text.
//
//   node harness/eval-gate.mjs --base origin/main
//
// The checker is a pure function so the rule itself is tested without git.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MODEL = /gemini-[0-9][\w.-]*/gi;

/** Strip SQL comments so a model name in a comment does not count as a route change. */
function code(sql) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

export function touchesModelRoute(sql) {
  return /\bmodel_route\b/i.test(code(sql));
}

/**
 * @param {{path: string, text: string}[]} migrations  changed or added migration files
 * @param {(id: string) => object | null} readEvidence  parsed evals/runs/<id>.json, or null
 * @returns {string[]} violations; empty means the gate passes
 */
export function checkEvalGate(migrations, readEvidence) {
  const violations = [];
  for (const { path: file, text } of migrations) {
    if (!touchesModelRoute(text)) continue;
    const header = text.match(/^--\s*eval-run:\s*(.+)$/im)?.[1]?.trim();
    if (!header) {
      violations.push(`${file}: changes model_route with no "-- eval-run: <uuid>" header. A route change needs a linked passing eval run.`);
      continue;
    }

    const rollback = header.match(/^rollback\s+(\S+)/i);
    if (rollback) {
      const evidence = readEvidence(`rollback-${rollback[1]}`);
      if (!evidence || evidence.kind !== "rollback" || String(evidence.restores) !== rollback[1]) {
        violations.push(`${file}: rollback to ${rollback[1]} has no evals/runs/rollback-${rollback[1]}.json of kind "rollback" naming it.`);
      }
      continue;
    }

    const id = header.match(UUID)?.[0]?.toLowerCase();
    if (!id) {
      violations.push(`${file}: eval-run header "${header}" is not a uuid.`);
      continue;
    }
    const evidence = readEvidence(id);
    if (!evidence) {
      violations.push(`${file}: eval run ${id} has no committed evidence at evals/runs/${id}.json.`);
      continue;
    }
    if (evidence.eval_run_id?.toLowerCase() !== id) violations.push(`${file}: evals/runs/${id}.json names a different run (${evidence.eval_run_id}).`);
    if (evidence.kind !== "eval") violations.push(`${file}: evals/runs/${id}.json is kind "${evidence.kind}", not a passing "eval" run.`);
    if (evidence.passed !== true) violations.push(`${file}: eval run ${id} did not pass. A failing or unfinished run cannot back a route change.`);
    if (evidence.human_labelled_extraction !== true && evidence.release_gate_extraction === true) {
      violations.push(`${file}: eval run ${id} gates extraction on labels no human has confirmed. Draft labels are never release-gate truth.`);
    }
    const covered = new Set((evidence.candidate_models ?? []).map((m) => String(m).toLowerCase()));
    for (const model of new Set((code(text).match(MODEL) ?? []).map((m) => m.toLowerCase()))) {
      if (!covered.has(model)) violations.push(`${file}: names ${model}, which eval run ${id} did not evaluate.`);
    }
  }
  return violations;
}

function changedMigrations(base) {
  const names = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", "supabase/migrations"], { encoding: "utf8" })
    .split("\n").filter((n) => n.endsWith(".sql"));
  return names.map((p) => ({ path: p, text: readFileSync(p, "utf8") }));
}

function evidenceReader(root) {
  return (id) => {
    const file = path.join(root, "evals", "runs", `${id}.json`);
    if (!existsSync(file)) return null;
    try { return JSON.parse(readFileSync(file, "utf8")); } catch { return { kind: "unreadable" }; }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[process.argv.indexOf("--base") + 1] ?? "origin/main";
  const violations = checkEvalGate(changedMigrations(base), evidenceReader(process.cwd()));
  if (violations.length) {
    console.error("Eval gate failed:\n" + violations.map((v) => `  - ${v}`).join("\n"));
    process.exit(1);
  }
  console.log("Eval gate: no model_route change without a linked passing eval run.");
}
