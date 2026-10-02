import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  resolve: vi.fn(),
}));

vi.mock("../../src/ui/data/modules", () => ({
  resolveAcademicShare: fixture.resolve,
}));

vi.mock("../../src/ui/components/MathText", () => ({
  default: ({ text }: { text: string }) => <>{text}</>,
}));

import SharedAcademic from "../../src/ui/pages/SharedAcademic";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/share#token=" + "a".repeat(64));
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

test("paper share renders only the deliberately shared academic snapshot and is noindex", async () => {
  fixture.resolve.mockResolvedValue({
    found: true,
    kind: "paper",
    expires_at: "2026-09-26T07:00:00Z",
    paper: {
      type: "unit_test",
      tier: "tier_1",
      date_taken: "2026-09-20",
      subject: "Physics",
      total_awarded: 7,
      total_available: 10,
      reconciled: true,
    },
    questions: [{
      question_label: "1(a)",
      question_text: "State the result.",
      student_answer: "Two",
      marks_awarded: 2,
      max_marks: 3,
      marks_source: "teacher_pen",
      teacher_remark: "Good setup",
      extraction_confidence: "confirmed",
    }],
  });

  render(<SharedAcademic />);

  expect(await screen.findByRole("heading", { name: "Class test" })).toBeTruthy();
  expect(document.querySelector(".shared-sub")?.textContent).toMatch(/^Physics · .+2026$/);
  expect(screen.getByText("State the result.")).toBeTruthy();
  expect(screen.getByText("Two")).toBeTruthy();
  expect(screen.getByText("Good setup")).toBeTruthy();
  expect(screen.getByText(/Only this saved paper was shared/)).toBeTruthy();

  expect(fixture.resolve).toHaveBeenCalledWith("a".repeat(64));
  expect(window.location.hash).toBe("");
  expect(sessionStorage.getItem("axon.academic-share-token")).toBe("a".repeat(64));
  await waitFor(() => {
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content"))
      .toBe("noindex, nofollow");
  });

  expect(document.body.textContent).not.toContain("student-1");
  expect(document.body.textContent).not.toContain("parent@example");
});

test("question share renders one question without exposing a paper list", async () => {
  fixture.resolve.mockResolvedValue({
    found: true,
    kind: "question",
    expires_at: "2026-09-26T07:00:00Z",
    paper: {
      type: "unit_test",
      tier: "tier_1",
      date_taken: "2026-09-20",
      subject: "Physics",
    },
    question: {
      question_label: "2",
      question_text: "Calculate x.",
      student_answer: "x = 4",
      marks_awarded: 3,
      max_marks: 4,
      marks_source: "teacher_pen",
      teacher_remark: null,
      extraction_confidence: "likely",
    },
  });

  render(<SharedAcademic />);

  expect(await screen.findByRole("heading", { name: "Shared question" })).toBeTruthy();
  expect(screen.getByText("Calculate x.")).toBeTruthy();
  expect(screen.getByText("x = 4")).toBeTruthy();
  expect(screen.getByText(/Only this saved question was shared/)).toBeTruthy();
  expect(screen.queryByText(/questions$/)).toBeNull();
});

test("expired, revoked and unknown links share one non-enumerating unavailable state", async () => {
  fixture.resolve.mockResolvedValue({ found: false });

  render(<SharedAcademic />);

  expect(await screen.findByRole("heading", { name: "This link isn’t available" })).toBeTruthy();
  expect(screen.getByText(/expired, been stopped/)).toBeTruthy();
  expect(document.body.textContent).not.toContain("revoked");
  expect(document.body.textContent).not.toContain("unknown token");
});

test("network failure is an admitted gap rather than an expired-link claim", async () => {
  fixture.resolve.mockRejectedValue(new Error("network"));

  render(<SharedAcademic />);

  expect(await screen.findByRole("heading", { name: "We couldn’t open this link" })).toBeTruthy();
  expect(screen.getByText("This shared item could not be opened right now.")).toBeTruthy();
});

test("shared feedback does not claim to know what went wrong; it states its basis", async () => {
  const base = {
    question_label: "1", question_text: "Q", student_answer: "A", marks_awarded: 1, max_marks: 2,
    marks_source: "teacher_pen", extraction_confidence: "confirmed",
    feedback: { cause: "presentation", marks_lost: 1, explanation: "E", do_this_next: "D", command_word: null,
      command_word_note: null, loss_reasons: [], corrected_answer: null, corrected_answer_state: "unavailable" },
  };
  const paper = { type: "unit_test", tier: "tier_1", date_taken: "2026-09-20", subject: "Physics" };
  fixture.resolve.mockResolvedValue({ found: true, kind: "question", expires_at: "2026-09-26T07:00:00Z", paper, question: { ...base, teacher_remark: "Show working" } });
  const first = render(<SharedAcademic />);
  expect(await screen.findByText(/Axon's reading of the lost marks/)).toBeTruthy();
  expect(screen.queryByText("What went wrong")).toBeNull();
  expect(screen.getByText(/Based on the teacher's marks and written remark/)).toBeTruthy();
  first.unmount();

  sessionStorage.clear();
  window.history.replaceState({}, "", "/share#token=" + "a".repeat(64));
  fixture.resolve.mockResolvedValue({ found: true, kind: "question", expires_at: "2026-09-26T07:00:00Z", paper, question: { ...base, teacher_remark: null } });
  render(<SharedAcademic />);
  expect(await screen.findByText(/Based on the teacher's marks only/)).toBeTruthy();
});
