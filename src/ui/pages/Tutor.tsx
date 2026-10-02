/* ═══════════════════════════════════════════════════════════════════════════
   TUTOR (AXO-39)

   Ask about one question, one paper, or nothing in particular. The server
   decides what the tutor may read: the request carries only ids, mastery-api
   checks them against the active Student Mode scope, and the paper evidence
   is loaded there, never from this screen (AXO-36).

   What this screen promises, and only that:
   - The conversation lives in memory on this device. Nothing here writes it
     anywhere, and "Clear" or leaving the screen is the deletion.
   - Every answer says how well it is supported, as form (the same solid /
     bordered / dashed language as extraction confidence), not as a colour or
     a percentage.
   - Web sources are shown by host and labelled as web sources, so they can't
     be mistaken for the student's paper or for a marking scheme.
   - Marks are the teacher's. The tutor explains; it never re-marks.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { askTutor, paperTypeLabel } from "../data/modules";
import { usePaperResource } from "../data/usePaperResource";
import {
  classifyTutorError, isBusy, MAX_QUESTION_LENGTH, newTurnId, replyStanding, sourceHost, tutorReducer,
} from "../data/tutor";
import type { TutorTurn } from "../data/tutor";
import { paths } from "../app/paths";
import MathText from "../components/MathText";
import { useSheetControls } from "../components/SheetProvider";
import "../styles/tutor.css";

const BOARD_NEUTRAL_LABEL: Record<string, string> = { pyq: "Past paper", sample_paper: "Sample paper" };

function TurnView({ turn, onRetry, retryDisabled }: { turn: TutorTurn; onRetry: (id: string) => void; retryDisabled: boolean }) {
  const standing = turn.reply ? replyStanding(turn.reply.status) : null;
  return (
    <li className="tturn">
      <div className="tq" aria-label="You asked">
        <MathText text={turn.question} />
      </div>

      {turn.state === "pending" && (
        <div className="ta pending" role="status">
          <span className="tdot" aria-hidden="true" />
          {turn.attempts > 1 ? "Asking again…" : "Reading the context and working it out…"}
        </div>
      )}

      {turn.state === "answered" && turn.reply && (
        <div className="ta" aria-label="Tutor answer">
          {standing && (
            <div className="tstanding">
              <span className={"conf " + standing.form}>{standing.label}</span>
              {standing.note && <span className="tnote">{standing.note}</span>}
            </div>
          )}
          <div className="tbody"><MathText text={turn.reply.answer} /></div>
          {turn.reply.citations.length > 0 && (
            <div className="tsources">
              <div className="k">Web sources</div>
              <ul>
                {turn.reply.citations.map((c) => (
                  <li key={c.url}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer">
                      <span className="tsrc-title">{c.title || sourceHost(c.url)}</span>
                      <span className="tsrc-host">{sourceHost(c.url)}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="tnote">From the web, not from your paper or a marking scheme.</div>
            </div>
          )}
        </div>
      )}

      {turn.state === "failed" && turn.failure && (
        <div className="ta failed" role="alert">
          <div>{turn.failure.message}</div>
          {turn.failure.retryable && (
            <button type="button" className="btn ghost" disabled={retryDisabled} onClick={() => onRetry(turn.id)}>
              Try again
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function Tutor() {
  const { student } = useApp();
  const [params] = useSearchParams();
  const paperId = params.get("paper") || undefined;
  const attemptId = params.get("q") || undefined;
  const { paper, error: paperError } = usePaperResource(student?.id, paperId);
  const { openSheet } = useSheetControls();

  const [turns, dispatch] = useReducer(tutorReducer, []);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = isBusy(turns);

  // The question is addressed by its region, which is how the server scopes
  // evidence. An attempt with no region left falls back to the whole paper,
  // and the context line says so rather than claiming the narrower scope.
  const found = attemptId ? paper?.question_region.find((r) => r.committed_attempt_id === attemptId) : undefined;
  const region = found?.id ? (found as typeof found & { id: string }) : undefined;
  const attempt = attemptId ? paper?.student_attempt.find((a) => a.id === attemptId) : undefined;
  const contextReady = !paperId || !!paper || !!paperError;

  const context = useMemo(() => {
    if (!paperId) return { label: "Anything in your subjects", scope: "general" as const };
    if (paperError) return { label: "That paper couldn’t be opened", scope: "unavailable" as const };
    if (!paper) return { label: "Loading the paper…", scope: "loading" as const };
    const typeLabel = BOARD_NEUTRAL_LABEL[paper.type] && !student?.provider_key
      ? BOARD_NEUTRAL_LABEL[paper.type]
      : paperTypeLabel(paper.type, student?.provider_key ?? undefined);
    if (attemptId && region) {
      return { label: `${attempt?.question_label || "This question"} · ${typeLabel}`, scope: "question" as const };
    }
    return { label: typeLabel, scope: "paper" as const };
  }, [paperId, paperError, paper, attemptId, region, attempt, student?.provider_key]);

  const backTo = attemptId && paperId ? paths.question(paperId, attemptId) : paperId ? paths.paper(paperId) : paths.home;

  const send = useCallback(async (id: string, question: string) => {
    if (!student) return;
    try {
      const reply = await askTutor({
        studentId: student.id,
        message: question,
        requestId: id,
        ...(paperId && context.scope !== "unavailable" ? { paperId } : {}),
        ...(paperId && region ? { questionId: region.id } : {}),
      });
      dispatch({ type: "answered", id, reply });
    } catch (error) {
      dispatch({ type: "failed", id, failure: classifyTutorError(error) });
    }
  }, [student, paperId, region, context.scope]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const question = draft.trim();
    if (!question || busy || !student || !contextReady) return;
    const id = newTurnId();
    dispatch({ type: "ask", id, question });
    setDraft("");
    void send(id, question);
  };

  const retry = (id: string) => {
    const turn = turns.find((t) => t.id === id);
    if (!turn || busy) return;
    dispatch({ type: "retry", id });
    void send(id, turn.question);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit();
  };

  // Keep the newest turn in view. Under reduced motion it jumps.
  useEffect(() => {
    if (!turns.length) return;
    const reduce = document.documentElement.dataset.motion === "reduce"
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView?.({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [turns]);

  const clear = () => {
    openSheet({
      title: "Clear this conversation",
      body: "This removes the questions and answers from this screen. Nothing from it is kept anywhere else, so it can't be brought back.",
      primary: "Clear conversation",
      onConfirm: async () => {
        dispatch({ type: "clear" });
        inputRef.current?.focus();
      },
    });
  };

  if (!student) {
    return (
      <div style={{ padding: "16px var(--text-gutter)" }}>
        <p className="subnote">Choose a student in Settings to use the tutor.</p>
      </div>
    );
  }

  const remaining = MAX_QUESTION_LENGTH - draft.length;

  return (
    <div className="tutor">
      <div className="rvhead detailhead" style={{ position: "static" }}>
        <Link to={backTo} className="rvback" aria-label="Back">
          <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </Link>
        <h1 className="rvtitle">Tutor</h1>
        {turns.length > 0 ? (
          <button type="button" className="btn ghost tclear" onClick={clear} disabled={busy}>Clear</button>
        ) : <span className="tclear-spacer" aria-hidden="true" />}
      </div>

      <section className="qcard tcontext" aria-label="What the tutor is looking at">
        <div className="qfield">
          <div className="k">Asking about</div>
          <div className={"v" + (context.scope === "unavailable" ? " empty" : "")}>{context.label}</div>
          <div className="tnote">
            {context.scope === "question" && "It reads this question, your answer and your teacher’s marks and remarks."}
            {context.scope === "paper" && (attemptId
              ? "That question isn’t linked to its page any more, so the tutor reads the whole paper instead."
              : "It reads this paper’s questions, your answers and your teacher’s marks and remarks.")}
            {context.scope === "general" && "It doesn’t read any of your papers. Open a question first to ask about it."}
            {context.scope === "unavailable" && "Ask without it, or go back and open the paper again."}
          </div>
        </div>
      </section>

      {turns.length === 0 ? (
        <p className="subnote tempty">
          Ask what a question wanted, why a step lost marks, or how to start a method. Answers say how well they&rsquo;re supported.
        </p>
      ) : (
        <ol className="tturns" role="log" aria-live="polite" aria-relevant="additions text" aria-busy={busy}>
          {turns.map((turn) => (
            <TurnView key={turn.id} turn={turn} onRetry={retry} retryDisabled={busy} />
          ))}
        </ol>
      )}
      <div ref={endRef} />

      <form className="tcompose" onSubmit={submit}>
        <label htmlFor="tutor-question" className="sr-only">Your question</label>
        <textarea
          id="tutor-question"
          ref={inputRef}
          value={draft}
          rows={2}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder={context.scope === "question" ? "Ask about this question" : "Ask a question"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby="tutor-compose-hint"
        />
        <div className="trow">
          <span id="tutor-compose-hint" className="tnote">
            {busy ? "Waiting for the answer…" : remaining < 200 ? `${remaining} characters left` : "Enter to send · Shift+Enter for a new line"}
          </span>
          <button type="submit" className="btn primary" disabled={busy || !draft.trim() || !contextReady}>
            Send
          </button>
        </div>
      </form>

      <p className="subnote tfoot">
        This conversation stays on this device and is gone when you leave. The tutor explains; it doesn&rsquo;t change
        marks. If a mark looks wrong, that&rsquo;s a conversation with your teacher.
      </p>
    </div>
  );
}
