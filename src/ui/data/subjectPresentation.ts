import type { LibrarySearchHit, Paper, ProgressRow } from "./modules";

/** The subject a paper shows: verified identity first, then the reader's suggestion. Shared by Library and the paper screen so they never disagree. */
export function subjectPresentation(paper: Paper, hit?: LibrarySearchHit, run?: ProgressRow) {
  if (
    paper.subject_offering_id
    && paper.subject_identity_confidence === "verified"
    && paper.subject_display_snapshot
  ) {
    return { state: "verified" as const, label: paper.subject_display_snapshot };
  }

  // A search hit is fresh server-authored subject state. Respect an explicit
  // unknown rather than reviving an older progress suggestion underneath it.
  if (hit?.subject_state === "unknown") {
    return { state: "unknown" as const, label: "Subject unknown" };
  }

  const hitSuggestion = hit?.subject_state === "suggested"
    && typeof hit.suggested_subject === "string"
    && hit.suggested_subject.trim()
    ? hit.suggested_subject.trim()
    : null;
  const progressSuggestion = typeof run?.suggested_subject === "string" && run.suggested_subject.trim()
    ? run.suggested_subject.trim()
    : null;
  const legacySuggestion = typeof paper.subject === "string" && paper.subject.trim()
    ? paper.subject.trim()
    : null;
  const suggested = hitSuggestion ?? progressSuggestion ?? legacySuggestion;

  if (suggested) return { state: "suggested" as const, label: suggested };
  return { state: "unknown" as const, label: "Subject unknown" };
}
