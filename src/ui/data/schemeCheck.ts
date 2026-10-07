/**
 * Scheme check of an unmarked Cambridge paper (owner decision, 6 Oct 2026).
 *
 * Axon reads the published mark scheme for the exact paper the student scanned
 * and writes, per question, feedback and an ESTIMATED mark. These rows are
 * never teacher marks: they live in their own tables, never reach
 * attempt_analytics, and every surface labels them as Axon's estimate.
 */
import { useEffect, useState } from "react";
import { sb } from "./modules";

export type PaperCheck = {
  run_id: string;
  paper_label: string;
  status: "queued" | "running" | "done" | "failed" | "unavailable";
  reason: string | null;
  checked: number;
};

export type RegionCheck = {
  region_id: string;
  can_check: boolean;
  reason: string | null;
  estimated_marks: number | null;
  max_marks: number | null;
  confidence: "likely" | "unsure";
  what_was_right: string | null;
  what_was_missing: string[];
  do_this_next: string | null;
};

export type SchemeCheckState = { check: PaperCheck | null; regions: Map<string, RegionCheck>; loaded: boolean };

const EMPTY: SchemeCheckState = { check: null, regions: new Map(), loaded: false };

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function readSchemeCheck(paperId: string): Promise<SchemeCheckState> {
  const { data: checks, error } = await sb.from("paper_check")
    .select("run_id, paper_label, status, reason, checked, created_at")
    .eq("paper_id", paperId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const check = (checks?.[0] ?? null) as PaperCheck | null;
  if (!check) return { check: null, regions: new Map(), loaded: true };
  const { data: rows, error: rowsError } = await sb.from("region_check")
    .select("region_id, can_check, reason, estimated_marks, max_marks, confidence, what_was_right, what_was_missing, do_this_next")
    .eq("run_id", check.run_id);
  if (rowsError) throw rowsError;
  const regions = new Map<string, RegionCheck>();
  for (const r of (rows ?? []) as RegionCheck[]) {
    regions.set(r.region_id, { ...r, estimated_marks: num(r.estimated_marks), max_marks: num(r.max_marks), what_was_missing: r.what_was_missing ?? [] });
  }
  return { check, regions, loaded: true };
}

/** Reads the check, and polls while it is still running. A read failure leaves the paper as it was. */
export function useSchemeCheck(paperId: string | null | undefined): SchemeCheckState {
  const [state, setState] = useState<SchemeCheckState>(EMPTY);
  useEffect(() => {
    if (!paperId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await readSchemeCheck(paperId);
        if (!alive) return;
        setState(next);
        if (next.check && (next.check.status === "queued" || next.check.status === "running")) {
          timer = setTimeout(load, 6000);
        }
      } catch {
        if (alive) setState((s) => ({ ...s, loaded: true }));
      }
    };
    void load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [paperId]);
  return state;
}

/** Sum of estimates over the questions that could be checked. */
export function estimateTotals(regions: Map<string, RegionCheck>): { estimated: number; max: number; checked: number } {
  let estimated = 0, max = 0, checked = 0;
  for (const r of regions.values()) {
    if (!r.can_check || r.estimated_marks === null || r.max_marks === null) continue;
    estimated += r.estimated_marks;
    max += r.max_marks;
    checked++;
  }
  return { estimated, max, checked };
}
