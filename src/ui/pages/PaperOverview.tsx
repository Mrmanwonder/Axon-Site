/** Saved-paper identity, full prompts and source-backed grouping. */

import { Link, useNavigate, useParams } from "react-router-dom";
import PressBox from "../components/PressBox";
import MaterialSymbol from "../components/MaterialSymbol";
import AcademicText from "../components/AcademicText";
import { paperIdentity, paperReading } from "../data/paperReading";
import "../styles/PaperReading.css";
import PageSkeleton from "../components/PageSkeleton";
import { useApp } from "../data/AppProvider";
import { deletePaper, paperTypeLabel, providerKeyForStudent } from "../data/modules";
import { numMark } from "../data/causes";
import { totalNote } from "../data/paperTotals";
import { paths } from "../app/paths";
import ResourceActions from "../components/ResourceActions";
import { tutorEntryVisible } from "../data/tutor";
import { useSheetControls } from "../components/SheetProvider";
import { useToast } from "../components/ToastProvider";
import { useAcademicShare } from "../data/useAcademicShare";
import { usePaperResource } from "../data/usePaperResource";
import "../styles/paper-overview.css";

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

  if (!paper) return <PageSkeleton variant="paper" label="Loading paper…" />;

  const attempts = paper.student_attempt;
  const reading = paperReading(paper);
  const needsCheck = reading.parts.filter(p => !p.attempt.student_confirmed_at && p.attempt.extraction_confidence === "unsure");
  const unreadMarks = reading.parts.filter(p => p.attempt.marks_awarded == null);
  const next = needsCheck[0] ?? unreadMarks[0];
  const identity = paperIdentity(paper, paperTypeLabel(paper.type, providerKeyForStudent(student)));

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

  const renderPart = (part: typeof reading.parts[number], sharedStem?: string | null) => (
    <PressBox as={Link} key={part.attempt.id} to={paths.question(paperId!, part.attempt.id)} className="paper-part" data-interactive="">
      <div className="paper-part-copy">
        <div className="paper-part-heading"><span>{part.label}</span><span className={"conf " + (part.attempt.student_confirmed_at ? "confirmed" : part.attempt.extraction_confidence)}>{part.attempt.student_confirmed_at ? "Confirmed by you" : part.attempt.extraction_confidence === "unsure" ? "Needs checking" : part.attempt.extraction_confidence === "confirmed" ? "Read clearly" : "Likely read"}</span></div>
        {part.page != null && <div className="paper-secondary">Page {part.page}{part.inherited ? " · Parent linked by source order; printed label has no parent number" : ""}</div>}
        {part.stem && part.stem !== sharedStem ? <div className="paper-prompt"><AcademicText text={part.stem} /></div> : !part.stem && <div className="paper-secondary">Printed question not read. Inspect the saved page.</div>}
        <div className="paper-secondary">Teacher’s mark: {part.attempt.marks_awarded == null ? "Not read" : numMark(part.attempt.marks_awarded)}{part.attempt.max_marks != null ? ` out of ${numMark(part.attempt.max_marks)}` : " · Maximum not read"}</div>
      </div><MaterialSymbol name="chevron" />
    </PressBox>
  );
  return <div className="paper-reading">
    <nav aria-label="Paper breadcrumb"><Link to={paths.library}>Library</Link><span aria-hidden="true"> / </span><span>Paper</span></nav>
    <header className="paper-heading">
      <div><h1>{identity.title}</h1><p className="paper-secondary">{identity.subject}</p><p className="paper-secondary">{identity.examDate} · {identity.added}{stale ? " · offline copy" : ""}</p></div>
      <ResourceActions resourceLabel="paper" onShare={requestShare} shareActive={shareStatusKnown ? !!activeShare : null} onDelete={requestDelete} />
    </header>
    <section className="paper-summary" aria-label="Marks and coverage">
      <h2>Marks lost</h2>
      <p className="paper-loss">{reading.scored.length ? `${reading.partial ? "At least " : ""}${numMark(reading.lost)} mark${reading.lost === 1 ? "" : "s"} lost` : "Marks not available"}</p>
      {reading.scored.length > 0 && <p>From {reading.scored.length} scored part{reading.scored.length === 1 ? "" : "s"} · Teacher’s marks as read: {numMark(reading.awarded)} out of {numMark(reading.maximum)}</p>}
      {reading.partial && <p className="paper-secondary">Some parts are missing readable or confirmed marks. This is a partial reading.</p>}
      {totalNote(paper) && <p className="paper-secondary">{totalNote(paper)}</p>}
      {reading.counts ? <p className="paper-secondary">Stored source coverage: {reading.counts.questions_total} question{reading.counts.questions_total === 1 ? "" : "s"} · {reading.counts.parts_total} part{reading.counts.parts_total === 1 ? "" : "s"} · {reading.counts.unassigned_parts} unassigned · {reading.counts.raw_region_count} raw region{reading.counts.raw_region_count === 1 ? "" : "s"}. {attempts.length} saved part{attempts.length === 1 ? "" : "s"}.</p>
        : <p className="paper-secondary">{attempts.length} saved part{attempts.length === 1 ? "" : "s"}. Source counts unavailable in this copy.</p>}
      {paper.reconciled === false && paper.reported_total != null && <p className="paper-secondary">Our reading adds up to {numMark(reading.awarded)}; the total printed on your paper is {numMark(Number(paper.reported_total))}. Compare the source before accepting either reading.</p>}
    </section>
    {!!paper.page_unreadable.length && <section className="paper-recovery" aria-label="Unreadable pages"><h2>{paper.page_unreadable.length} page{paper.page_unreadable.length === 1 ? "" : "s"} couldn’t be read</h2>{paper.page_unreadable.map(page => <p key={page.page_number}>Page {page.page_number}: {page.reason}</p>)}<p className="paper-secondary">These source records remain unreadable. Opening a saved part lets you inspect its page; this does not create a new confirmation task.</p></section>}
    {tutorEntryVisible() && attempts.length > 0 && <Link to={paths.tutor({ paperId: paperId! })} className="btn ghost">Ask the tutor about this paper</Link>}
    <section aria-label="Saved questions"><h2>Questions</h2>
      <p className="paper-secondary">{reading.groups.length} questions · {reading.parts.length} saved parts · {reading.unassigned.length} parts not placed under a question</p>
      {next && <div className="paper-secondary" role="status">
        {!!needsCheck.length && <p>{needsCheck.length} part{needsCheck.length === 1 ? " needs" : "s need"} checking.</p>}
        {!!unreadMarks.length && <p>{unreadMarks.length} part{unreadMarks.length === 1 ? " has" : "s have"} no readable mark.</p>}
        <Link to={paths.question(paperId!, next.attempt.id)}>Open {next.label}</Link>
      </div>}
      {!attempts.length && <p>No saved parts to show yet. Source coverage above may include readings that have not been saved.</p>}
      {reading.groups.map(group => <section className="paper-group" key={group.question} aria-label={`Question ${group.question}`}><h3>Question {group.question}</h3>{group.sharedStem && <div className="paper-shared-stem"><AcademicText text={group.sharedStem} /></div>}{group.items.map(part => renderPart(part, group.sharedStem))}</section>)}
      {!!reading.unassigned.length && <section className="paper-group" aria-label="Unassigned parts"><h3>Unassigned parts</h3><p className="paper-secondary">The source does not establish these parts’ parent questions.</p>{reading.unassigned.map(part => renderPart(part))}</section>}
    </section>
  </div>;
}
