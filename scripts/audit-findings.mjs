import { createHash } from "node:crypto";

const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const STATES = new Set(["open", "resolved"]);
const EVIDENCE = new Set(["VERIFIED", "INFERRED", "UNAVAILABLE"]);

export function findingFingerprint(finding) {
  const parts = ["issue_id", "system", "check_id", "evidence_key"].map((key) => {
    if (typeof finding[key] !== "string" || !finding[key].trim()) throw new Error("Missing finding " + key);
    return finding[key];
  });
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/**
 * Pure reconciliation. Save the returned state only AFTER successful Linear writes.
 * A partial run keeps its last complete cursor so unobserved changes are rechecked.
 * Absence from a run is never proof that a previous finding was resolved.
 */
export function reconcileAudit(previous = {}, run) {
  if (!run || typeof run.at !== "string" || !Number.isFinite(Date.parse(run.at))) throw new Error("Invalid run timestamp");
  if (!Array.isArray(run.findings) || !Array.isArray(run.failed_checks)) throw new Error("Invalid audit arrays");
  if (typeof run.complete !== "boolean") throw new Error("Missing complete flag");
  if (run.complete && run.failed_checks.length) throw new Error("A failed check cannot advance a complete cursor");
  const findings = structuredClone(previous.findings || {});
  const updates = [];
  const seen = new Set();
  for (const finding of run.findings) {
    const fingerprint = findingFingerprint(finding);
    if (seen.has(fingerprint)) throw new Error("Duplicate finding in run: " + fingerprint);
    seen.add(fingerprint);
    if (!SEVERITIES.has(finding.severity) || !STATES.has(finding.state) || !EVIDENCE.has(finding.evidence_status)) throw new Error("Invalid finding classification");
    if (finding.state === "resolved" && finding.evidence_status !== "VERIFIED") throw new Error("Resolution requires verified evidence");
    if (typeof finding.evidence !== "string" || !finding.evidence.trim()) throw new Error("Missing evidence description");
    const old = findings[fingerprint];
    // Evidence timestamps/counts can refresh silently. Canonical object identity,
    // state or severity determines posting, matching the audit runbook.
    if (!old || old.last_posted_state !== finding.state || old.last_posted_severity !== finding.severity) {
      updates.push({ ...finding, fingerprint });
    }
    findings[fingerprint] = {
      ...old, ...finding, fingerprint,
      first_seen: old?.first_seen || run.at, last_seen: run.at,
      last_posted_state: finding.state, last_posted_severity: finding.severity,
      linear_comment_id: finding.linear_comment_id || old?.linear_comment_id || null,
    };
  }
  return {
    updates,
    checkpoint: {
      ...previous, findings, last_attempt_at: run.at,
      partial: !run.complete, failed_checks: [...run.failed_checks],
      ...(run.complete ? { last_complete_at: run.at, cursor: structuredClone(run.cursor) } : {}),
    },
  };
}
