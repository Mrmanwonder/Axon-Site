import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SheetProvider } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import { paperStructure, promptPreview } from "../../src/ui/data/paperStructure";

const fixture = vi.hoisted(() => ({ readPaper: vi.fn(), getCached: vi.fn() }));

vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({ student: { id: "student-1" }, removePaperFromLibrary: vi.fn(), refreshLibrary: vi.fn() }),
}));
vi.mock("../../src/ui/data/useAcademicShare", () => ({
  useAcademicShare: () => ({ activeShare: null, requestShare: vi.fn() }),
}));
vi.mock("../../src/ui/data/modules", () => ({
  readPaper: fixture.readPaper,
  deletePaper: vi.fn(),
  paperTypeLabel: () => "Class test",
  providerKeyForStudent: () => null,
}));
vi.mock("../../src/cache.js", () => ({ getCached: fixture.getCached }));

import PaperOverview from "../../src/ui/pages/PaperOverview";

type A = Record<string, unknown>;
const attempt = (id: string, label: string | null, over: A = {}) => ({
  id, question_label: label, question_text: null, student_answer: "x", answer_block: null,
  marks_awarded: 1, max_marks: 2, marks_source: "teacher_pen", teacher_remark: null,
  extraction_confidence: "confirmed", student_confirmed_at: null, mark_loss_event: [], ...over,
});
const region = (attemptId: string, page: number, y: number) => ({
  run_id: "run-1", explain_status: null, committed_attempt_id: attemptId, crop_key: null, confidence_signals: null,
  page_spans: [{ page, box: { x: 0, y, w: 1, h: 1 } }],
});

// The pictured Class test: 1(a)(i), (ii), (iii), then bare c, d, b, then 2(a). Nothing in the
// evidence says which question the bare parts belong to, so they must not be placed by guesswork.
const pictured = {
  student_attempt: [
    attempt("a1", "1(a)(i)", { marks_awarded: 2, max_marks: 2 }),
    attempt("a2", "1(a)(ii)", { marks_awarded: 1, max_marks: 2 }),
    attempt("a3", "1(a)(iii)", { marks_awarded: 2, max_marks: 3 }),
    attempt("a4", "c", { marks_awarded: 3, max_marks: 3 }),
    attempt("a5", "d", { marks_awarded: 2, max_marks: 4 }),
    attempt("a6", "b", { marks_awarded: 1, max_marks: 2 }),
    attempt("a7", "2(a)", { marks_awarded: 4, max_marks: 6 }),
  ],
  question_region: [],
};

test("bare parts with no page evidence stay unassigned and visible, never merged into a question", () => {
  const s = paperStructure(pictured as never);
  expect(s.questions.map((q) => q.number)).toEqual([1, 2]);
  expect(s.questions[0].parts.map((p) => p.path)).toEqual(["1(a)(i)", "1(a)(ii)", "1(a)(iii)"]);
  expect(s.unassigned.map((p) => p.path)).toEqual(["c", "d", "b"]);
  expect(s.counts).toMatchObject({ questions_total: 2, parts_total: 7, unassigned_parts: 3, raw_region_count: 7 });
});

test("grouping and counting come from one placement: totals agree with the groups", () => {
  const s = paperStructure(pictured as never);
  const grouped = s.questions.reduce((n, q) => n + q.parts.length, 0);
  expect(grouped + s.unassigned.length).toBe(s.counts.parts_total);
  expect(s.counts.questions_total).toBe(s.questions.length);
  expect(s.counts.unassigned_parts).toBe(s.unassigned.length);
});

test("a bare part on the same page as the question above it is placed there, and says so", () => {
  const s = paperStructure({
    student_attempt: [attempt("a1", "5(a)"), attempt("a2", "(b)")],
    question_region: [region("a1", 3, 100), region("a2", 3, 600)],
  } as never);
  expect(s.unassigned).toEqual([]);
  expect(s.questions[0].parts.map((p) => [p.path, p.placedByPosition])).toEqual([["5(a)", false], ["5(b)", true]]);
});

test("questions keep reading order: 10 never sorts before 2 as text", () => {
  const s = paperStructure({
    student_attempt: [attempt("a1", "2(a)"), attempt("a2", "10(a)"), attempt("a3", "11(a)")],
    question_region: [region("a1", 1, 10), region("a2", 2, 10), region("a3", 3, 10)],
  } as never);
  expect(s.questions.map((q) => q.number)).toEqual([2, 10, 11]);
});

