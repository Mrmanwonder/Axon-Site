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

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PressBox from "../components/PressBox";
import MathText from "../components/MathText";
import Chevron from "../components/Chevron";
import PageSkeleton from "../components/PageSkeleton";
import { useApp } from "../data/AppProvider";
import { paperTypeLabel, paperTypesFor, providerKeyForStudent, setPaperSubject, setPaperType } from "../data/modules";
import { openFlags } from "../data/flaggedParts";
import type { OpenFlag } from "../data/flaggedParts";
import { FlaggedCard } from "../components/FlaggedPart";
import AppDropdown from "../components/AppDropdown";
import { usePaperDelete } from "../data/usePaperDelete";
import { relabelAttempt } from "../data/modules";
import { useSheetControls } from "../components/SheetProvider";
import { useToast } from "../components/ToastProvider";
import { numMark } from "../data/causes";
import { isPartialTotal } from "../data/paperTotals";
import { subjectPresentation } from "../data/subjectPresentation";
import { paperStructure } from "../data/paperStructure";
import { EXPLANATION_GAP_LABEL } from "../data/explanationGap";
import type { PaperPart, PaperStructure } from "../data/paperStructure";
import { paths } from "../app/paths";
import ResourceActions from "../components/ResourceActions";
import PaperDifficultyPrompt from "../components/PaperDifficultyPrompt";
import { tutorEntryVisible } from "../data/tutor";
import { useAcademicShare } from "../data/useAcademicShare";
import { usePaperResource } from "../data/usePaperResource";
import { useSchemeCheck } from "../data/schemeCheck";
import { SchemeCheckSummary } from "../components/SchemeCheck";
import "../styles/paper-overview.css";

/** What the badge means, in words. "Likely" alone told the student nothing. */
function stateText(part: PaperPart): string {
  if (part.confirmed) return "Confirmed by you";
  if (part.confidence === "confirmed") return "Read clearly";
  if (part.confidence === "likely") return "Likely read";
  return "Needs checking";
}

/** Only a reading the student has not settled and the model is unsure of. */
const needsAttention = (part: PaperPart) => !part.confirmed && part.confidence === "unsure";

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
          {part.prompt ? <MathText text={part.prompt} /> : "Question text not read"}
        </div>
        {/* The list says only what needs the student. "Confirmed by you" and
            "Read clearly" live on the question itself, beside its confidence. */}
        {(needsAttention(part) || part.placedByPosition || part.explanationGap) && (
          <div className="t2">
            {part.explanationGap && <span>{EXPLANATION_GAP_LABEL[part.explanationGap]}</span>}
            {needsAttention(part) && <span className={"conf " + part.confidence}>{stateText(part)}</span>}
            {part.placedByPosition && <span>Placed under this question by its position on the page</span>}
          </div>
        )}
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

/** "a" on a page after question 6 most likely belongs to question 6. Only a suggestion: the student types the answer. */
function suggestedLabel(part: PaperPart, structure: PaperStructure): string | null {
  const tail = part.path.replace(/^Part\s*/i, "").replace(/[()]/g, "").trim();
  if (!/^[a-z]{1,3}$|^[ivx]{1,4}$/i.test(tail)) return null;
  const before = structure.questions.filter((q) => q.parts.some((p) => p.page != null && part.page != null && p.page <= part.page));
  const q = before.length ? before[before.length - 1].number : null;
  return q ? `${q}(${tail.toLowerCase()})` : null;
}

/** What needs the student, counted from the parts that actually ask (AXO-216). The
    cards themselves sit on the parts below; this only says how many there are. */
function NextAction({ structure, flags }: { structure: PaperStructure; flags: OpenFlag[] }) {
  const all = [...structure.questions.flatMap((q) => q.parts), ...structure.unassigned];
  const unmarked = all.filter((p) => p.marks.kind === "unread");
  if (!flags.length && !unmarked.length) return null;
  return (
    <div className="po-next" role="status">
      {flags.length > 0 && <div>{plural(flags.length, "part")} {flags.length === 1 ? "needs" : "need"} a look. {flags.length === 1 ? "It is" : "They are"} marked below.</div>}
      {unmarked.length > 0 && <div>{plural(unmarked.length, "part")} {unmarked.length === 1 ? "has" : "have"} no readable mark.</div>}
    </div>
  );
}

