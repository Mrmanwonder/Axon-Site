import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SheetProvider } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";

const fixture = vi.hoisted(() => ({
  readPaper: vi.fn(),
  deletePaper: vi.fn(),
  deleteQuestion: vi.fn(),
  guard: vi.fn((action: () => void | Promise<void>) => action()),
}));

vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({ student: { id: "student-1", first_name: "Sam" } }),
}));

vi.mock("../../src/ui/data/useParentMode", () => ({
  useParentMode: () => ({ guard: fixture.guard }),
}));

vi.mock("../../src/ui/data/useAcademicShare", () => ({
  useAcademicShare: () => ({ activeShare: null, requestShare: vi.fn() }),
}));

vi.mock("../../src/ui/data/modules", () => ({
  readPaper: fixture.readPaper,
  deletePaper: fixture.deletePaper,
  deleteQuestion: fixture.deleteQuestion,
  paperTypeLabel: () => "Class test",
}));

vi.mock("../../src/ui/components/Crop", () => ({
  default: () => <div data-testid="crop" />,
}));
vi.mock("../../src/ui/components/AnswerBlock", () => ({
  default: () => <div data-testid="answer-block" />,
}));
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

import PaperOverview from "../../src/ui/pages/PaperOverview";
import QuestionDetail from "../../src/ui/pages/QuestionDetail";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const paper = {
  id: "paper-1",
  type: "unit_test",
  tier: "tier_1",
  date_taken: "2026-09-20",
  subject: "Physics",
  reported_total: 2,
  stated_maximum: 3,
  total_awarded: 2,
  total_available: 3,
  reconciled: true,
  paper_page: [],
  page_unreadable: [],
  question_region: [],
  student_attempt: [{
    id: "attempt-1",
    question_label: "1(a)",
    question_text: "State the result.",
    student_answer: "Two",
    answer_block: null,
    marks_awarded: 2,
    max_marks: 3,
    marks_source: "teacher_pen",
    teacher_remark: null,
    extraction_confidence: "confirmed",
    student_confirmed_at: "2026-09-20T00:00:00Z",
    mark_loss_event: [],
  }],
};

function mount(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ToastProvider>
        <SheetProvider>
          <Routes>
            <Route path="/library/:paperId" element={<PaperOverview />} />
            <Route path="/library/:paperId/:qId" element={<QuestionDetail />} />
            <Route path="*" element={<div>Library destination</div>} />
          </Routes>
          <LocationProbe />
        </SheetProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.readPaper.mockResolvedValue({ data: paper, stale: false, offline: false });
});

test("paper Delete is Parent-Mode gated, explains the consequence, stays single-flight, then returns to Library", async () => {
  const deletion = deferred<{ deleted: boolean; paper_id: string }>();
  fixture.deletePaper.mockReturnValue(deletion.promise);

  mount("/library/paper-1");

  const trigger = await screen.findByRole("button", { name: "Delete paper" });
  await userEvent.click(trigger);

  expect(fixture.guard).toHaveBeenCalledTimes(1);
  const dialog = await screen.findByRole("dialog", { name: "Delete this paper" });
  expect(dialog.textContent).toContain(
    "This permanently removes the saved paper, its pages, questions, explanations and derived data from Axon. It cannot be restored.",
  );

  const confirm = within(dialog).getByRole("button", { name: "Delete paper" });
  for (let tap = 0; tap < 8; tap += 1) fireEvent.click(confirm);
  await waitFor(() => expect(fixture.deletePaper).toHaveBeenCalledTimes(1));
  expect(fixture.deletePaper).toHaveBeenCalledWith("paper-1");

  await act(async () => deletion.resolve({ deleted: true, paper_id: "paper-1" }));

  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/library"));
  expect(await screen.findByText("Paper deleted.")).toBeTruthy();
});

test("question Delete is Parent-Mode gated, preserves the rest-of-paper consequence, and returns to the paper", async () => {
  const deletion = deferred<{ deleted: boolean; attempt_id: string; paper_id: string }>();
  fixture.deleteQuestion.mockReturnValue(deletion.promise);

  mount("/library/paper-1/attempt-1");

  const trigger = await screen.findByRole("button", { name: "Delete question" });
  await userEvent.click(trigger);

  expect(fixture.guard).toHaveBeenCalledTimes(1);
  const dialog = await screen.findByRole("dialog", { name: "Delete this question" });
  expect(dialog.textContent).toContain(
    "This permanently removes this question's saved answer, marks, explanation and extracted crop from the paper. The rest of the paper stays.",
  );

  const confirm = within(dialog).getByRole("button", { name: "Delete question" });
  for (let tap = 0; tap < 8; tap += 1) fireEvent.click(confirm);
  await waitFor(() => expect(fixture.deleteQuestion).toHaveBeenCalledTimes(1));
  expect(fixture.deleteQuestion).toHaveBeenCalledWith("attempt-1");

  await act(async () => deletion.resolve({
    deleted: true,
    attempt_id: "attempt-1",
    paper_id: "paper-1",
  }));

  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/library/paper-1"));
  expect(await screen.findByText("Question deleted.")).toBeTruthy();
});

test("failed deletion remains in the consequence sheet and does not navigate", async () => {
  fixture.deletePaper.mockRejectedValue(new Error("Deletion failed"));

  mount("/library/paper-1");
  await userEvent.click(await screen.findByRole("button", { name: "Delete paper" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete this paper" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete paper" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Deletion failed");
  expect(screen.getByTestId("location").textContent).toBe("/library/paper-1");
  expect(screen.getByRole("dialog", { name: "Delete this paper" })).toBeTruthy();
});
