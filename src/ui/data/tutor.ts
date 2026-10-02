/* ═══════════════════════════════════════════════════════════════════════════
   TUTOR — state and failure vocabulary (AXO-39)

   Pure on purpose: everything the screen decides about a turn lives here, so
   tests can drive it without a browser.

   A conversation is held in memory on this device and nowhere else. The API
   persists no conversation (the intelligence worker keeps a pseudonymous
   audit trace, never the text), so "delete this conversation" is honest by
   construction: clearing the state is the deletion, and leaving the screen
   does the same.

   One logical turn per question. A retry re-sends the same requestId and
   replaces that turn's outcome; it never appends a second copy of the
   question.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { TutorReply } from "./modules";

export type TutorFailureKind = "auth" | "scope" | "unavailable" | "rate_limited" | "network" | "too_long" | "model";

export type TutorFailure = { kind: TutorFailureKind; message: string; retryable: boolean };

export type TutorTurn = {
  id: string;
  question: string;
  state: "pending" | "answered" | "failed";
  reply?: TutorReply;
  failure?: TutorFailure;
  attempts: number;
};

export type TutorAction =
  | { type: "ask"; id: string; question: string }
  | { type: "retry"; id: string }
  | { type: "answered"; id: string; reply: TutorReply }
  | { type: "failed"; id: string; failure: TutorFailure }
  | { type: "clear" };

export function tutorReducer(turns: TutorTurn[], action: TutorAction): TutorTurn[] {
  switch (action.type) {
    case "ask":
      if (turns.some((t) => t.id === action.id)) return turns;
      return [...turns, { id: action.id, question: action.question, state: "pending", attempts: 1 }];
    case "retry":
      return turns.map((t) =>
        t.id === action.id && t.state === "failed"
          ? { id: t.id, question: t.question, state: "pending", attempts: t.attempts + 1 }
          : t);
    case "answered":
      return turns.map((t) => (t.id === action.id ? { ...t, state: "answered", reply: action.reply, failure: undefined } : t));
    case "failed":
      return turns.map((t) => (t.id === action.id ? { ...t, state: "failed", failure: action.failure, reply: undefined } : t));
    case "clear":
      return [];
  }
}

/** True while any turn is waiting; the composer sends one question at a time. */
export const isBusy = (turns: TutorTurn[]) => turns.some((t) => t.state === "pending");

export const MAX_QUESTION_LENGTH = 4000;

/**
 * Turn whatever the request threw into one of seven things the student can act
 * on. Status codes come from mastery-api /tutor and axon-intelligence; the
 * server's own copy is used where it was written for a student.
 */
export function classifyTutorError(error: unknown): TutorFailure {
  const e = error as { status?: number; message?: string; code?: string; body?: { error?: string; retryAfterSeconds?: number } } | null;
  const status = e?.status;
  if (e?.code === "unauthenticated" || status === 401) {
    return { kind: "auth", message: "You've been signed out. Sign in again to keep asking.", retryable: false };
  }
  if (status === 403) {
    return { kind: "scope", message: "The tutor answers for the student who is signed in. Switch to that student in Settings, then ask again.", retryable: false };
  }
  if (status === 413) {
    return { kind: "too_long", message: "That question is too long to send. Shorten it and ask again.", retryable: false };
  }
  if (status === 429) {
    const wait = e?.body?.retryAfterSeconds;
    const when = typeof wait === "number" && wait > 0
      ? (wait < 90 ? "in a minute" : `in about ${Math.ceil(wait / 60)} minutes`)
      : "in a few minutes";
    return { kind: "rate_limited", message: `You've asked a lot in a short time. Try again ${when}.`, retryable: true };
  }
  if (status === 503) {
    return { kind: "unavailable", message: "The tutor isn't available on your account yet.", retryable: false };
  }
  if (status === undefined) {
    return { kind: "network", message: "Couldn't reach Axon. Check your connection and try again.", retryable: true };
  }
  return { kind: "model", message: "The tutor couldn't put together an answer this time. Your question wasn't saved anywhere.", retryable: true };
}

/** How sure the answer is, in words, alongside the form the badge takes. */
export function replyStanding(status: TutorReply["status"]): { label: string; form: "likely" | "unsure"; note: string | null } | null {
  switch (status) {
    case "supported":
      return { label: "Supported", form: "likely", note: null };
    case "partially_supported":
      return { label: "Partly supported", form: "unsure", note: "Some of this goes beyond what your paper and the sources show. Check it against your notes." };
    case "insufficient_evidence":
      return { label: "Not enough to go on", form: "unsure", note: null };
    case "controlled_failure":
      return null;
  }
}

/** A web source is shown by its host, so it is never mistaken for your paper or a marking scheme. */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Per-turn id, sent as requestId so a retry is recognisably the same question. */
export function newTurnId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Whether to show "Ask the tutor" on question and paper screens.
 *
 * The server decides who the tutor answers (TUTOR_ROLLOUT on mastery-api);
 * this only decides whether to offer it. Off unless the build sets
 * VITE_TUTOR_UI=true, or this one device has opted into the internal preview
 * (localStorage "axon.tutor.preview" = "1"), which is how the owner reaches it
 * during the internal stage without every family seeing an entry the server
 * would refuse.
 */
export function tutorEntryVisible(): boolean {
  if (import.meta.env.VITE_TUTOR_UI === "true") return true;
  try {
    return globalThis.localStorage?.getItem("axon.tutor.preview") === "1";
  } catch {
    return false;
  }
}
