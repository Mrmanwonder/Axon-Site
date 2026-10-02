import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SheetProvider } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import { classifyTutorError, replyStanding, tutorReducer } from "../../src/ui/data/tutor";
import type { TutorTurn } from "../../src/ui/data/tutor";

const fixture = vi.hoisted(() => ({
  readPaper: vi.fn(),
  askTutor: vi.fn(),
  getCached: vi.fn(),
}));

vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({
    student: { id: "student-1", first_name: "Sam", provider_key: null },
    removePaperFromLibrary: vi.fn(),
    refreshLibrary: vi.fn(),
  }),
}));
vi.mock("../../src/ui/data/useAcademicShare", () => ({
  useAcademicShare: () => ({ activeShare: null, shareStatusKnown: true, requestShare: vi.fn() }),
}));
vi.mock("../../src/ui/data/modules", () => ({
  readPaper: fixture.readPaper,
  askTutor: fixture.askTutor,
  explainRetry: vi.fn(),
  recordExplanationFeedback: vi.fn(),
  deleteQuestion: vi.fn(),
  paperTypeLabel: () => "Class test",
  providerKeyForStudent: (s?: { provider_key?: string | null }) => s?.provider_key ?? null,
}));
vi.mock("../../src/cache.js", () => ({ getCached: fixture.getCached }));
vi.mock("../../src/ui/components/Crop", () => ({ default: () => <div /> }));
vi.mock("../../src/ui/components/AnswerBlock", () => ({ default: () => <div /> }));
vi.mock("../../src/ui/components/MathText", () => ({
  default: ({ text }: { text: string }) => <>{text}</>,
}));
vi.mock("../../src/ui/components/WorkedAnswer", () => ({
  default: ({ text }: { text: string }) => <>{text}</>,
}));

import Tutor from "../../src/ui/pages/Tutor";
import QuestionDetail from "../../src/ui/pages/QuestionDetail";

const PAPER = {
  id: "paper-1", type: "unit_test", tier: "tier_1", date_taken: "2026-09-20", subject: "Physics",
  reported_total: 2, stated_maximum: 3, total_awarded: 1, total_available: 3, reconciled: true,
  paper_page: [], page_unreadable: [],
  question_region: [{
    id: "region-1", run_id: "run-1", committed_attempt_id: "attempt-1", page_spans: null, crop_key: null,
    confidence_signals: null, explain_status: "done",
  }],
  student_attempt: [{
    id: "attempt-1", question_label: "1(a)", question_text: "State the result.", student_answer: "Two",
    answer_block: null, marks_awarded: 1, max_marks: 3, marks_source: "teacher_pen", teacher_remark: null,
    extraction_confidence: "confirmed", student_confirmed_at: "2026-09-20T00:00:00Z", mark_loss_event: [],
  }],
};

const reply = (over: Record<string, unknown> = {}) => ({
  traceId: "trace-1",
  status: "supported",
  answer: "Write the formula on its own line, then substitute.",
  citations: [],
  verification: { passed: true, repaired: false, failures: [] },
  ...over,
});

function mount(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <SheetProvider>
          <Routes>
            <Route path="/tutor" element={<Tutor />} />
            <Route path="/library/:paperId/:qId" element={<QuestionDetail />} />
          </Routes>
        </SheetProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function ask(text: string) {
  const box = await screen.findByLabelText("Your question");
  await waitFor(() => expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true));
  await userEvent.type(box, text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.getCached.mockResolvedValue(null);
  fixture.readPaper.mockResolvedValue({ data: PAPER, stale: false, offline: false });
});
afterEach(() => {
  localStorage.removeItem("axon.tutor.preview");
});

describe("turn state", () => {
  test("a retry replaces the same turn instead of adding a second question", () => {
    let turns: TutorTurn[] = [];
    turns = tutorReducer(turns, { type: "ask", id: "a", question: "Why?" });
    turns = tutorReducer(turns, { type: "failed", id: "a", failure: { kind: "network", message: "x", retryable: true } });
    turns = tutorReducer(turns, { type: "retry", id: "a" });
    turns = tutorReducer(turns, { type: "answered", id: "a", reply: reply() as never });
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ id: "a", state: "answered", attempts: 2 });
    // Asking with an id already present is a no-op, not a duplicate.
    expect(tutorReducer(turns, { type: "ask", id: "a", question: "Why?" })).toHaveLength(1);
  });

  test("failures are told apart and only the recoverable ones offer a retry", () => {
    const c = (e: unknown) => classifyTutorError(e);
    expect(c({ code: "unauthenticated" })).toMatchObject({ kind: "auth", retryable: false });
    expect(c({ status: 403 })).toMatchObject({ kind: "scope", retryable: false });
    expect(c({ status: 413 })).toMatchObject({ kind: "too_long", retryable: false });
    expect(c({ status: 503 })).toMatchObject({ kind: "unavailable", retryable: false });
    expect(c({ status: 500 })).toMatchObject({ kind: "model", retryable: true });
    expect(c(new Error("Could not reach the server."))).toMatchObject({ kind: "network", retryable: true });
    const limited = c({ status: 429, body: { error: "RATE_LIMITED", retryAfterSeconds: 300 } });
    expect(limited).toMatchObject({ kind: "rate_limited", retryable: true });
    expect(limited.message).toMatch(/about 5 minutes/);
  });

  test("standing is form, never a percentage", () => {
    expect(replyStanding("supported")).toMatchObject({ form: "likely" });
    expect(replyStanding("partially_supported")).toMatchObject({ form: "unsure" });
    expect(replyStanding("insufficient_evidence")).toMatchObject({ form: "unsure" });
    for (const s of ["supported", "partially_supported", "insufficient_evidence"] as const) {
      expect(replyStanding(s)!.label).not.toMatch(/%|\d/);
    }
  });
});