export default function PaperOverview() {
  const { paperId } = useParams();
  const { student, papers, progressResource, refreshLibrary } = useApp();
  const deletePaperSheet = usePaperDelete();
  const { activeShare, shareStatusKnown, requestShare } = useAcademicShare({
    resourceType: "paper",
    resourceId: paperId,
    title: "Shared paper from Axon",
  });

  const { paper, stale, error, reload } = usePaperResource(student?.id, paperId);
  const schemeCheck = useSchemeCheck(paperId);
  const [savingSubject, setSavingSubject] = useState(false);
  const { openSheet } = useSheetControls();
  const toast = useToast();
  const loadError = error?.message || (error ? "That paper could not be opened." : null);
  const structure = useMemo(() => (paper ? paperStructure(paper) : null), [paper]);
  // One card per part with a measured reason that the student has not checked or put off.
  const flags = useMemo(() => (paper && structure
    ? openFlags(paper, new Set(structure.unassigned.map((p) => p.attemptId)))
    : []), [paper, structure]);
  const [savingType, setSavingType] = useState(false);
  // Save closes review at once; the paper fills in here when its marks are
  // committed. Until then, say what is happening and keep checking.
  const runStatus = paperId ? progressResource?.data?.get(paperId)?.status : undefined;
  const saving = !!paper && !paper.student_attempt.length && ["needs_review", "explaining", "ready"].includes(runStatus ?? "");
  useEffect(() => {
    if (!saving) return;
    const timer = window.setInterval(() => { void refreshLibrary().catch(() => {}); }, 3000);
    return () => window.clearInterval(timer);
  }, [saving, refreshLibrary]);
  useEffect(() => {
    if (runStatus === "committed" && paper && !paper.student_attempt.length) void reload();
  }, [runStatus]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // The same subject the Library row shows: a verified identity, else what the
  // reader suggested. "Subject not confirmed" here, beside a Library row that
  // named the subject, read as two different papers (owner, 4 Oct 2026).
  const listed = (papers ?? []).find((p) => p.id === paper.id);
  const subjectInfo = listed
    ? subjectPresentation(listed, undefined, progressResource?.data?.get(paper.id))
    : subjectPresentation(paper as never);
  const subjectLabel = subjectInfo.state === "unknown" ? null : subjectInfo.label;
  const subjectOptions = [
    ...(student?.subject_selections ?? []).map((sel) => ({ value: sel.offering_id, label: sel.external_code ? `${sel.subject} · ${sel.external_code}` : sel.subject })),
    { value: "", label: "Not set" },
  ];
  const changeSubject = async (value: string) => {
    if ((paper.subject_offering_id ?? "") === value) return;
    setSavingSubject(true);
    try {
      await setPaperSubject(paper.id, value || null);
      await reload();
      void refreshLibrary();
      toast(value ? "Subject changed. Its questions will move to that syllabus shortly." : "Subject cleared.");
    } catch (cause) {
      toast(cause instanceof Error && /official assessment/.test(cause.message)
        ? "This paper's subject comes from its official assessment and can't be changed."
        : "The subject couldn't be changed. Try again with a connection.");
    } finally {
      setSavingSubject(false);
    }
  };
  // D7: the type is the student's to change. A past paper is matched to its
  // official scheme; a school test is explained from the teacher's marks.
  const typeOptions = paperTypesFor(providerKeyForStudent(student)).map((t) => ({ value: t.value, label: t.label }));
  const changeType = async (value: string) => {
    if (!value || value === paper.type) return;
    setSavingType(true);
    try {
      await setPaperType(paper.id, value);
      await reload();
      void refreshLibrary();
      toast("Paper type changed.");
    } catch {
      toast("The paper type couldn't be changed. Try again with a connection.");
    } finally {
      setSavingType(false);
    }
  };
  const flagByAttempt = new Map(flags.filter((f) => f.attemptId).map((f) => [f.attemptId!, f]));
  const unsavedFlags = flags.filter((f) => !f.attemptId);
  const flagCard = (flag: OpenFlag, label: string) => (
    <FlaggedCard key={`flag-${flag.region.id}`} label={label} reason={flag.reason} region={flag.region}
                 paperId={paper.id} onChanged={async () => { await reload(); void refreshLibrary(); }} />
  );
  const dated = new Date(paper.date_taken).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const requestDelete = () => { if (paperId) deletePaperSheet(paperId); };

  // The student is the authority on a label (it is transcription), so a part
  // Axon could not place can be placed by hand: "a" on page 12 becomes "6(a)".
  const placePart = (part: PaperPart) => {
    const suggestion = suggestedLabel(part, structure);
    openSheet({
      title: "Place this part",
      body: "Type the question number as it is printed on the paper, with the part in brackets.",
      input: { id: "po-place-label", label: "Question and part", placeholder: suggestion ?? "6(a)" },
      primary: "Place part",
      onConfirm: async (value) => {
        const label = (value || suggestion || "").trim();
        if (!label) throw new Error("Type the question number, for example 6(a).");
        await relabelAttempt(part.attemptId, label);
        await reload();
        toast(`Placed as ${label}.`);
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
          <h1>{subjectLabel || typeLabel}</h1>
          <div className="sub po-meta">
            {subjectLabel ? <span>{typeLabel}</span> : <span>Subject not identified</span>}
            {/* No exam date is recorded for a paper yet; date_taken is the day it
                was added, so it is labelled that way (Axon.md §4, Dates on a paper). */}
            <span>Added {dated}</span>
            {stale && <span>offline copy</span>}
          </div>
        </div>
        <ResourceActions resourceLabel="paper" onShare={requestShare} shareActive={shareStatusKnown ? !!activeShare : null} onDelete={requestDelete} />
      </div>

      {student?.id && <PaperDifficultyPrompt key={paper.id} paperId={paper.id} studentId={student.id}
        ready={paper.student_attempt.length > 0} />}

      {paper.subject_identity_source !== "assessment_identity" && (student?.subject_selections?.length ?? 0) > 0 && (
        <div className="po-subject">
          <span className="k">Subject</span>
          <AppDropdown ariaLabel="Paper subject" value={paper.subject_offering_id ?? ""} options={subjectOptions}
            onChange={(v) => { if (!savingSubject) void changeSubject(v); }} selected={!!paper.subject_offering_id} />
          {paper.subject_identity_source === "triage" && <span className="hint">Set from the paper. Change it if it&rsquo;s wrong.</span>}
        </div>
      )}

      <div className="po-subject">
        <span className="k">Paper type</span>
        <AppDropdown ariaLabel="Paper type" value={paper.type} options={typeOptions}
          onChange={(v) => { if (!savingType) void changeType(v); }} selected />
        {paper.type_source === "triage" && <span className="hint">Set from the paper code printed on it. Change it if it&rsquo;s wrong.</span>}
        {paper.type_source === "default" && <span className="hint">Treated as a school test. Change it if this is a past paper.</span>}
      </div>

      {attempts.length > 0 && (
        <section className="card po-summary" aria-label="Summary">
          {/* One headline, one line of facts, and a note only when the number
              is a minimum. Unplaced parts are explained where they are listed. */}
          {marksRows.length > 0 ? (
            <div className="po-lost">
              {partial && <span className="po-atleast">At least </span>}
              {numMark(marksLost)} {marksLost === 1 ? "mark" : "marks"} lost
            </div>
          ) : (
            <div className="po-lost">No marks read yet</div>
          )}
          <div className="po-sub">
            {marksRows.length > 0 && <>{numMark(sumAwarded)} of {numMark(sumAvailable)} from your teacher · </>}
            {plural(counts.questions_total, "question")} · {plural(counts.parts_total, "part")}
          </div>
          {partial && marksRows.length > 0 && (
            <div className="subnote po-note">Some marks couldn&rsquo;t be read, so more may have been lost.</div>
          )}
          {!partial && paper.total_basis === "added_up" && (
            <div className="subnote po-note">No total was printed on this paper. Axon added up the marks it could read.</div>
          )}
          {/* We never assert our reading is right against the paper's own
              total: we state both and let the student judge. */}
          {marksRows.length > 0 && paper.reported_total != null && Math.abs(sumAwarded - Number(paper.reported_total)) > 0.0001 && (
            <div className="subnote po-note">
              Our reading adds up to {numMark(sumAwarded)}, and the total on your paper is{" "}
              {numMark(Number(paper.reported_total))}. Worth a look at the questions below.
            </div>
          )}
          <NextAction structure={structure} flags={flags} />
        </section>
      )}

      {/* Opt-in: the whole reading, part by part, for a student who wants to
          look. Never opened for them (council D1). */}
      {(attempts.length > 0 || unsavedFlags.length > 0) && (
        <div style={{ margin: "12px var(--gutter) 0" }}>
          <Link to={`${paths.review(paper.id)}?check=1`} className="btn ghost" style={{ display: "inline-flex" }}>
            Check the reading
          </Link>
        </div>
      )}

      {schemeCheck.check && <SchemeCheckSummary check={schemeCheck.check} regions={schemeCheck.regions} />}

      {tutorEntryVisible() && attempts.length > 0 && (
        <div style={{ margin: "12px var(--gutter) 0" }}>
          <Link to={paths.tutor({ paperId: paperId! })} className="btn ghost" style={{ display: "inline-flex" }}>
            Ask the tutor about this paper
          </Link>
        </div>
      )}

      {saving && (
        <div className="list" role="status">
          <div className="srow noicon">
            <div className="lbl">
              Saving this paper
              <small>Axon is working out where the marks went. The questions appear here by themselves.</small>
            </div>
          </div>
        </div>
      )}

      {!attempts.length && !saving && (
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
            {q.parts.map((part) => {
              const label = part.partTail ? `${q.number}${part.partTail}` : "Whole question";
              const flag = flagByAttempt.get(part.attemptId);
              return (
                <div key={part.attemptId}>
                  <PartRow paperId={paperId!} part={part} label={label} />
                  {flag && flagCard(flag, part.partTail ? label : `Question ${q.number}`)}
                </div>
              );
            })}
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
              <div key={part.attemptId} className="po-unplaced">
                <PartRow paperId={paperId!} part={part} label={part.path === "Part" ? "Part with no label" : `Part ${part.path}`} />
                <button type="button" className="po-place" onClick={() => placePart(part)}>
                  Place under a question
                </button>
                {flagByAttempt.get(part.attemptId) && flagCard(flagByAttempt.get(part.attemptId)!, part.path === "Part" ? "This part" : `Part ${part.path}`)}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Parts the pipeline could not save because a mark was missing or the
          part could not be read. Shown, never dropped (hard rule 4): giving the
          teacher's mark saves the part. */}
      {unsavedFlags.length > 0 && (
        <section aria-labelledby="po-unsaved">
          <h2 className="sectitle po-qtitle" id="po-unsaved">Parts not saved yet</h2>
          <p className="subnote po-note">
            Axon could not save these parts as read. Fix one to add it to this paper.
          </p>
          <div className="list">
            {unsavedFlags.map((flag) => {
              const label = flag.region.placed_label || flag.region.question_label || "Part with no label";
              return (
                <div key={flag.region.id} className="po-unplaced">
                  <div className="row po-part">
                    <div className="b">
                      <div className="t1 po-part-label">
                        <span>{label}</span>
                        {flag.region.page_spans?.[0] && <span className="po-page">Page {flag.region.page_spans[0].page}</span>}
                      </div>
                    </div>
                  </div>
                  {flagCard(flag, label)}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
