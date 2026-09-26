import { useEffect, useMemo, useState } from "react";
import DocumentMeta from "../components/DocumentMeta";
import MathText from "../components/MathText";
import type { LossReason, SharedAcademicSnapshot, SharedQuestionSnapshot } from "../data/modules";
import { resolveAcademicShare } from "../data/modules";

const SHARE_TOKEN_SESSION_KEY = "axon.academic-share-token";

const TYPE_LABEL: Record<string, string> = {
  unit_test: "Class test",
  mid_term: "Mid-term",
  final_exam: "End-of-year exam",
  pyq: "Past paper",
  sample_paper: "Sample paper",
};

function typeLabel(type: string) {
  return TYPE_LABEL[type] ?? "Paper";
}

function mark(value: number | null | undefined) {
  if (value == null) return null;
  return Number.isInteger(Number(value)) ? String(Number(value)) : String(Number(value));
}

function causeLabel(value: string | null | undefined) {
  if (!value) return "What went wrong";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function LossReasonLine({ reason }: { reason: LossReason }) {
  const copy = reason.note || reason.cause;
  if (!copy) return null;
  return (
    <li>
      <MathText text={copy} />
      {reason.marks > 0 && <span>{mark(reason.marks)} mark{Number(reason.marks) === 1 ? "" : "s"}</span>}
    </li>
  );
}

function QuestionSnapshot({ question }: { question: SharedQuestionSnapshot }) {
  const hasMarks = question.marks_awarded != null && question.max_marks != null;
  return (
    <article className="shared-question">
      <div className="shared-question__head">
        <div>
          <div className="shared-question__label">{question.question_label || "Question"}</div>
          <div className={"conf " + question.extraction_confidence}>
            {question.extraction_confidence === "confirmed" ? "Confirmed"
              : question.extraction_confidence === "likely" ? "Likely" : "Unsure"}
          </div>
        </div>
        {hasMarks && (
          <div className="shared-question__marks">
            {mark(question.marks_awarded)}
            <span>/{mark(question.max_marks)}</span>
          </div>
        )}
      </div>

      {question.question_text && (
        <div className="shared-field">
          <div className="k">Question</div>
          <div className="v"><MathText text={question.question_text} /></div>
        </div>
      )}
      {question.student_answer && (
        <div className="shared-field">
          <div className="k">Written answer</div>
          <div className="v steps"><MathText text={question.student_answer} /></div>
        </div>
      )}
      {question.teacher_remark && (
        <div className="shared-field">
          <div className="k">Teacher wrote</div>
          <div className="v steps"><MathText text={question.teacher_remark} /></div>
        </div>
      )}
      <div className="shared-field shared-field--meta">
        <div className="k">Marked from</div>
        <div className="v">
          {question.marks_source === "official_scheme" ? "Official marking scheme" : "Teacher's pen"}
        </div>
      </div>

      {question.feedback && (
        <div className="shared-learning">
          <section className="shared-learning__section">
            <div className="shared-learning__eyebrow">What went wrong</div>
            <h3>{causeLabel(question.feedback.cause)}</h3>
            {question.feedback.explanation && (
              <div className="shared-learning__copy">
                <MathText text={question.feedback.explanation} />
              </div>
            )}
            {question.feedback.loss_reasons.length > 0 && (
              <ul className="shared-learning__reasons">
                {question.feedback.loss_reasons.map((reason, index) => (
                  <LossReasonLine key={index} reason={reason} />
                ))}
              </ul>
            )}
            {question.feedback.command_word && question.feedback.command_word_note && (
              <div className="shared-learning__note">
                <strong>{question.feedback.command_word}</strong>
                <MathText text={question.feedback.command_word_note} />
              </div>
            )}
          </section>

          <section className="shared-learning__section">
            <div className="shared-learning__eyebrow">Do this next time</div>
            {question.feedback.do_this_next
              ? <div className="shared-learning__copy"><MathText text={question.feedback.do_this_next} /></div>
              : <p className="shared-learning__unavailable">No specific next-step advice was saved for this question.</p>}
          </section>

          <section className="shared-learning__section">
            <div className="shared-learning__eyebrow">A better answer</div>
            {question.feedback.corrected_answer_state === "available" && question.feedback.corrected_answer
              ? <div className="shared-learning__copy steps"><MathText text={question.feedback.corrected_answer} /></div>
              : question.feedback.corrected_answer_state === "withheld"
                ? <p className="shared-learning__unavailable">Axon withheld corrected working because the saved evidence was not complete enough to show it safely.</p>
                : <p className="shared-learning__unavailable">A grounded corrected answer was not saved for this question.</p>}
          </section>
        </div>
      )}
    </article>
  );
}

export default function SharedAcademic() {
  const [snapshot, setSnapshot] = useState<SharedAcademicSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const fromLink = params.get("token")?.trim() ?? "";
    if (fromLink) {
      // Fragments are not sent to Axon, but browsers can retain them in visible
      // history. Move the bearer capability into this tab only, then scrub it
      // from the address bar. A reload in the same tab still works; another
      // tab/account cannot read this sessionStorage entry.
      sessionStorage.setItem(SHARE_TOKEN_SESSION_KEY, fromLink);
      history.replaceState(history.state, "", location.pathname + location.search);
      return fromLink;
    }
    return sessionStorage.getItem(SHARE_TOKEN_SESSION_KEY)?.trim() ?? "";
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setSnapshot({ found: false });
      return;
    }
    resolveAcademicShare(token)
      .then((data) => {
        if (!data.found) sessionStorage.removeItem(SHARE_TOKEN_SESSION_KEY);
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setError("This shared item could not be opened right now.");
      });
    return () => { cancelled = true; };
  }, [token]);

  const title = snapshot?.found
    ? snapshot.kind === "paper" ? "Shared paper | Axon" : "Shared question | Axon"
    : "Shared study item | Axon";

  if (error) {
    return (
      <main className="shared-page">
        <DocumentMeta title={title} description="A private read-only Axon share." path="/share" noIndex />
        <div className="shared-shell">
          <div className="shared-wordmark">Axon</div>
          <section className="shared-state">
            <h1>We couldn&rsquo;t open this link</h1>
            <p>{error}</p>
          </section>
        </div>
      </main>
    );
  }

  if (snapshot == null) {
    return (
      <main className="shared-page" aria-busy="true">
        <DocumentMeta title={title} description="A private read-only Axon share." path="/share" noIndex />
        <div className="shared-shell">
          <div className="shared-wordmark">Axon</div>
          <section className="shared-state">
            <h1>Opening shared work…</h1>
            <p>The link is being checked without signing you into an Axon account.</p>
          </section>
        </div>
      </main>
    );
  }

  if (!snapshot.found) {
    return (
      <main className="shared-page">
        <DocumentMeta title={title} description="A private read-only Axon share." path="/share" noIndex />
        <div className="shared-shell">
          <div className="shared-wordmark">Axon</div>
          <section className="shared-state">
            <h1>This link isn&rsquo;t available</h1>
            <p>It may have expired, been stopped by the person who shared it, or the saved work may have been deleted.</p>
          </section>
        </div>
      </main>
    );
  }

  const expiry = new Date(snapshot.expires_at).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
  const paper = snapshot.paper;

  return (
    <main className="shared-page">
      <DocumentMeta
        title={title}
        description="A private read-only paper or question shared from Axon."
        path="/share"
        noIndex
      />
      <div className="shared-shell">
        <header className="shared-header">
          <div className="shared-wordmark">Axon</div>
          <span className="shared-readonly">Read only</span>
        </header>

        <section className="shared-hero">
          <div className="shared-eyebrow">Shared from Axon</div>
          <h1>{snapshot.kind === "paper" ? typeLabel(paper.type) : "Shared question"}</h1>
          <div className="shared-sub">
            {paper.subject ? paper.subject + " · " : ""}
            {new Date(paper.date_taken).toLocaleDateString(undefined, {
              day: "numeric", month: "short", year: "numeric",
            })}
          </div>
          <p className="shared-expiry">This read-only link expires {expiry}.</p>
        </section>

        {snapshot.kind === "paper" && (
          <>
            {snapshot.paper.total_awarded != null && snapshot.paper.total_available != null && (
              <section className="shared-score">
                <span>Recorded total</span>
                <strong>
                  {mark(snapshot.paper.total_awarded)}
                  <small>/{mark(snapshot.paper.total_available)}</small>
                </strong>
              </section>
            )}
            <div className="shared-section-title">
              {snapshot.questions.length} question{snapshot.questions.length === 1 ? "" : "s"}
            </div>
            <div className="shared-question-list">
              {snapshot.questions.length
                ? snapshot.questions.map((question, index) => (
                    <QuestionSnapshot key={question.question_label || index} question={question} />
                  ))
                : <section className="shared-state"><p>No readable questions were saved on this paper.</p></section>}
            </div>
          </>
        )}

        {snapshot.kind === "question" && (
          <div className="shared-question-list">
            <QuestionSnapshot question={snapshot.question} />
          </div>
        )}

        <footer className="shared-footer">
          Only this saved {snapshot.kind} was shared. This page cannot edit the student&rsquo;s Axon account or open other papers.
        </footer>
      </div>
    </main>
  );
}
