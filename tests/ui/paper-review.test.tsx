import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaperReview from "../../src/ui/pages/PaperReview";

const fixture = vi.hoisted(() => ({
  progress: new Map<string, any>(),
  refreshLibrary: vi.fn(),
  resumeDraftReview: vi.fn(),
  ensureScan: vi.fn(),
  reviewOpen: false,
  fetchedAt: 1,
  retryAsMarked: vi.fn(),
  sends: [] as any[],
  retrySend: vi.fn(),
}));

vi.mock("../../src/ui/data/modules", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  retryAsMarked: fixture.retryAsMarked,
}));

vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({
    student: { id: "student-1" },
    progressResource: {
      state: "ready",
      data: fixture.progress,
      source: "live",
      fetchedAt: fixture.fetchedAt,
    },
    refreshLibrary: fixture.refreshLibrary,
  }),
}));

vi.mock("../../src/ui/scan/ScanProvider", () => ({
  useScan: () => ({
    ensureScan: fixture.ensureScan,
    reviewOpen: fixture.reviewOpen,
    sends: fixture.sends,
    retrySend: fixture.retrySend,
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
  fixture.fetchedAt = 1;
  fixture.sends = [];
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

  expect(screen.getAllByText("Finding the questions").length).toBeGreaterThan(0);
  expect(screen.getByText("3 of 14 pages mapped")).toBeTruthy();
  expect(screen.queryByText(/couldn.t find this paper/i)).toBeNull();
  expect(fixture.resumeDraftReview).not.toHaveBeenCalled();
});

test("processing view names the current work and counts parts as parts and questions as questions", () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("content", {
      pages_done: 14,
      questions_total: 5,
      parts_total: 12,
      questions_done: 5,
    }),
  ]]);

  mount();

  expect(screen.getAllByText("Reading the answers and the marking").length).toBeGreaterThan(0);
  expect(screen.getByText("5 of 12 parts read")).toBeTruthy();
  expect(screen.getByText("Sending the pages")).toBeTruthy();
  expect(screen.getByText("Checking the marks add up")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Back to Library" })).toBeTruthy();
});

test("checking copy names questions and parts separately, and falls back to parts alone", () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("reconciliation", { pages_done: 14, questions_total: 5, parts_total: 12, questions_done: 12 }),
  ]]);
  const view = mount();
  expect(screen.getByText("5 questions (12 parts) being checked together")).toBeTruthy();
  view.unmount();

  fixture.progress = new Map([[
    "paper-1",
    progress("reconciliation", { pages_done: 14, questions_total: 0, parts_total: 1, questions_done: 1 }),
  ]]);
  mount();
  expect(screen.getByText("1 part being checked together")).toBeTruthy();
});

test("processing state hands off to review when a fresh progress read becomes reviewable", async () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("content", {
      pages_done: 14,
      questions_total: 5,
      parts_total: 12,
      questions_done: 5,
    }),
  ]]);
  fixture.resumeDraftReview.mockResolvedValue({ state: "reviewing" });

  const view = mount();
  expect(screen.getByText("5 of 12 parts read")).toBeTruthy();
  expect(fixture.resumeDraftReview).not.toHaveBeenCalled();

  fixture.progress = new Map([[
    "paper-1",
    progress("needs_review", {
      pages_done: 14,
      questions_total: 12,
      questions_done: 12,
      questions_needing_you: 2,
    }),
  ]]);
  fixture.fetchedAt = 2;
  view.rerender(
    <MemoryRouter initialEntries={["/scan/review/paper-1"]}>
      <Routes>
        <Route path="/scan/review/:draftId" element={<PaperReview />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => expect(fixture.resumeDraftReview).toHaveBeenCalledWith("paper-1", undefined));
  expect(await screen.findByText("Saving your paper…")).toBeTruthy();
  expect(screen.queryByText("Preparing the parts that need your eyes")).toBeNull();
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

  await waitFor(() => expect(fixture.resumeDraftReview).toHaveBeenCalledWith("paper-1", undefined));
  expect(await screen.findByText("Saving your paper…")).toBeTruthy();
  expect(screen.queryByText("Preparing the parts that need your eyes")).toBeNull();
  expect(screen.queryByText(/couldn.t find this paper/i)).toBeNull();
});

