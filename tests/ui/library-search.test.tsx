import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Library from "../../src/ui/pages/Library";
import { ToastProvider } from "../../src/ui/components/ToastProvider";

const fixture = vi.hoisted(() => ({
  search: vi.fn(),
  refresh: vi.fn(),
  papers: [] as any[],
}));

vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({
    papers: fixture.papers,
    papersError: null,
    papersResource: {
      state: "ready",
      data: fixture.papers,
      source: "live",
      fetchedAt: Date.now(),
    },
    progressResource: {
      state: "ready",
      data: new Map(),
      source: "live",
      fetchedAt: Date.now(),
    },
    refreshLibrary: fixture.refresh,
  }),
}));

vi.mock("../../src/ui/data/modules", () => ({
  paperTypeLabel: (type: string) => type === "unit_test" ? "Class test" : type === "mid_term" ? "Mid-term" : "End-of-year exam",
  retryFailedPaper: vi.fn(),
  searchLibrary: fixture.search,
}));

vi.mock("../../src/ui/data/paperPresentation", () => ({
  paperPresentation: (paper: { id: string }) => ({
    destination: `/paper/${paper.id}`,
    canOpen: true,
    canRetry: false,
    statusLabel: null,
    tone: null,
    reason: null,
  }),
}));

function paper(overrides: Record<string, unknown>) {
  return {
    id: "paper",
    type: "unit_test",
    tier: "tier_1",
    date_taken: "2026-09-01",
    subject: null,
    subject_offering_id: null,
    subject_display_snapshot: null,
    subject_external_code_snapshot: null,
    subject_identity_source: null,
    subject_identity_confidence: null,
    subject_verified_at: null,
    paper_page: [{ count: 1 }],
    student_attempt: [{ count: 1 }],
    total_awarded: 2,
    total_available: 3,
    ...overrides,
  };
}

function mount() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Library />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const verifiedHit = {
  paper_id: "verified",
  rank: 12,
  match_kind: "subject",
  subject_state: "verified",
  suggested_subject: null,
  suggested_confidence: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  fixture.papers = [
    paper({
      id: "verified",
      subject_offering_id: "off-physics",
      subject_display_snapshot: "Physics",
      subject_external_code_snapshot: "042",
      subject_identity_source: "assessment_identity",
      subject_identity_confidence: "verified",
      subject_verified_at: "2026-09-01T00:00:00Z",
    }),
    paper({ id: "unknown", type: "mid_term" }),
    paper({ id: "suggested", type: "final_exam", subject: "Mathematics" }),
  ];
  fixture.search.mockResolvedValue([]);
  fixture.refresh.mockResolvedValue(undefined);
});

test("answer-only server match controls the visible result identity set", async () => {
  fixture.search.mockResolvedValue([
    {
      paper_id: "unknown",
      rank: 0.7,
      match_kind: "question_or_answer",
      subject_state: "unknown",
      suggested_subject: null,
      suggested_confidence: null,
    },
  ]);

  mount();
  await userEvent.type(screen.getByRole("searchbox", { name: "Search library" }), "private answer phrase");

  await waitFor(() => expect(fixture.search).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("Subject unknown · Mid-term")).toBeTruthy());
  expect(screen.queryByText("Physics · Class test")).toBeNull();
  expect(screen.queryByText("Suggested: Mathematics · End-of-year exam")).toBeNull();

  expect(fixture.search).toHaveBeenLastCalledWith(expect.objectContaining({
    query: "private answer phrase",
    subjectOfferingId: null,
    subjectState: "all",
  }));
});

test("verified subject filter sends the canonical offering id to private search", async () => {
  fixture.search.mockResolvedValue([
    {
      paper_id: "verified",
      rank: 12,
      match_kind: "subject",
      subject_state: "verified",
      suggested_subject: null,
      suggested_confidence: null,
    },
  ]);

  mount();
  await userEvent.click(screen.getByRole("button", { name: "Filter by subject" }));
  await userEvent.click(screen.getByRole("option", { name: "Physics · 042" }));
  await userEvent.type(screen.getByRole("searchbox", { name: "Search library" }), "force");

  await waitFor(() => expect(fixture.search).toHaveBeenCalled());
  expect(fixture.search).toHaveBeenLastCalledWith(expect.objectContaining({
    query: "force",
    subjectOfferingId: "off-physics",
    subjectState: "all",
  }));
  expect(await screen.findByText("Physics · Class test")).toBeTruthy();
});

test("unverified legacy subject is visibly suggested and missing identity stays unknown", () => {
  mount();

  expect(screen.getByText("Physics · Class test")).toBeTruthy();
  expect(screen.getByText("Suggested: Mathematics · End-of-year exam")).toBeTruthy();
  expect(screen.getByText("Subject unknown · Mid-term")).toBeTruthy();
});


test("private search input is inside an explicit PostHog no-capture boundary", () => {
  mount();

  const input = screen.getByRole("searchbox", { name: "Search library" });
  const boundary = input.closest(".ph-no-capture");
  expect(boundary).toBeTruthy();
  expect(boundary?.getAttribute("data-private-academic-search")).toBe("true");
});


test("last good matches remain visible while a newer search is loading", async () => {
  const next = deferred<any[]>();
  fixture.search.mockResolvedValueOnce([verifiedHit]).mockImplementationOnce(() => next.promise);

  mount();
  const input = screen.getByRole("searchbox", { name: "Search library" });
  await userEvent.type(input, "force");

  expect(await screen.findByText("Physics · Class test")).toBeTruthy();
  await userEvent.type(input, "x");

  expect(await screen.findByText("Searching…")).toBeTruthy();
  expect(screen.getByText("Physics · Class test")).toBeTruthy();
  expect(screen.queryByText("No matching papers")).toBeNull();

  await next.resolve([
    {
      paper_id: "unknown",
      rank: 0.7,
      match_kind: "question_or_answer",
      subject_state: "unknown",
      suggested_subject: null,
      suggested_confidence: null,
    },
  ]);

  expect(await screen.findByText("Subject unknown · Mid-term")).toBeTruthy();
  expect(screen.queryByText("Physics · Class test")).toBeNull();
});

test("failed refresh retains last good matches and offers retry", async () => {
  fixture.search
    .mockResolvedValueOnce([verifiedHit])
    .mockRejectedValueOnce(new Error("private index offline"))
    .mockResolvedValueOnce([verifiedHit]);

  mount();
  const input = screen.getByRole("searchbox", { name: "Search library" });
  await userEvent.type(input, "force");
  expect(await screen.findByText("Physics · Class test")).toBeTruthy();

  await userEvent.type(input, "x");

  expect(await screen.findByText(/Last available matches/)).toBeTruthy();
  expect(screen.getByText("Physics · Class test")).toBeTruthy();
  expect(screen.queryByText("No matching papers")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(fixture.search).toHaveBeenCalledTimes(3));
  expect(await screen.findByText("Physics · Class test")).toBeTruthy();
});

test("no-results state appears only after a successful empty search", async () => {
  const pending = deferred<any[]>();
  fixture.search.mockImplementationOnce(() => pending.promise);

  mount();
  await userEvent.type(screen.getByRole("searchbox", { name: "Search library" }), "definitely absent");

  expect(await screen.findByText("Searching…")).toBeTruthy();
  expect(screen.queryByText("No matching papers")).toBeNull();

  await pending.resolve([]);
  expect(await screen.findByText("No matching papers")).toBeTruthy();
  expect(screen.getByText("Try changing the search or one of the filters.")).toBeTruthy();
});