describe("Tutor screen", () => {
  test("asking about a question sends only ids, scoped to that question's region", async () => {
    fixture.askTutor.mockResolvedValue(reply());
    mount("/tutor?paper=paper-1&q=attempt-1");

    expect(await screen.findByText("1(a) · Class test")).toBeTruthy();
    await ask("Why did I lose two marks?");

    await waitFor(() => expect(fixture.askTutor).toHaveBeenCalledTimes(1));
    const body = fixture.askTutor.mock.calls[0][0];
    expect(body).toMatchObject({ studentId: "student-1", paperId: "paper-1", questionId: "region-1", message: "Why did I lose two marks?" });
    expect(typeof body.requestId).toBe("string");
    // The request never carries paper content: the server loads evidence itself.
    expect(Object.keys(body).sort()).toEqual(["message", "paperId", "questionId", "requestId", "studentId"]);

    expect(await screen.findByText(/formula on its own line/)).toBeTruthy();
    expect(screen.getByText("Supported").className).toContain("conf likely");
    expect(screen.getByRole("log")).toBeTruthy();
  });

  test("a partly supported answer says so, and web sources are labelled as the web", async () => {
    fixture.askTutor.mockResolvedValue(reply({
      status: "partially_supported",
      citations: [{ title: "Ohm's law", url: "https://www.example.org/ohm" }],
    }));
    mount("/tutor?paper=paper-1&q=attempt-1");
    await ask("What is Ohm's law?");

    const badge = await screen.findByText("Partly supported");
    expect(badge.className).toContain("conf unsure");
    expect(screen.getByText(/goes beyond what your paper/)).toBeTruthy();
    expect(screen.getByText("Web sources")).toBeTruthy();
    expect(screen.getByText("example.org")).toBeTruthy();
    expect(screen.getByText(/not from your paper or a marking scheme/)).toBeTruthy();
  });

  test("a lost connection is one turn: Try again re-sends the same request id", async () => {
    fixture.askTutor
      .mockRejectedValueOnce(new Error("Could not reach the server. Check your connection and try again."))
      .mockResolvedValueOnce(reply());
    mount("/tutor?paper=paper-1&q=attempt-1");
    await ask("Explain step two");

    expect(await screen.findByText(/Couldn.t reach Axon/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/formula on its own line/)).toBeTruthy();

    expect(fixture.askTutor).toHaveBeenCalledTimes(2);
    expect(fixture.askTutor.mock.calls[0][0].requestId).toBe(fixture.askTutor.mock.calls[1][0].requestId);
    expect(screen.getAllByText("Explain step two")).toHaveLength(1);
  });

  test("an account without the tutor is told so plainly, with nothing to retry", async () => {
    fixture.askTutor.mockRejectedValue(Object.assign(new Error("The tutor is not available yet."), { status: 503 }));
    mount("/tutor");
    await ask("Hello");
    expect(await screen.findByText(/isn.t available on your account yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  test("Enter sends and Shift+Enter starts a new line", async () => {
    fixture.askTutor.mockResolvedValue(reply());
    mount("/tutor");
    const box = await screen.findByLabelText("Your question");
    await userEvent.type(box, "line one{Shift>}{Enter}{/Shift}line two");
    expect(fixture.askTutor).not.toHaveBeenCalled();
    await userEvent.type(box, "{Enter}");
    await waitFor(() => expect(fixture.askTutor).toHaveBeenCalledTimes(1));
    expect(fixture.askTutor.mock.calls[0][0].message).toBe("line one\nline two");
    // A general question names no paper and no question.
    expect(fixture.askTutor.mock.calls[0][0].paperId).toBeUndefined();
  });

  test("Clear removes the conversation through the consequence sheet, with no 'are you sure'", async () => {
    fixture.askTutor.mockResolvedValue(reply());
    mount("/tutor");
    await ask("First question");
    expect(await screen.findByText(/formula on its own line/)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/are you sure/i)).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Clear conversation" }));
    await waitFor(() => expect(screen.queryByText("First question")).toBeNull());
    expect(screen.queryByRole("log")).toBeNull();
  });
});

describe("entry points", () => {
  test("the question screen offers no tutor entry unless the build or this device opts in", async () => {
    mount("/library/paper-1/attempt-1");
    expect(await screen.findByText("State the result.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Ask the tutor/ })).toBeNull();
  });

  test("with the device preview on, the entry carries this question's scope", async () => {
    localStorage.setItem("axon.tutor.preview", "1");
    mount("/library/paper-1/attempt-1");
    const link = await screen.findByRole("link", { name: "Ask the tutor about this question" });
    expect(link.getAttribute("href")).toBe("/tutor?paper=paper-1&q=attempt-1");
  });
});
