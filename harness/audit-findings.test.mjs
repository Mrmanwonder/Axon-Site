import test from "node:test";
import assert from "node:assert/strict";
import { findingFingerprint, reconcileAudit } from "../scripts/audit-findings.mjs";

const f = { issue_id: "AXO-81", system: "supabase", check_id: "function-effect-parity",
  evidence_key: "private.commit_extraction_run", severity: "high", state: "open",
  evidence_status: "VERIFIED", evidence: "Function differs from canonical main" };
const run = (findings, extra = {}) => ({ at: "2026-10-03T06:00:00Z", complete: true,
  failed_checks: [], cursor: { site: "abc" }, findings, ...extra });

test("unchanged findings refresh silently despite newer evidence or counts", () => {
  const first = reconcileAudit({}, run([f]));
  assert.equal(first.updates.length, 1);
  const next = reconcileAudit(first.checkpoint, run([{ ...f, evidence: "Same discrepancy; observed again" }], { at: "2026-10-03T07:00:00Z" }));
  assert.equal(next.updates.length, 0);
  assert.equal(next.checkpoint.findings[findingFingerprint(f)].last_seen, "2026-10-03T07:00:00Z");
});
test("severity and verified resolution each post once", () => {
  const first = reconcileAudit({}, run([f]));
  const severe = reconcileAudit(first.checkpoint, run([{ ...f, severity: "critical" }]));
  assert.equal(severe.updates.length, 1);
  const resolved = reconcileAudit(severe.checkpoint, run([{ ...f, severity: "critical", state: "resolved" }]));
  assert.equal(resolved.updates.length, 1);
  assert.equal(reconcileAudit(resolved.checkpoint, run([{ ...f, severity: "critical", state: "resolved" }])).updates.length, 0);
});
test("partial run retains the complete cursor and missing findings stay open", () => {
  const first = reconcileAudit({}, run([f]));
  const next = reconcileAudit(first.checkpoint, run([], { complete: false, failed_checks: ["production headers"], cursor: { site: "new" } }));
  assert.deepEqual(next.checkpoint.cursor, { site: "abc" });
  assert.equal(next.checkpoint.findings[findingFingerprint(f)].state, "open");
  assert.equal(next.checkpoint.partial, true);
});
test("unavailable or inferred observations cannot resolve findings", () => {
  for (const evidence_status of ["UNAVAILABLE", "INFERRED"]) {
    assert.throws(() => reconcileAudit({}, run([{ ...f, state: "resolved", evidence_status }])), /verified evidence/);
  }
});
test("duplicate identities and contradictory completion fail before any write", () => {
  assert.throws(() => reconcileAudit({}, run([f, f])), /Duplicate/);
  assert.throws(() => reconcileAudit({}, run([], { failed_checks: ["GitHub timeout"] })), /failed check/);
});
test("structured identity avoids ambiguous delimiter collisions", () => {
  assert.notEqual(findingFingerprint({ ...f, system: "a|b", check_id: "c" }),
    findingFingerprint({ ...f, system: "a", check_id: "b|c" }));
});
