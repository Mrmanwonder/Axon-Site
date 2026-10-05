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
import { retryAsMarked } from "../data/modules";
import PageSkeleton from "../components/PageSkeleton";
import { usePaperDelete } from "../data/usePaperDelete";
import { useOptionalSheetControls } from "../components/SheetProvider";

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
];

const TERMINAL = new Set(["failed", "rejected", "committed"]);
const REVIEWABLE = new Set(["needs_review", "explaining", "ready"]);
const REVIEW_OPEN_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, message: string, ms = REVIEW_OPEN_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function taskIndex(status?: string | null) {
  const index = WORK_TASKS.findIndex((task) => task.statuses.includes(status ?? ""));
  return index < 0 ? 0 : index;
}

function liveDetail(run?: ProgressRow) {
  if (!run) return "Getting the latest status…";
  const pagesTotal = Number(run.pages_total ?? 0);
  const pagesDone = Number(run.pages_done ?? 0);
  const questionsTotal = Number(run.questions_total ?? 0);
  // questions_done counts regions, which are parts. Compare it with the part
  // total, never with the logical question total (AXO-122).
  const partsTotal = Number(run.parts_total ?? run.questions_total ?? 0);
  const partsDone = Number(run.questions_done ?? 0);

  if (["structure", "cropping"].includes(run.status) && pagesTotal > 0) {
    return `${Math.min(pagesDone, pagesTotal)} of ${pagesTotal} pages mapped`;
  }
  if (["content", "attribution"].includes(run.status) && partsTotal > 0) {
    return `${Math.min(partsDone, partsTotal)} of ${partsTotal} part${partsTotal === 1 ? "" : "s"} read`;
  }
  if (["reconciliation", "adjudicating"].includes(run.status) && partsTotal > 0) {
    const parts = `${partsTotal} part${partsTotal === 1 ? "" : "s"}`;
    return questionsTotal > 0
      ? `${questionsTotal} question${questionsTotal === 1 ? "" : "s"} (${parts}) being checked together`
      : `${parts} being checked together`;
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
  const [retryToken, setRetryToken] = useState(0);

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
        setError(null);
        const scan = await withTimeout(
          ensureScan(),
          "The review is taking too long to start. Try again.",
        );
        if (cancelled) return;
        const next = await withTimeout(
          scan.resumeDraftReview(draftId),
          "The review data is taking too long to load. Try again.",
        );
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
        if (!cancelled) {
          setResult(null);
          setError(e instanceof Error ? e.message : "That paper could not be reopened.");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [draftId, student?.id, ensureScan, run?.status, run?.status_reason, progressResource.state === "ready" ? progressResource.fetchedAt : progressResource.lastSuccessAt, retryToken]);

  // Realtime is the fast path. Polling is the recovery path for a socket that
  // dropped while the app was backgrounded, and means a processing screen can
  // naturally turn into Review without the student closing and reopening it.
  useEffect(() => {
    if (!draftId || !student || reviewOpen || !run || TERMINAL.has(run.status) || REVIEWABLE.has(run.status)) return;
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

  if (error) {
    const needing = Number(run?.questions_needing_you ?? 0);
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">
          {needing > 0
            ? `Axon found ${needing} part${needing === 1 ? "" : "s"} that need your eyes, but the review could not open.`
            : "The review could not open."}
        </p>
        <p className="subnote" style={{ marginTop: 8 }}>{error}</p>
        <button
          type="button"
          className="btn primary"
          style={{ marginTop: 14 }}
          onClick={() => setRetryToken((value) => value + 1)}
        >
          Try again
        </button>
        <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex", marginTop: 10 }}>
          Back to Library
        </Link>
      </div>
    );
  }

  const liveProcessing = Boolean(run && !TERMINAL.has(run.status) && !REVIEWABLE.has(run.status));
  if (liveProcessing || (result?.state === "processing" && !REVIEWABLE.has(run?.status ?? ""))) {
    return <ProcessingState run={run} />;
  }

  if (run && REVIEWABLE.has(run.status)) {
    return (
      <PageSkeleton
        variant="review"
        label={run.questions_needing_you > 0
          ? `Opening ${run.questions_needing_you} part${run.questions_needing_you === 1 ? "" : "s"} that need your eyes…`
          : "Opening review…"}
      />
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
        {result.reason && /no marking/i.test(result.reason) && draftId && <ReadAsMarked paperId={draftId} />}
        <FailedPaperActions paperId={draftId} />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px var(--text-gutter)" }}>
      <p className="subnote">We couldn&rsquo;t find this paper to review. It may have been removed.</p>
      <FailedPaperActions paperId={draftId} />
    </div>
  );
}

/** A paper that never read still belongs to the student, so it can be deleted
    from here rather than sitting in the Library for good (owner, 4 Oct 2026).
    Delete is offered only while the paper is still in the Library. */
function FailedPaperActions({ paperId }: { paperId: string | undefined }) {
  const { papers } = useApp();
  const sheets = useOptionalSheetControls();
  const listed = !!paperId && (papers ?? []).some((p) => p.id === paperId);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
      <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex" }}>Back to Library</Link>
      {listed && sheets && <DeletePaperButton paperId={paperId!} />}
    </div>
  );
}

/** The first look can miss light or small marking. The student holding the
    paper is the authority on whether it is marked (AXO-196). */
function ReadAsMarked({ paperId }: { paperId: string }) {
  const { refreshLibrary } = useApp();
  const [state, setState] = useState<"idle" | "busy" | "started" | "failed">("idle");
  if (state === "started") {
    return <p className="subnote" role="status">Reading it again. It will be in your Library when it is done.</p>;
  }
  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" className="btn primary" disabled={state === "busy"} aria-busy={state === "busy" || undefined}
              onClick={async () => {
                setState("busy");
                try {
                  const result = await retryAsMarked(paperId);
                  setState(result.retry === "started" || result.retry === "already_in_progress" ? "started" : "failed");
                  void refreshLibrary();
                } catch { setState("failed"); }
              }}>
        {state === "busy" ? "Starting…" : "It is marked. Read it again"}
      </button>
      {state === "failed" && <p className="subnote" role="alert">That could not start. Try again with a connection.</p>}
    </div>
  );
}

function DeletePaperButton({ paperId }: { paperId: string }) {
  const requestDelete = usePaperDelete();
  return (
    <button type="button" className="btn ghost danger-soft" onClick={() => requestDelete(paperId)}>
      Delete this paper
    </button>
  );
}
