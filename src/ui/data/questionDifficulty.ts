import type { InsightAttempt, InsightLoss, InsightPaper, InsightFilters } from "./insights";
import { applyFilters, normaliseTopic } from "./insights";

export type DifficultyEvidence = {
  attempt_id: string; paper_id: string; band: number; normalized_score: number;
  confidence: number; source: string; method_version: string;
  max_marks: number | null; marks_awarded: number | null;
};
export const BANDS = ["Very easy", "Easy", "Medium", "Hard", "Very hard"] as const;
export const SOURCE_LABEL: Record<string, string> = {
  official_board_statistics: "From published board statistics",
  structural_estimate: "Estimate from question structure",
  anonymized_historical: "Estimate from grouped historical performance",
  model_estimate: "AI-estimated difficulty",
};

/** Never imply a low-confidence estimate is a board's assessment. */
export function questionDifficultyLabel(r: DifficultyEvidence): string {
  const band = BANDS[r.band - 1] ?? "Unknown";
  return r.source === "official_board_statistics"
    ? `${band} · published evidence`
    : `${band} · estimated`;
}

export type DifficultyInsight = {
  topic: string; band: number; count: number; papers: number; lost: number;
  confidence: "low" | "mixed" | "high";
};
export function difficultyInsights(args: {
  papers: InsightPaper[]; attempts: InsightAttempt[]; losses: InsightLoss[];
  ratings: DifficultyEvidence[]; filters: InsightFilters; now?: number;
}): { rated: number; rows: DifficultyInsight[] } {
  const allowed = new Set(applyFilters(args.papers,args.filters,args.now ?? Date.now()).map(p => p.id));
  const valid = args.ratings.filter(r => allowed.has(r.paper_id)
    && Number.isInteger(r.band) && r.band >= 1 && r.band <= 5
    && r.confidence >= 0 && r.confidence <= 1);
  const byId = new Map(args.attempts.map(a => [a.id,a]));
  const topics = new Map<string,{topic:string;band:number;count:number;paperIds:Set<string>;lost:number;estimated:number}>();
  // One rating per attempt. Loss events may mention multiple syllabus concepts.
  for (const r of valid) {
    const attempt=byId.get(r.attempt_id);
    if (!attempt || attempt.paper_id !== r.paper_id || !Number.isFinite(Number(r.max_marks))
        || !Number.isFinite(Number(r.marks_awarded)) || Number(r.max_marks) <= 0
        || Number(r.marks_awarded) > Number(r.max_marks) || Number(r.marks_awarded) < 0) continue;
    const atLoss = args.losses.filter(l => l.attempt_id === r.attempt_id);
    const words=new Set(atLoss.flatMap(l => l.concepts ?? []).map(normaliseTopic).filter(t => t.length >= 3));
    const lost=Math.max(0,Number(r.max_marks)-Number(r.marks_awarded));
    for(const topic of words) {
      const k=`${topic}|${r.band}`;
      const v=topics.get(k) ?? {topic,band:r.band,count:0,paperIds:new Set<string>(),lost:0,estimated:0};
      v.count++; v.paperIds.add(r.paper_id); v.lost+=lost; if(r.confidence < .6) v.estimated++;
      topics.set(k,v);
    }
  }
  // Never call one question a pattern: at least 3 questions from 2 different papers.
  const rows=[...topics.values()].filter(x=>x.count>=3 && x.paperIds.size>=2)
    .map(x=>({topic:x.topic,band:x.band,count:x.count,papers:x.paperIds.size,lost:x.lost,
      confidence:x.estimated === 0 ? "high" as const : x.estimated === x.count ? "low" as const : "mixed" as const}))
    .sort((a,b)=>b.lost-a.lost || b.count-a.count).slice(0,5);
  return {rated:new Set(valid.map(x=>x.attempt_id)).size,rows};
}
