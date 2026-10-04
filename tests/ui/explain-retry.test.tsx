import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SheetProvider } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";

const fixture = vi.hoisted(() => ({
  readPaper: vi.fn(),
  explainRetry: vi.fn(),
  recordFeedback: vi.fn(),
  getCached: vi.fn(),
}));

vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({
    student: { id: "student-1", first_name: "Sam" },
    removePaperFromLibrary: vi.fn(),
    refreshLibrary: vi.fn(),
  }),
}));
vi.mock("../../src/ui/data/useAcademicShare", () => ({
  useAcademicShare: () => ({ activeShare: null, requestShare: vi.fn() }),
}));
vi.mock("../../src/ui/data/modules", () => ({
  readPaper: fixture.readPaper,
  explainRetry: fixture.explainRetry,
  recordExplanationFeedback: fixture.recordFeedback,
  deleteQuestion: vi.fn(),
  providerKeyForStudent: (s?: { provider_key?: string | null }) => s?.provider_key ?? null,
  paperTypeLabel: () => "Class test",
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
vi.mock("../../src/ui/components/Disclose", () => ({
  default: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><span>{label}</span>{children}</div>
  ),
}));

import QuestionDetail from "../../src/ui/pages/QuestionDetail";

function paperWith(explainStatus: string | null) {
  return {
    id: "paper-1", type: "unit_test", tier: "tier_1", date_taken: "2026-09-20", subject: "Physics",
    reported_total: 2, stated_maximum: 3, total_awarded: 2, total_available: 3, reconciled: true,
    paper_page: [], page_unreadable: [],
    question_region: [{
      run_id: "run-1", committed_attempt_id: "attempt-1", page_spans: null, crop_key: null,
      confidence_signals: null, explain_status: explainStatus,
    }],
    student_attempt: [{
      id: "attempt-1", question_label: "1(a)", question_text: "State the result.", student_answer: "Two",
      answer_block: null, marks_awarded: 1, max_marks: 3, marks_source: "teacher_pen", teacher_remark: null,
      extraction_confidence: "confirmed", student_confirmed_at: "2026-09-20T00:00:00Z", mark_loss_event: [],
    }],
  };
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/library/paper-1/attempt-1"]}>
      <ToastProvider>
        <SheetProvider>
          <Routes>
            <Route path="/library/:paperId/:qId" element={<QuestionDetail />} />
          </Routes>
        </SheetProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.getCached.mockResolvedValue(null);
});

test("a failed explanation says so and offers a retry that re-reads the paper", async () => {
  fixture.readPaper.mockResolvedValueOnce({ data: paperWith("failed"), stale: false, offline: false });
  fixture.explainRetry.mockResolvedValue({ run_id: "run-1", retrying: 1 });
  fixture.readPaper.mockResolvedValueOnce({ data: paperWith("queued"), stale: false, offline: false });

  mount();
  expect(await screen.findByText(/couldn.t write the explanation/i)).toBeTruthy();
  // The machine reason is not user copy and must never appear.
  expect(screen.queryByText(/sweep_timeout/)).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(fixture.explainRetry).toHaveBeenCalledWith("run-1"));
  expect(await screen.findByText(/being written/i)).toBeTruthy();
});

test("a retry that cannot start keeps the button and says why", async () => {
  fixture.readPaper.mockResolvedValue({ data: paperWith("failed"), stale: false, offline: false });
  fixture.explainRetry.mockRejectedValue(new Error("Could not reach the server. Check your connection and try again."));

  mount();
  await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/Could not reach the server/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

test("a queued explanation is described as being written, with no retry", async () => {
  fixture.readPaper.mockResolvedValue({ data: paperWith("queued"), stale: false, offline: false });
  mount();
  expect(await screen.findByText(/being written/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});

test("an explanation can be marked helpful; the screen acknowledges once and says nothing about storage", async () => {
  const withLoss = paperWith("done");
  (withLoss.student_attempt[0] as any).mark_loss_event = [{
    id: "loss-1", cause: "procedural_slip", marks_lost: 2, ai_explanation: "You skipped a step.",
    do_this_next: null, concepts: [], command_word: null, command_word_note: null, model_answer: null,
    loss_reasons: [], grounding_status: "complete", model_answer_source: null, depends_on_parts: [],
    unresolved_parts: [], confidence: "likely", student_confirmed_at: null, student_rejected_at: null,
  }];
  fixture.readPaper.mockResolvedValue({ data: withLoss, stale: false, offline: false });
  fixture.recordFeedback.mockResolvedValue({ recorded: false });

  mount();
  await userEvent.click(await screen.findByRole("button", { name: "Helped" }));
  await waitFor(() => expect(fixture.recordFeedback).toHaveBeenCalledWith("attempt-1", true));
  expect(await screen.findByText("Noted.")).toBeTruthy();
  expect(screen.getByText("Noted.").textContent).toBe("Noted.");
});

test("a feedback call that fails offers another try", async () => {
  const withLoss = paperWith("done");
  (withLoss.student_attempt[0] as any).mark_loss_event = [{
    id: "loss-1", cause: "procedural_slip", marks_lost: 2, ai_explanation: "You skipped a step.",
    do_this_next: null, concepts: [], command_word: null, command_word_note: null, model_answer: null,
    loss_reasons: [], grounding_status: "complete", model_answer_source: null, depends_on_parts: [],
    unresolved_parts: [], confidence: "likely", student_confirmed_at: null, student_rejected_at: null,
  }];
  fixture.readPaper.mockResolvedValue({ data: withLoss, stale: false, offline: false });
  fixture.recordFeedback.mockRejectedValue(new Error("offline"));

  mount();
  await userEvent.click(await screen.findByRole("button", { name: "Not right" }));
  expect(await screen.findByText(/did not send/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Helped" })).toBeTruthy();
});
