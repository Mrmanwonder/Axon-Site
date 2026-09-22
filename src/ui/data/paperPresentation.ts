import { PAPER_STATUS, statusKeyForRun } from "./modules";
import type { Paper, ProgressRow } from "./modules";
import { isStale } from "./useResource";
import type { Loadable } from "./useResource";
import { paths } from "../app/paths";

export function paperPresentation(paper: Paper, progress: Loadable<Map<string, ProgressRow>>) {
  const run = progress.data?.get(paper.id);
  const key = run ? statusKeyForRun(run.status) : null;
  const status = key ? PAPER_STATUS[key] : null;
  const stale = isStale(progress);
  const committed = ((paper.student_attempt as { count: number }[] | undefined)?.[0]?.count ?? 0) > 0;
  const reason = typeof run?.status_reason === "string" ? run.status_reason.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 280) : null;
  return {
    status: key ?? (committed ? "committed" : "unknown"),
    statusLabel: status?.label ?? (committed ? "Saved" : progress.state === "ready" ? "Not read yet" : "Status unavailable"),
    stale, reason,
    destination: status || !committed ? paths.review(paper.id) : paths.paper(paper.id),
    canOpen: committed || (progress.state === "ready" && !stale),
    tone: status?.tone ?? "wait",
  };
}
