/* ═══════════════════════════════════════════════════════════════════════════
   THE ANALYTICS READS

   Everything Home and Insights need to say something true, and nothing they
   could use to say something plausible instead.

   `state` has three values and the distinction matters: "loading" is not
   "empty". A surface that renders its empty state while a read is still in
   flight tells a student they have no papers a moment before their papers
   appear, and a surface that renders zeroes on a failed read tells them their
   marks are zero. Both are lies with a confident face, which is the specific
   failure hard rule 4 exists to prevent.

   Cached evidence is allowed to paint immediately because past papers are an
   explicit offline feature. The network refresh starts at the same time and
   replaces that snapshot when it lands. Consent does not use this path.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useResource, isStale } from "./useResource";
import {
  lossByCause, needsCheck, unreadablePages, analyticsReadiness,
} from "./modules";
import { useApp } from "./AppProvider";
import { getCached } from "../../cache.js";

export type Readiness = {
  papers_counted: number;
  questions_counted: number;
  has_enough_data: boolean;
};

export type Analytics = {
  state: "loading" | "ready" | "failed";
  readiness: Readiness | null;
  /** cause -> marks lost. Empty object is a real answer; null is "we do not know". */
  loss: Record<string, number> | null;
  needsCheck: { count: number; papers: number } | null;
  /** True when any of these came from the offline cache rather than the network. */
  stale: boolean;
  unreadable: { id: string; paper_id: string; page_number: number; reason: string }[] | null;
  reload: () => Promise<void>;
};

export function useAnalytics(): Analytics {
  const { student } = useApp();
  const { resource, reload } = useResource(student?.id ?? null, async () => {
    const [r, l, c, u] = await Promise.all([
      analyticsReadiness(student!.id), lossByCause(student!.id),
      needsCheck(student!.id), unreadablePages(student!.id),
    ]);
    return { data: { readiness: r.data, loss: l.data, needsCheck: c.data, unreadable: u.data },
      stale: r.stale || l.stale || c.stale || u.stale };
  }, async () => {
    const [readiness, loss, check, unreadable] = await Promise.all([
      getCached(`readiness:${student!.id}`), getCached(`loss:${student!.id}`),
      getCached(`needscheck:${student!.id}`), getCached(`unreadable:${student!.id}`),
    ]);
    // Only a complete cached aggregate can stand in for this resource. Missing
    // evidence remains unknown while the concurrent live request resolves.
    if ([readiness, loss, check, unreadable].some(value => value === null)) return null;
    return { readiness: readiness as Readiness, loss: loss as Record<string, number>,
      needsCheck: check as NonNullable<Analytics["needsCheck"]>, unreadable: unreadable as NonNullable<Analytics["unreadable"]> };
  });
  return {
    state: resource.state, readiness: resource.data?.readiness ?? null,
    loss: resource.data?.loss ?? null, needsCheck: resource.data?.needsCheck ?? null,
    unreadable: resource.data?.unreadable ?? null, stale: isStale(resource), reload,
  };

}