test("an unread mark is not zero: it is counted apart and never added to the marks", () => {
  const s = paperStructure({
    student_attempt: [attempt("a1", "1", { marks_awarded: null, max_marks: 3 }), attempt("a2", "2")],
    question_region: [],
  } as never);
  expect(s.markedParts).toBe(1);
  expect(s.unmarkedParts).toBe(1);
  expect(s.questions[0].parts[0].marks).toEqual({ kind: "unread", max: 3 });
});

test("prompt preview is faithful: whitespace collapsed, cut on a word, never reworded", () => {
  expect(promptPreview("  State\n the   result. ")).toBe("State the result.");
  expect(promptPreview(null)).toBeNull();
  const long = "word ".repeat(60);
  const out = promptPreview(long)!;
  expect(out.endsWith("…")).toBe(true);
  expect(out.length).toBeLessThanOrEqual(121);
});

beforeEach(() => {
  vi.clearAllMocks();
  fixture.getCached.mockResolvedValue(null);
});

function mount() {
  return render(
    <MemoryRouter initialEntries={["/library/paper-1"]}>
      <ToastProvider>
        <SheetProvider>
          <Routes><Route path="/library/:paperId" element={<PaperOverview />} /></Routes>
        </SheetProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const base = {
  id: "paper-1", type: "unit_test", tier: "tier_1", date_taken: "2026-09-07", subject: null,
  reported_total: 27, stated_maximum: 27, total_awarded: 19, total_available: 27,
  total_basis: "printed", total_partial: false, reconciled: true,
  paper_page: [], page_unreadable: [],
};

test("the pictured paper renders as grouped questions with an honest unassigned group", async () => {
  fixture.readPaper.mockResolvedValue({ data: { ...base, ...pictured }, stale: false, offline: false });
  mount();

  expect(await screen.findByRole("heading", { level: 1, name: "Class test" })).toBeTruthy();
  expect(screen.getByText("Subject not identified")).toBeTruthy();
  expect(screen.getByText(/Added 7 Sep/)).toBeTruthy();
  expect(screen.getByText("15 of 22 from your teacher · 2 questions · 7 parts")).toBeTruthy();
  // The overview no longer badges settled rows; that state lives on the question.
  expect(screen.queryByText("Confirmed by you")).toBeNull();

  const q1 = screen.getByRole("heading", { level: 2, name: "Question 1" }).closest("section")!;
  expect(within(q1).getAllByRole("link")).toHaveLength(3);
  expect(within(q1).getByText("1(a)(ii)")).toBeTruthy();

  const loose = screen.getByRole("heading", { level: 2, name: "Unassigned parts" }).closest("section")!;
  expect(within(loose).getAllByRole("link")).toHaveLength(3);
  expect(within(loose).getByText("Part c")).toBeTruthy();
  expect(within(loose).getAllByText("Question text not read").length).toBe(3);
});

test("headline is marks lost, with at-least framing whenever a mark is unread", async () => {
  fixture.readPaper.mockResolvedValue({
    data: { ...base, total_partial: true, student_attempt: [attempt("a1", "1", { marks_awarded: 1, max_marks: 3 }), attempt("a2", "2", { marks_awarded: null, max_marks: 4 })], question_region: [] },
    stale: false, offline: false,
  });
  mount();
  expect(await screen.findByText(/2 marks lost/)).toBeTruthy();
  expect(screen.getByText(/At least/)).toBeTruthy();
  expect(screen.getByText(/Mark not read · out of 4/)).toBeTruthy();
  expect(screen.getByText(/1 part has no readable mark\./)).toBeTruthy();
});

test("a needs-checking part is the next action and links to that exact part", async () => {
  fixture.readPaper.mockResolvedValue({
    data: { ...base, student_attempt: [attempt("a1", "1"), attempt("a2", "2", { extraction_confidence: "unsure" })], question_region: [] },
    stale: false, offline: false,
  });
  mount();
  const link = await screen.findByRole("link", { name: "Open 2" });
  expect(link.getAttribute("href")).toBe("/library/paper-1/a2");
  expect(screen.getByText("Needs checking")).toBeTruthy();
});

test("an unassigned part can be placed under a question by hand", async () => {
  fixture.readPaper.mockResolvedValue({ data: { ...base, ...pictured }, stale: false, offline: false });
  mount();
  const loose = (await screen.findByRole("heading", { level: 2, name: "Unassigned parts" })).closest("section")!;
  expect(within(loose).getAllByRole("button", { name: "Place under a question" })).toHaveLength(3);
});
