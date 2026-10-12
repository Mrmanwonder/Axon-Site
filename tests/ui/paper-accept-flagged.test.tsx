// Owner, 8 Oct 2026: the paper offers one tap to accept the flagged parts as
// read, says that accepted parts count in Insights, and leaves out any part
// missing a mark (it still needs "Fix this").
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SheetProvider } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";

const fixture = vi.hoisted(() => ({ readPaper: vi.fn(), getCached: vi.fn(), fixSavedPart: vi.fn() }));

vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({ student: { id: "student-1", first_name: "Sam" }, removePaperFromLibrary: vi.fn(), refreshLibrary: vi.fn() }),
}));
vi.mock("../../src/ui/data/useAcademicShare", () => ({ useAcademicShare: () => ({ activeShare: null, requestShare: vi.fn() }) }));
vi.mock("../../src/ui/data/modules", () => ({
  readPaper: fixture.readPaper,
  deletePaper: vi.fn(),
  paperTypeLabel: () => "Class test",
  providerKeyForStudent: () => null,
  paperTypesFor: () => [{ value: "unit_test", label: "Class test" }],
  setPaperType: vi.fn(),
  fixSavedPart: fixture.fixSavedPart,
  deferPart: vi.fn(),
}));
vi.mock("../../src/cache.js", () => ({ getCached: fixture.getCached }));

import PaperOverview from "../../src/ui/pages/PaperOverview";

const attempt = (id: string, label: string, awarded: number | null) => ({
  id, question_label: label, question_text: "q", student_answer: "x", answer_block: null, marks_awarded: awarded, max_marks: 2,
  marks_source: "teacher_pen", teacher_remark: null, extraction_confidence: "unsure", student_confirmed_at: null, mark_loss_event: [],
});
const region = (id: string, attemptId: string, order: number, awarded: number | null) => ({
  id, run_id: "run-1", order_index: order, committed_attempt_id: attemptId, needs_review: true, student_confirmed_at: null,
  review_deferred_at: null, confidence_tier: "unsure", confidence_signals: { recognition: false },
  marks_awarded: awarded, marks_available: 2, explain_status: null, page_spans: null, crop_key: null,
});

function paper() {
  return {
    id: "paper-1", type: "unit_test", tier: "tier_1", date_taken: "2026-10-08", subject: "Physics",
    reported_total: null, stated_maximum: null, total_awarded: 2, total_available: 6, total_basis: "added_up",
    total_partial: true, reconciled: null, paper_page: [], page_unreadable: [],
    extraction_run: [{ id: "run-1", status: "committed", committed_at: "2026-10-08T00:00:00Z" }],
    question_region: [region("r1", "a1", 0, 1), region("r2", "a2", 1, 1), region("r3", "a3", 2, null)],
    student_attempt: [attempt("a1", "1", 1), attempt("a2", "2", 1), attempt("a3", "3", null)],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.getCached.mockResolvedValue(null);
  fixture.fixSavedPart.mockResolvedValue({});
  fixture.readPaper.mockResolvedValue({ data: paper(), stale: false, offline: false });
});

test("Accept all accepts the readable flagged parts and leaves the one missing its mark", async () => {
  render(
    <MemoryRouter initialEntries={["/library/paper-1"]}>
      <ToastProvider><SheetProvider>
        <Routes><Route path="/library/:paperId" element={<PaperOverview />} /></Routes>
      </SheetProvider></ToastProvider>
    </MemoryRouter>,
  );
  const button = await screen.findByRole("button", { name: "Accept all 2 as read" });
  expect(screen.getByText(/Accepted parts count in your Insights\./)).toBeTruthy();
  expect(screen.getByText(/Parts missing a mark still need a fix\./)).toBeTruthy();
  await userEvent.setup().click(button);
  await waitFor(() => expect(fixture.fixSavedPart).toHaveBeenCalledTimes(2));
  expect(fixture.fixSavedPart.mock.calls.map((c) => c[0]).sort()).toEqual(["r1", "r2"]);
});
