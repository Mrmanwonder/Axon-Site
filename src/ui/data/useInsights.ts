/* ═══════════════════════════════════════════════════════════════════════════
   THE INSIGHTS READ

   Rows from the two analytics views, joined in memory to the library's papers
   and handed to the pure engine in `insights.ts`. Filters run on the client
   so every module answers for exactly the papers selected — the previous cause
   breakdown could only describe "all papers" and had to refuse every filter.

   The read is keyed to the library's contents as well as the student, so a
   paper saved in this session (or on another device, via the live library)
   re-reads the evidence instead of leaving Insights a paper behind.

   Same three states as every other analytics read: loading is not empty and a
   failed read is not zero.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { useResource, isStale } from "./useResource";
import { insightEvidence, syllabusMapData } from "./modules";
import { buildSyllabusMaps } from "./syllabusMap";
import type { SyllabusMapInput } from "./syllabusMap";
import { useApp } from "./AppProvider";
import { getCached } from "../../cache.js";
import { buildInsights } from "./insights";
import { difficultyInsights } from "./questionDifficulty";
import type { DifficultyEvidence, DifficultyInsight } from "./questionDifficulty";
import type { InsightAttempt, InsightLoss, InsightFilters, InsightsModel, InsightPaper } from "./insights";

type Evidence = { attempts: InsightAttempt[]; losses: InsightLoss[]; difficulty: DifficultyEvidence[] };

export type InsightsRead = {
  state: "loading" | "ready" | "failed";
  model: InsightsModel | null;
  difficulty: { rated: number; rows: DifficultyInsight[] } | null;
  stale: boolean;
  reload: () => Promise<void>;
};

function librarySignature(papers: InsightPaper[]): string {
  // Order-independent and cheap: which papers exist and what their totals are.
  return papers.map((p) => `${p.id}:${p.total_awarded ?? ""}/${p.total_available ?? ""}`).sort().join("|");
}

export function useInsightEvidence() {
  const { student, papers, papersResource } = useApp();
  const signature = useMemo(() => librarySignature(papers as InsightPaper[]), [papers]);
  const key = student?.id ? `${student.id}#${signature}` : null;
  const { resource, reload } = useResource<Evidence>(key, async () => {
    const r = await insightEvidence(student!.id);
    return { data: r.data, stale: r.stale };
  }, async () => {
    const cached = await getCached(`insights:${student!.id}`);
    return (cached as Evidence | null) ?? null;
  });
  // Evidence without its papers cannot be filtered or ordered, and computing
  // over an unloaded library reports "0 papers" a moment before the real
  // count. Until the library has painted once, the whole read is loading.
  const libraryPending = papersResource.state === "loading" && papersResource.data === null;
  return { resource, reload, papers: papers as InsightPaper[], libraryPending };
}

export function useInsights(filters: InsightFilters): InsightsRead {
  const { resource, reload, papers, libraryPending } = useInsightEvidence();
  const evidence = libraryPending ? null : resource.data;
  const model = useMemo(
    () => (evidence ? buildInsights({ papers, attempts: evidence.attempts, losses: evidence.losses, filters }) : null),
    [evidence, papers, filters.subject, filters.type, filters.tier, filters.range],
  );
  const difficulty = useMemo(
    () => evidence ? difficultyInsights({ papers, attempts: evidence.attempts,
      losses: evidence.losses, ratings: evidence.difficulty ?? [], filters }) : null,
    [evidence, papers, filters.subject, filters.type, filters.tier, filters.range],
  );
  return { state: libraryPending ? "loading" : resource.state, model, difficulty, stale: isStale(resource), reload };
}

/** The per-subject syllabus maps, filtered like the rest of Insights. */
export function useSyllabusMaps(filters: InsightFilters) {
  const { student, papers } = useApp();
  const { resource: evidenceResource, libraryPending } = useInsightEvidence();
  const signature = useMemo(() => librarySignature(papers as InsightPaper[]), [papers]);
  const { resource } = useResource<SyllabusMapInput>(student?.id ? `syllabus:${student.id}#${signature}` : null, async () => {
    const r = await syllabusMapData(student!.id);
    return { data: r.data, stale: r.stale };
  }, async () => (await getCached(`syllabus:${student!.id}`)) as SyllabusMapInput | null);
  const attempts = evidenceResource.data?.attempts ?? null;
  const maps = useMemo(
    () => (resource.data && attempts && !libraryPending
      ? buildSyllabusMaps({ data: resource.data, papers: papers as InsightPaper[], attempts, filters })
      : null),
    [resource.data, attempts, libraryPending, papers, filters.subject, filters.type, filters.tier, filters.range],
  );
  return { state: libraryPending ? "loading" as const : resource.state, maps, stale: isStale(resource) };
}
