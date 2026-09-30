/* ═══════════════════════════════════════════════════════════════════════════
   PAPER REVIEW — re-entry

   Review is server-resumable. A paper may have been retried from Library or
   started on another device, so this route must never depend on a local draft
   existing in IndexedDB. Library progress is the live source of truth while
   the pipeline is running; once the run becomes reviewable, ScanProvider opens
   the existing ReviewSheet over this route.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useScan } from "../scan/ScanProvider";
import type { ResumeReviewResult } from "../scan/ScanProvider";
import { useApp } from "../data/AppProvider";
import type { ProgressRow } from "../data/modules";
import { paths } from "../app/paths";
import PageSkeleton from "../components/PageSkeleton";

type WorkTask = {
  key: string;
  label: string;
  statuses: string[];
};

const WORK_TASKS: WorkTask[] = [
  { key: "triage", label: "Checking this is a marked paper", statuses: ["queued", "triaging"] },
  { key: "structure", label: "Finding pages and questions", statuses: ["structure", "cropping"] },
  { key: "content", label: "Reading answers and teacher marks", statuses: ["content"] },
  { key: "attribution", label: "Matching marks to questions", statuses: ["attribution"] },
  { key: "reconcile", label: "Checking totals and uncertain marks", statuses: ["reconciliation", "adjudicating"] },
  { key: "review", label: "Preparing the parts that need your eyes", statuses: ["needs_review"] },
  { key: "explain", label: "Working out where marks were lost", statuses: ["explaining"] },
  { key: "ready", label: "Finishing your paper", statuses: ["ready"] },
];

const TERMINAL = new Set(["failed", "rejected", "committed"]);
const REVIEWABLE = new Set(["needs_review", "explaining", "ready"]);

function taskIndex(status?: string | null) {
  const index = WORK_TASKS.findIndex((task) => task.statuses.includes(status ?? ""));
  return index < 0 ? 0 : index;
}

function liveDetail(run?: ProgressRow) {
  if (!run) return "Getting the latest status…";
  const pagesTotal = Number(run.pages_total ?? 0);
  const pagesDone = Number(run.pages_done ?? 0);
  const questionsTotal = Number(run.questions_total ?? 0);
  const questionsDone = Number(run.questions_done ?? 0);

  if (["structure", "cropping"].includes(run.status) && pagesTotal > 0) {
    return `${Math.min(pagesDone, pagesTotal)} of ${pagesTotal} pages mapped`;
  }
  if (["content", "attribution"].includes(run.status) && questionsTotal > 0) {
    return `${Math.min(questionsDone, questionsTotal)} of ${questionsTotal} questions read`;
  }
  if (["reconciliation", "adjudicating"].includes(run.status) && questionsTotal > 0) {
    return `${questionsTotal} question${questionsTotal === 1 ? "" : "s"} being checked together`;
  }
  if (["queued", "triaging"].includes(run.status) && pagesTotal > 0) {
    return `${pagesTotal} page${pagesTotal === 1 ? "" : "s"} safely uploaded`;
  }
  return "This updates as the paper moves through Axon.";
}

function ProcessingVisual() {
  return (
    <div className="paperwork-visual" aria-hidden="true">
      <div className="paperwork-glow" />
      <svg className="paperwork-links" viewBox="0 0 240 170">
        <path d="M42 52 C72 37 87 45 103 67" />
        <path d="M198 45 C168 35 151 46 137 66" />
        <path d="M48 126 C78 135 92 124 105 106" />
        <path d="M191 129 C163 138 147 125 135 106" />
      </svg>
      <span className="paperwork-node n1" />
      <span className="paperwork-node n2" />
      <span className="paperwork-node n3" />
      <span className="paperwork-node n4" />
      <div className="paperwork-sheet">
        <span className="paperwork-line l1" />
        <span className="paperwork-line l2" />
        <span className="paperwork-line l3" />
        <span className="paperwork-mark m1" />
        <span className="paperwork-mark m2" />
        <span className="paperwork-beam" />
      </div>
    </div>
  );
}

function ProcessingState({ run }: { run?: ProgressRow }) {
  const current = taskIndex(run?.status);
  const currentTask = WORK_TASKS[current];

  return (
    <main className="paperwork">
      <section className="paperwork-hero" role="status" aria-live="polite">
        <ProcessingVisual />
        <div className="paperwork-eyebrow">Working on your paper</div>
        <h1>{currentTask.label}</h1>
        <p>{liveDetail(run)}</p>
      </section>

      <section className="card paperwork-tasks" aria-label="Paper processing tasks">
        {WORK_TASKS.map((task, index) => {
          const state = index < current ? "done" : index === current ? "now" : "wait";
          return (
            <div className={"paperwork-task " + state} key={task.key}>
              <span className={"paperwork-state " + state}>
                {state === "done" && (
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 6.5 4.5 9 10 3.5" />
                  </svg>
                )}
              </span>
              <span>{task.label}</span>
            </div>
          );
        })}
      </section>

      <p className="paperwork-note">
        You can leave this screen. Your pages are already saved and the work continues safely.
      </p>
      <Link to={paths.library} className="btn ghost paperwork-back">
        Back to Library
      </Link>
    </main>
  );
}

export default function PaperReview() {
  const { draftId } = useParams();
  const { ensureScan, reviewOpen } = useScan();
  const { student, progressResource, refreshLibrary } = useApp();

  const [result, setResult] = useState<ResumeReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = draftId ? progressResource.data?.get(draftId) : undefined;
  useEffect(() => {
    if (!draftId || !student) return;
    let cancelled = false;

    const settleFromServer = () => {
      if (!run) return false;
      if (run.status === "committed") {
        setResult({ state: "committed", paperId: draftId });
        setError(null);
        return true;
      }
      if (run.status === "failed" || run.status === "rejected") {
        setResult({ state: "stopped", reason: run.status_reason ?? null });
        setError(null);
        return true;
      }
      if (!REVIEWABLE.has(run.status)) {
        setResult({ state: "processing" });
        setError(null);
        return true;
      }
      return false;
    };

    if (settleFromServer()) return;

    (async () => {
      try {
        const scan = await ensureScan();
        if (cancelled) return;
        const next = await scan.resumeDraftReview(draftId);
        if (cancelled) return;

        // If Library already proves a live run exists, a second surface is not
        // allowed to contradict it with "gone". Keep showing the live server
        // state and let the next progress/realtime tick retry re-entry.
        if (next.state === "gone" && run && !TERMINAL.has(run.status)) {
          setResult({ state: "processing" });
          setError(null);
          return;
        }

        setResult(next);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "That paper could not be reopened.");
      }
    })();

    return () => { cancelled = true; };
  }, [draftId, student?.id, ensureScan, run?.status, run?.status_reason]);

  // Realtime is the fast path. Polling is the recovery path for a socket that
  // dropped while the app was backgrounded, and means a processing screen can
  // naturally turn into Review without the student closing and reopening it.
  useEffect(() => {
    if (!draftId || !student || reviewOpen || !run || TERMINAL.has(run.status)) return;
    let active = true;
    const refresh = () => {
      if (!active || document.visibilityState === "hidden") return;
      void refreshLibrary().catch(() => { /* current live state remains visible */ });
    };
    const timer = window.setInterval(refresh, 2500);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    addEventListener("online", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      removeEventListener("online", refresh);
    };
  }, [draftId, student?.id, reviewOpen, run?.status, refreshLibrary]);

  if (reviewOpen) return null;

  const liveProcessing = Boolean(run && !TERMINAL.has(run.status) && !REVIEWABLE.has(run.status));
  const liveReviewHandoff = Boolean(run && REVIEWABLE.has(run.status) && result?.state !== "reviewing");

  if (liveProcessing || liveReviewHandoff || result?.state === "processing") {
    return <ProcessingState run={run} />;
  }

  if (error) {
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">{error}</p>
        <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
          Back to Library
        </Link>
      </div>
    );
  }

  if (!result || (progressResource.state === "loading" && !run)) {
    return <PageSkeleton variant="review" label="Loading review…" />;
  }

  if (result.state === "reviewing") {
    return <PageSkeleton variant="review" label="Opening review…" />;
  }

  if (result.state === "committed") {
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">This paper is already saved — there is nothing left to review.</p>
        <Link to={paths.paper(result.paperId)} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
          Open the paper
        </Link>
      </div>
    );
  }

  if (result.state === "stopped") {
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">{result.reason || "We could not finish reading this paper."}</p>
        <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
          Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px var(--text-gutter)" }}>
      <p className="subnote">We couldn&rsquo;t find this paper to review. It may have been removed.</p>
      <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
        Back to Library
      </Link>
    </div>
  );
}
