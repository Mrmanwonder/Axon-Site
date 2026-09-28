import { getCached } from "../../cache.js";
import { readPaper } from "./modules";
import type { PaperDetail } from "./modules";
import { isStale, useResource } from "./useResource";

/**
 * Saved paper detail is explicitly an offline-readable, student-keyed resource.
 *
 * The cache is display-only: live Student Mode/RLS remains the authority and
 * reconciles concurrently. The key contains both student and paper identity,
 * while useResource's request generation prevents an older profile/read from
 * repainting after the identity changes.
 */
export function usePaperResource(
  studentId: string | null | undefined,
  paperId: string | null | undefined,
) {
  const cacheKey = studentId && paperId ? `paper:${studentId}:${paperId}` : null;
  const { resource, reload } = useResource<PaperDetail>(
    cacheKey,
    () => readPaper(studentId!, paperId!),
    () => getCached(cacheKey!),
  );

  return {
    resource,
    reload,
    paper: resource.data,
    stale: isStale(resource),
    error: resource.state === "failed" ? resource.error : null,
  };
}
