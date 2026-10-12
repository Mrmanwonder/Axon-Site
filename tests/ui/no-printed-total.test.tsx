import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SheetProvider } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import { isCompleteTotal, isPartialTotal, totalNote } from "../../src/ui/data/paperTotals";

const fixture = vi.hoisted(() => ({ readPaper: vi.fn(), getCached: vi.fn() }));

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
  paperDifficultyFeedback: vi.fn().mockResolvedValue({ rating: null, skipped: true }),
  savePaperDifficultyFeedback: vi.fn(),
  deletePaper: vi.fn(),
  paperTypeLabel: () => "Class test",
  providerKeyForStudent: (s?: { provider_key?: string | null }) => s?.provider_key ?? null,
  paperTypesFor: () => [{ value: "unit_test", label: "Class test" }],
  setPaperType: vi.fn(),
  fixSavedPart: vi.fn(),
  deferPart: vi.fn(),
}));
vi.mock("../../src/cache.js", () => ({ getCached: fixture.getCached }));

import PaperOverview from "../../src/ui/pages/PaperOverview";

function paper(over: Record<string, unknown>) {
  return {
    id: "paper-1", type: "unit_test", tier: "tier_1", date_taken: "2026-09-20", subject: "Physics",
    reported_total: null, stated_maximum: null, total_awarded: 7, total_available: 10,
    total_basis: "added_up", total_partial: false, reconciled: null,
    paper_page: [], page_unreadable: [], question_region: [],
    student_attempt: [
      { id: "a1", question_label: "1", question_text: "q", student_answer: "x", answer_block: null, marks_awarded: 4, max_marks: 5,
        marks_source: "teacher_pen", teacher_remark: null, extraction_confidence: "confirmed", student_confirmed_at: "2026-09-20T00:00:00Z", mark_loss_event: [] },
      { id: "a2", question_label: "2", question_text: "q", student_answer: "x", answer_block: null, marks_awarded: 3, max_marks: 5,
        marks_source: "teacher_pen", teacher_remark: null, extraction_confidence: "confirmed", student_confirmed_at: "2026-09-20T00:00:00Z", mark_loss_event: [] },
    ],
    ...over,
  };
}

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

beforeEach(() => {
  vi.clearAllMocks();
  fixture.getCached.mockResolvedValue(null);
});

test("no printed total, every mark read: labelled as added up by Axon, never as a mismatch", async () => {
  fixture.readPaper.mockResolvedValue({ data: paper({}), stale: false, offline: false });
  mount();
  expect(await screen.findByText(/No total was printed on this paper\. Axon added up the marks it could read\./)).toBeTruthy();
  expect(screen.queryByText(/at least/i)).toBeNull();
  expect(screen.queryByText(/worth a look|does not match|do not add up/i)).toBeNull();
});

test("no printed total with an unreadable mark: the figure is shown as at least, and says why", async () => {
  fixture.readPaper.mockResolvedValue({ data: paper({ total_partial: true, total_awarded: 4, total_available: 5 }), stale: false, offline: false });
  mount();
  expect(await screen.findByText(/some marks couldn’t be read, so more may have been lost/i)).toBeTruthy();
  expect(screen.getByText(/^at least$/i)).toBeTruthy();
});

test("a printed total carries no added-up note", async () => {
  fixture.readPaper.mockResolvedValue({ data: paper({ reported_total: 7, total_basis: "printed", reconciled: true }), stale: false, offline: false });
  mount();
  await screen.findByText("Question 1");
  expect(screen.queryByText(/No total was printed/)).toBeNull();
  expect(screen.queryByText(/^at least$/i)).toBeNull();
});

test("a printed total that does not match still says so, with both numbers", async () => {
  fixture.readPaper.mockResolvedValue({ data: paper({ reported_total: 9, total_basis: "printed", reconciled: false }), stale: false, offline: false });
  mount();
  expect(await screen.findByText(/the total on your paper is/)).toBeTruthy();
});

test("paperTotals: partial totals never count as complete, and notes use the agreed framing", () => {
  expect(isPartialTotal({ total_partial: true })).toBe(true);
  expect(isCompleteTotal({ total_partial: true })).toBe(false);
  expect(isCompleteTotal({ total_basis: "added_up", total_partial: false })).toBe(true);
  expect(totalNote({ total_basis: "printed", total_partial: false })).toBeNull();
  expect(totalNote({ total_basis: "added_up", total_partial: true })).toMatch(/at least/);
  expect(totalNote(null)).toBeNull();
});