test("a hanging review start becomes a retry state instead of an infinite skeleton", async () => {
  vi.useFakeTimers();
  try {
    fixture.progress = new Map([[
      "paper-1",
      progress("needs_review", {
        pages_done: 14,
        questions_total: 12,
        questions_done: 12,
        questions_needing_you: 12,
      }),
    ]]);
    fixture.ensureScan.mockReturnValue(new Promise(() => {}));

    mount();

    expect(screen.getByText("Saving your paper…")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(10_001);
      await Promise.resolve();
    });

    expect(screen.getByText("Axon found 12 parts that need your eyes, but the review could not open.")).toBeTruthy();
    expect(screen.getByText("The review is taking too long to start. Try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

test("review-opening errors are visible instead of being hidden by the processing screen", async () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("needs_review", {
      pages_done: 14,
      questions_total: 12,
      questions_done: 12,
      questions_needing_you: 12,
    }),
  ]]);
  fixture.ensureScan.mockRejectedValue(new Error("Review data unavailable"));

  mount();

  expect(await screen.findByText("Axon found 12 parts that need your eyes, but the review could not open.")).toBeTruthy();
  expect(screen.getByText("Review data unavailable")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.queryByText("Preparing the parts that need your eyes")).toBeNull();
});

test("truly missing paper still reports a missing review instead of pretending to process", async () => {
  fixture.progress = new Map();
  fixture.resumeDraftReview.mockResolvedValue({ state: "gone" });

  mount();

  expect(await screen.findByText(/We couldn.t find this paper to review/)).toBeTruthy();
});


test("a paper refused as unmarked can be read again on the student's word", async () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("rejected", { status_reason: "This paper has your answers but no marking on it yet. Scan it once your teacher has marked it." }),
  ]]);
  fixture.retryAsMarked.mockResolvedValue({ retry: "started", queued: true });
  mount();
  const button = await screen.findByRole("button", { name: "It is marked. Read it again" });
  await act(async () => { button.click(); });
  expect(fixture.retryAsMarked).toHaveBeenCalledWith("paper-1");
  expect(await screen.findByText(/Reading it again/)).toBeTruthy();
});

test("other refusals do not offer to read again as marked", async () => {
  fixture.progress = new Map([[
    "paper-1",
    progress("rejected", { status_reason: "This looks like a question paper with no answers written on it." }),
  ]]);
  mount();
  await screen.findByText(/no answers written on it/);
  expect(screen.queryByRole("button", { name: "It is marked. Read it again" })).toBeNull();
});

test("a paper still sending from this phone shows its own pages, never 'not found'", () => {
  fixture.sends = [{
    id: "draft-1", paperId: "paper-1", runId: null, title: "Past paper", phase: "waiting", stage: "upload",
    message: "No connection. Sending carries on by itself when you are back online.",
    pages: [{ n: 1, thumb: null, sent: true }, { n: 2, thumb: null, sent: false }],
    steps: [{ label: "Sending the pages", state: "now" }],
  }];
  mount();
  expect(screen.getByText("Sending your paper")).toBeTruthy();
  expect(screen.getByText("1 of 2 pages safely sent")).toBeTruthy();
  expect(screen.getByText(/No connection/)).toBeTruthy();
  expect(screen.queryByText(/couldn.t find this paper/i)).toBeNull();
  expect(screen.queryByText(/did not finish/i)).toBeNull();
});

test("a read paper saves on its own and hands over to the paper (AXO-216)", async () => {
  fixture.progress = new Map([["paper-1", progress("ready", { questions_needing_you: 3 })]]);
  fixture.resumeDraftReview.mockResolvedValue({ state: "saving", paperId: "paper-1" });
  render(
    <MemoryRouter initialEntries={["/scan/review/paper-1"]}>
      <Routes>
        <Route path="/scan/review/:draftId" element={<PaperReview />} />
        <Route path="/library/:paperId" element={<div>The paper</div>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText("The paper")).toBeTruthy();
  expect(screen.queryByText(/need your eyes/)).toBeNull();
});

test("a refused save shows the real reason and offers Check the reading", async () => {
  fixture.progress = new Map([["paper-1", progress("ready")]]);
  fixture.resumeDraftReview.mockResolvedValue({
    state: "save_failed", paperId: "paper-1",
    reason: "Your paper did not finish saving. Two parts of this paper are both read as 3(c), so Axon cannot tell which mark belongs to which. Choose Check the reading and change the label on one of them.",
  });
  mount();
  expect(await screen.findByText(/both read as 3\(c\)/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Check the reading" }).getAttribute("href")).toBe("/scan/review/paper-1?check=1");
});

test("Check the reading asks for the whole reading, even on a saved paper", async () => {
  fixture.progress = new Map([["paper-1", progress("committed")]]);
  fixture.resumeDraftReview.mockResolvedValue({ state: "reviewing" });
  render(
    <MemoryRouter initialEntries={["/scan/review/paper-1?check=1"]}>
      <Routes>
        <Route path="/scan/review/:draftId" element={<PaperReview />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(fixture.resumeDraftReview).toHaveBeenCalledWith("paper-1", { check: true }));
  expect(screen.queryByText(/already saved/)).toBeNull();
});
