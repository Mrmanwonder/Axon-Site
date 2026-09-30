import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaperReview from "../../src/ui/pages/PaperReview";

const fixture = vi.hoisted(() => ({
  progress: new Map<string, any>(),
  refreshLibrary: vi.fn(),
  resumeDraftReview: vi.fn(),
  ensureScan: vi.fn(),
  reviewOpen: false,
}));

vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({
    student: { id: "student-1" },
    progressResource: {
      state: "ready",
      data: fixture.progress,
      source: "live",
      fetchedAt: Date.now(),
    },
    refreshLibrary: fixture.refreshLibrary,
  }),
}));

vi.mock("../../src/ui/scan/ScanProvider", () => ({
  useScan: () => ({
    ensureScan: fixture.ensureScan,
    reviewOpen: fixture.reviewOpen,
  }),
}));

function progress(status: string, extra: Record<string, unknown> = {}) {
  return {
    paper_id: "paper-1",
    status,
    status_reason: null,
    started_at: "2026-09-30T03:00:00Z",
    pages_total: 14,
    pages_done: 0,
    questions_total: 0,
    questions_done: 0,
    questions_needing_you: 0,
    ...extra,
  };
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/scan/review/paper-1"]}>
      <Routes>
        <Route path="/scan/review/:draftId" element={<PaperReview />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.progress = new Map();
  fixture.reviewOpen = false;
  fixture.refreshLibrary.mockResolvedValue(undefined);
  fixture.resumeDraftReview.mockResolvedValue({ state: "gone" });
  fixture.ensureScan.mockResolvedValue({ resumeDraftReview: fixture.resumeDraftReview });
});

test("a live retry run without a local draft is never rendered as gone", () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("structure", { pages_done: 3 }),
  ]]);

  mount();

  expect(screen.getByText("Finding pages and questions")).toBeTruthy();
  expect(screen.getByText("3 of 14 pages mapped")).toBeTruthy();
  expect(screen.queryByText(/couldn.t find this paper/i)).toBeNull();
  expect(fixture.resumeDraftReview).not.toHaveBeenCalled();
});

test("processing view names the current work and uses real question counts", () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("content", {
      pages_done: 14,
      questions_total: 12,
      questions_done: 5,
    }),
  ]]);

  mount();

  expect(screen.getAllByText("Reading answers and teacher marks").length).toBeGreaterThan(0);
  expect(screen.getByText("5 of 12 questions read")).toBeTruthy();
  expect(screen.getByText("Checking this is a marked paper")).toBeTruthy();
  expect(screen.getByText("Checking totals and uncertain marks")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to Library" })).toBeTruthy();
});

test("server progress reaching reviewable state re-enters review without a local draft", async () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("needs_review", {
      pages_done: 14,
      questions_total: 12,
      questions_done: 12,
      questions_needing_you: 2,
    }),
  ]]);
  fixture.resumeDraftReview.mockResolvedValue({ state: "reviewing" });

  mount();

  await waitFor(() => expect(fixture.resumeDraftReview).toHaveBeenCalledWith("paper-1"));
  expect(await screen.findByText("Opening review…")).toBeTruthy();
  expect(screen.queryByText(/couldn.t find this paper/i)).toBeNull();
});

test("truly missing paper still reports a missing review instead of pretending to process", async () => {
  fixture.progress = new Map();
  fixture.resumeDraftReview.mockResolvedValue({ state: "gone" });

  mount();

  expect(await screen.findByText(/We couldn.t find this paper to review/)).toBeTruthy();
});
