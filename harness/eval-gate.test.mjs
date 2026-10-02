import test from "node:test";
import assert from "node:assert/strict";
import { checkEvalGate, touchesModelRoute } from "./eval-gate.mjs";

const ID = "11111111-2222-4333-8444-555555555555";
const mig = (text, p = "supabase/migrations/20261003000000_x.sql") => [{ path: p, text }];
const passing = (over = {}) => ({
  eval_run_id: ID, kind: "eval", passed: true, human_labelled_extraction: true,
  candidate_models: ["gemini-3.8-flash"], ...over,
});
const reader = (evidence) => (id) => (id === ID || id.startsWith("rollback-") ? evidence : null);

test("a migration that does not touch model_route needs nothing", () => {
  assert.deepEqual(checkEvalGate(mig("alter table public.paper add column x int;"), () => null), []);
});

test("model_route in a comment alone is not a route change", () => {
  assert.equal(touchesModelRoute("-- we will not change model_route here\nselect 1;"), false);
  assert.equal(touchesModelRoute("update public.model_route set primary_model = 'gemini-3.8-flash';"), true);
});

test("a route change with no eval-run header is refused", () => {
  const v = checkEvalGate(mig("update public.model_route set primary_model = 'gemini-3.8-flash' where stage = 'explain';"), () => null);
  assert.equal(v.length, 1);
  assert.match(v[0], /no "-- eval-run: <uuid>" header/);
});

test("a header whose run has no committed evidence is refused", () => {
  const v = checkEvalGate(mig(`-- eval-run: ${ID}\nupdate public.model_route set primary_model = 'gemini-3.8-flash';`), () => null);
  assert.match(v[0], /no committed evidence/);
});

test("a failing or unfinished run cannot back a route change", () => {
  const sql = `-- eval-run: ${ID}\nupdate public.model_route set primary_model = 'gemini-3.8-flash';`;
  assert.match(checkEvalGate(mig(sql), reader(passing({ passed: false })))[0], /did not pass/);
  assert.match(checkEvalGate(mig(sql), reader(passing({ passed: null })))[0], /did not pass/);
});

test("a passing run that never evaluated the model in the migration is refused", () => {
  const sql = `-- eval-run: ${ID}\nupdate public.model_route set primary_model = 'gemini-3.6-flash';`;
  const v = checkEvalGate(mig(sql), reader(passing()));
  assert.match(v.join("\n"), /names gemini-3\.6-flash, which eval run .* did not evaluate/);
});

test("extraction gated on draft labels is never release-gate truth", () => {
  const sql = `-- eval-run: ${ID}\nupdate public.model_route set primary_model = 'gemini-3.8-flash';`;
  const v = checkEvalGate(mig(sql), reader(passing({ human_labelled_extraction: false, release_gate_extraction: true })));
  assert.match(v.join("\n"), /Draft labels are never release-gate truth/);
});

test("a passing run that covers the model passes the gate", () => {
  const sql = `-- eval-run: ${ID}\nupdate public.model_route set primary_model = 'gemini-3.8-flash' where stage = 'explain';`;
  assert.deepEqual(checkEvalGate(mig(sql), reader(passing())), []);
});

test("evidence for a different run than the header names is refused", () => {
  const sql = `-- eval-run: ${ID}\nupdate public.model_route set primary_model = 'gemini-3.8-flash';`;
  const v = checkEvalGate(mig(sql), reader(passing({ eval_run_id: "99999999-2222-4333-8444-555555555555" })));
  assert.match(v.join("\n"), /names a different run/);
});

test("a rollback is allowed only with rollback evidence naming what it restores", () => {
  const sql = "-- eval-run: rollback 20261001132115\nupdate public.model_route set primary_model = 'gemini-3.8-flash';";
  assert.match(checkEvalGate(mig(sql), () => null)[0], /has no evals\/runs\/rollback-20261001132115\.json/);
  const ok = checkEvalGate(mig(sql), () => ({ kind: "rollback", restores: "20261001132115" }));
  assert.deepEqual(ok, []);
  const wrong = checkEvalGate(mig(sql), () => ({ kind: "eval", restores: "20261001132115" }));
  assert.equal(wrong.length, 1);
});

test("one bad migration among several is still reported", () => {
  const good = { path: "supabase/migrations/a.sql", text: "create table t(i int);" };
  const bad = { path: "supabase/migrations/b.sql", text: "update public.model_route set enabled = false;" };
  assert.equal(checkEvalGate([good, bad], () => null).length, 1);
});
