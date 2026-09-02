/* ═══════════════════════════════════════════════════════════════════════════
   PAPER REVIEW — re-entry

   A real location, not a sheet: it survives a reload mid-review. But the
   actual review UI is ReviewSheet — already built, already mounted globally
   in AppShell, and driven entirely by ScanProvider's state. This screen's
   whole job is to resolve the draft this URL names back to a run and hand it
   to the scan module (`resumeDraftReview`, in src/scan/ui.js), which opens
   ReviewSheet over it. There is no second review UI here — reusing the one
   that exists is the point (AXON_FIX_BRIEF.md §6.4).
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useScan } from "../scan/ScanProvider";
import type { ResumeReviewResult } from "../scan/ScanProvider";
import { useApp } from "../data/AppProvider";
import { paths } from "../app/paths";

export default function PaperReview() {
  const { draftId } = useParams();
  const { ensureScan, reviewOpen } = useScan();
  const { student } = useApp();

  const [result, setResult] = useState<ResumeReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId || !student) return;
    let cancelled = false;
    (async () => {
      try {
        const scan = await ensureScan();
        const r = await scan.resumeDraftReview(draftId);
        if (!cancelled) setResult(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "That paper could not be reopened.");
      }
    })();
    return () => { cancelled = true; };
  }, [draftId, student, ensureScan]);

  // The common case: ReviewSheet is now open over this screen. Nothing else
  // to render underneath it.
  if (reviewOpen) return null;

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

  if (!result) return null; // resolving — nothing dishonest to show yet

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

  if (result.state === "processing") {
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">We&rsquo;re still reading this paper. Check back in a moment.</p>
        <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
          Back to Library
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

  // 'gone' — the draft or its paper no longer exist locally.
  return (
    <div style={{ padding: "16px var(--text-gutter)" }}>
      <p className="subnote">We couldn&rsquo;t find this paper to review. It may have been sent from another device.</p>
      <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
        Back to Library
      </Link>
    </div>
  );
}
