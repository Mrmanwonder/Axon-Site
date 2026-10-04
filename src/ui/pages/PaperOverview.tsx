/* ═══════════════════════════════════════════════════════════════════════════
   PAPER OVERVIEW

   One saved paper as questions and their parts: which paper this is, how many questions
   and parts it has, what is marked, what needs a look, and a link into each part.
   Reads student_attempt (the committed, frontend-side record — see AXON_FIX_BRIEF.md §1's
   "two data models"), grouped by the AXO-122 counting contract in paperStructure.ts.

   A paper still mid-pipeline (no committed attempts yet) has nothing to show here — that
   state belongs to the Library row (§6.5), which links here only once there is something
   to open. This screen assumes it is being asked for a paper that has been saved.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";
import PageSkeleton from "../components/PageSkeleton";
import { useApp } from "../data/AppProvider";
import { deletePaper, paperTypeLabel, providerKeyForStudent } from "../data/modules";
import { numMark } from "../data/causes";
import { isPartialTotal, totalNote } from "../data/paperTotals";
import { paperStructure } from "../data/paperStructure";
import type { PaperPart, PaperStructure } from "../data/paperStructure";
import { paths } from "../app/paths";
import ResourceActions from "../components/ResourceActions";
import { tutorEntryVisible } from "../data/tutor";
import { useSheetControls } from "../components/SheetProvider";
import { useToast } from "../components/ToastProvider";
import { useAcademicShare } from "../data/useAcademicShare";
import { usePaperResource } from "../data/usePaperResource";
import "../styles/paper-overview.css";

/** What the badge means, in words. "Likely" alone told the student nothing. */
function stateText(part: PaperPart): string {
  if (part.confirmed) return "Confirmed by you";
  if (part.confidence === "confirmed") return "Read clearly";
  if (part.confidence === "likely") return "Likely read";
  return "Needs checking";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function PartRow({ paperId, part, label }: { paperId: string; part: PaperPart; label: string }) {
  const marked = part.marks.kind === "marked";
  return (
    <PressBox as={Link} to={paths.question(paperId, part.attemptId)} className="row po-part" data-interactive="">
      <div className="b">
        <div className="t1 po-part-label">
          <span>{label}</span>
          {part.page != null && <span className="po-page">Page {part.page}</span>}
        </div>
        <div className={"po-prompt" + (part.prompt ? "" : " none")}>
          {part.prompt ?? "Question text not read"}
        </div>
        <div className="t2">
          <span className={"conf " + (part.confirmed ? "confirmed" : part.confidence)}>{stateText(part)}</span>
          {part.placedByPosition && <span>Placed under this question by its position on the page</span>}
        </div>
      </div>
      <div className="po-mark" aria-label={marked ? undefined : "Mark not read"}>
        {part.marks.kind === "marked" ? (
          <>
            <span className="num">{numMark(part.marks.awarded)}</span>
            <span className="of">/{numMark(part.marks.max)}</span>
          </>
        ) : (
          <span className="po-mark-none">
            Mark not read{part.marks.max != null ? ` · out of ${numMark(part.marks.max)}` : ""}
          </span>
        )}
      </div>
      <Chevron />
    </PressBox>
  );
}

function NextAction({ paperId, structure }: { paperId: string; structure: PaperStructure }) {
  const all = [...structure.questions.flatMap((q) => q.parts), ...structure.unassigned];
  const unsure = all.filter((p) => !p.confirmed && p.confidence === "unsure");
  const unmarked = all.filter((p) => p.marks.kind === "unread");
  const target = unsure[0] ?? unmarked[0];
  if (!target) return null;
  return (
    <div className="po-next" role="status">
      {unsure.length > 0 && <div>{plural(unsure.length, "part")} {unsure.length === 1 ? "needs" : "need"} checking.</div>}
      {unmarked.length > 0 && <div>{plural(unmarked.length, "part")} {unmarked.length === 1 ? "has" : "have"} no readable mark.</div>}
      <Link to={paths.question(paperId, target.attemptId)} className="po-next-link">
        Open {target.path}
      </Link>
    </div>
  );
}

export default function PaperOverview() {
  const { paperId } = useParams();
  const { student, removePaperFromLibrary, refreshLibrary } = useApp();
  const navigate = useNavigate();
  const { openSheet } = useSheetControls();
  const toast = useToast();
  const { activeShare, shareStatusKnown, requestShare } = useAcademicShare({
    resourceType: "paper",
    resourceId: paperId,
    title: "Shared paper from Axon",
  });

  const { paper, stale, error } = usePaperResource(student?.id, paperId);
  const loadError = error?.message || (error ? "That paper could not be opened." : null);
  const structure = useMemo(() => (paper ? paperStructure(paper) : null), [paper]);

  if (loadError) {
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">{loadError}</p>
        <Link to={paths.library} className="btn ghost" style={{ display: "inline-flex", marginTop: 12 }}>
          Back to Library
        </Link>
      </div>
    );
  }

  if (!paper || !structure) return <PageSkeleton variant="paper" label="Loading paper…" />;

  const attempts = paper.student_attempt;
  const marksRows = attempts.filter((a) => a.marks_awarded != null && a.max_marks != null);
  const sumAwarded = marksRows.reduce((t, a) => t + Number(a.marks_awarded), 0);
  const sumAvailable = marksRows.reduce((t, a) => t + Number(a.max_marks), 0);
  const marksLost = sumAvailable - sumAwarded;
  const partial = isPartialTotal(paper) || structure.unmarkedParts > 0;
  const { counts } = structure;
  const typeLabel = paperTypeLabel(paper.type, providerKeyForStudent(student));
  const dated = new Date(paper.date_taken).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const requestDelete = () => {
    if (!paperId) return;
    openSheet({
      title: "Delete this paper",
      body:
        "This permanently removes the saved paper, its pages, questions, explanations and derived data from Axon. It cannot be restored.",
      items: [
        ["Usage logs stay, anonymised.", "We keep which model ran, how long it took and what it cost. The student, paper and page references are removed."],
      ],
      primary: "Delete paper",
      onConfirm: async () => {
        await deletePaper(paperId);
        removePaperFromLibrary(paperId);
        void refreshLibrary();
        toast("Paper deleted.");
        navigate(paths.library, { replace: true });
      },
    });
  };

  return (
    <div className="po">
      <nav className="po-crumb" aria-label="Breadcrumb">
        <Link to={paths.library}>Library</Link>
      </nav>

      <div className="greet detailgreet">
        <div className="detailcopy">
          <h1>{paper.subject || typeLabel}</h1>
          <div className="sub po-meta">
            {paper.subject ? <span>{typeLabel}</span> : <span>Subject not confirmed</span>}
            <span>Dated {dated}</span>
            {stale && <span>offline copy</span>}
          </div>
        </div>
        <ResourceActions resourceLabel="paper" onShare={requestShare} shareActive={shareStatusKnown ? !!activeShare : null} onDelete={requestDelete} />
      </div>

      {attempts.length > 0 && (
        <section className="card po-summary" aria-label="Summary">
          {marksRows.length > 0 ? (
            <>
              <div className="po-lost">
                {partial && <span className="po-atleast">At least </span>}
                {numMark(marksLost)} {marksLost === 1 ? "mark" : "marks"} lost
              </div>
              <div className="po-sub">
                Teacher&rsquo;s marks: {numMark(sumAwarded)} of {numMark(sumAvailable)} · {structure.markedParts} of{" "}
                {structure.markedParts + structure.unmarkedParts} {structure.markedParts + structure.unmarkedParts === 1 ? "part" : "parts"} marked
              </div>
            </>
          ) : (
            <div className="po-lost">No marks read yet</div>
          )}
          <div className="po-sub">
            {plural(counts.questions_total, "question")} · {plural(counts.parts_total, "part")}
            {counts.unassigned_parts > 0 && ` · ${plural(counts.unassigned_parts, "part")} not placed under a question`}
          </div>

          {/* We never assert our reading is right against the paper's own
              total — we state both and let the student judge. */}
          {totalNote(paper) && <div className="subnote po-note">{totalNote(paper)}</div>}
          {marksRows.length > 0 && paper.reported_total != null && Math.abs(sumAwarded - Number(paper.reported_total)) > 0.0001 && (
            <div className="subnote po-note">
              Our reading adds up to {numMark(sumAwarded)}, and the total on your paper is{" "}
              {numMark(Number(paper.reported_total))} — worth a look at the questions below.
            </div>
          )}
          <NextAction paperId={paperId!} structure={structure} />
        </section>
      )}

      {tutorEntryVisible() && attempts.length > 0 && (
        <div style={{ margin: "12px var(--gutter) 0" }}>
          <Link to={paths.tutor({ paperId: paperId! })} className="btn ghost" style={{ display: "inline-flex" }}>
            Ask the tutor about this paper
          </Link>
        </div>
      )}

      {!attempts.length && (
        <>
          <h2 className="sectitle">Questions</h2>
          <div className="list">
            <div className="srow noicon">
              <div className="lbl">
                Nothing to show yet
                <small>This paper hasn&rsquo;t produced any readable questions.</small>
              </div>
            </div>
          </div>
        </>
      )}

      {structure.questions.map((q) => (
        <section key={q.number} aria-labelledby={`po-q-${q.number}`}>
          <h2 className="sectitle po-qtitle" id={`po-q-${q.number}`}>Question {q.number}</h2>
          <div className="list">
            {q.parts.map((part) => (
              <PartRow key={part.attemptId} paperId={paperId!} part={part} label={part.partTail ? `${q.number}${part.partTail}` : "Whole question"} />
            ))}
          </div>
        </section>
      ))}

      {structure.unassigned.length > 0 && (
        <section aria-labelledby="po-unassigned">
          <h2 className="sectitle po-qtitle" id="po-unassigned">Unassigned parts</h2>
          <p className="subnote po-note">
            These parts have no question number Axon can place with confidence. Open one to see where it is on the page.
          </p>
          <div className="list">
            {structure.unassigned.map((part) => (
              <PartRow key={part.attemptId} paperId={paperId!} part={part} label={part.path === "Part" ? "Part with no label" : `Part ${part.path}`} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
