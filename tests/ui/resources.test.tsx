import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppProvider, useApp } from "../../src/ui/data/AppProvider";
import Library from "../../src/ui/pages/Library";
import Home from "../../src/ui/pages/Home";
import Insights from "../../src/ui/pages/Insights";
import { useResource } from "../../src/ui/data/useResource";
import { ToastProvider } from "../../src/ui/components/ToastProvider";

const mocks = vi.hoisted(() => ({ papers: vi.fn(), progress: vi.fn(), consent: vi.fn(), session: vi.fn(), analytics: vi.fn(), insights: vi.fn() }));
vi.mock("../../src/ui/data/useIngestion", () => ({ useIngestion: () => ({ addPaper() {} }) }));
vi.mock("../../src/ui/data/modules", () => ({
  sb: {
    from: (table: string) => ({
      select: () => ({
        eq: () => table === "student"
          ? { order: async () => ({ data: [{ id: "student", first_name: "Sam", programme_id: null, stage_id: null }] }) }
          : Promise.resolve({ data: [{ subject: "physics" }] }),
        in: async () => ({ data: table === "student_subject"
          ? [{
              student_id: "student", subject: "physics", subject_offering_id: null,
              selected_level: null, display_name_snapshot: null, external_code_snapshot: null,
            }]
          : [] }),
      }),
    }),
  },
  currentSession: mocks.session, currentGuardian: async () => ({ id: "guardian" }),
  studentScopeState: async () => ({ active: false, student_id: null, remaining_seconds: 0 }),
  setStudentScope: async (studentId: string) => ({ active: true, student_id: studentId, remaining_seconds: 1800 }),
  clearStudentScope: async () => true,
  takeProviderError: () => null, onAuthChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  readLocal: () => ({ theme: "dark", text_size: "m", reduce_motion: true }), loadPrefs: async () => ({ theme: "dark" }), savePrefs: vi.fn(),
  readConsentState: mocks.consent, recordConsent: vi.fn(), withdrawConsent: vi.fn(), signOut: vi.fn(),
  listPapers: mocks.papers, paperProgress: mocks.progress, watchLibrary: () => () => {},
  analyticsReadiness: mocks.analytics, insightEvidence: mocks.insights, lossByCause: async () => ({ data: {} }), needsCheck: async () => ({ data: { count: 0, papers: 0 } }), unreadablePages: async () => ({ data: [] }),
  providerKeyForStudent: (s?: { provider_key?: string | null }) => s?.provider_key ?? null,
  paperTypeLabel: () => "Test paper", statusKeyForRun: () => "reading", PAPER_STATUS: { reading: { label: "Reading", tone: "wait" } },
  retryFailedPaper: vi.fn(),
  searchLibrary: vi.fn().mockResolvedValue([]),
}));
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function Status() { const app = useApp(); return <><span>{app.gate}</span><span>consent:{app.consentResource.state}</span><button onClick={() => void app.refreshLibrary()}>Refresh</button></>; }
function mount(child: React.ReactNode) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AppProvider><Status />{child}</AppProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({}); mocks.papers.mockResolvedValue({ data: [], stale: false }); mocks.progress.mockResolvedValue(new Map()); mocks.consent.mockResolvedValue({}); mocks.analytics.mockResolvedValue({ data: { papers_counted: 0, questions_counted: 0, has_enough_data: false } });
  mocks.insights.mockResolvedValue({ data: { attempts: [], losses: [] }, stale: false });
});
test("cold Library does not assert empty or a final zero before papers complete", async () => {
  const read = deferred<any>(); mocks.papers.mockReturnValue(read.promise); mount(<Library />);
  await screen.findByText("ready"); expect(screen.queryByText("Nothing here yet")).toBeNull(); expect(screen.queryByText("0 papers")).toBeNull();
  await act(async () => read.resolve({ data: [], stale: false })); expect(await screen.findByText("Nothing here yet")).toBeTruthy();
});
test("Home waits for papers even when analytics completed first", async () => {
  const read = deferred<any>(); mocks.papers.mockReturnValue(read.promise); mount(<Home />);
  await waitFor(() => expect(mocks.analytics).toHaveBeenCalled()); expect(screen.queryByText("No papers yet")).toBeNull();
  await act(async () => read.resolve({ data: [], stale: false })); expect(await screen.findByText("No papers yet")).toBeTruthy();
});
test("failed progress refresh disables recovery without surfacing sync status", async () => {
  mocks.papers.mockResolvedValue({ data: [{ id: "p", date_taken: "2026-01-01" }] }); mocks.progress.mockResolvedValue(new Map([["p", { status: "reading" }]])); mount(<Library />);
  await screen.findByText("Reading"); mocks.progress.mockRejectedValue(new Error("offline")); await userEvent.click(screen.getByText("Refresh"));
  await waitFor(() => expect(screen.getByRole("button", { name: /Test paper/ }).hasAttribute("disabled")).toBe(true));
  expect(screen.queryByText(/Last-known paper status/)).toBeNull();
});
test("consent failures remain failures", async () => { mocks.consent.mockRejectedValue(new Error("offline")); mount(null); expect(await screen.findByText("consent:failed")).toBeTruthy(); });
test("auth read error enters boot error", async () => { mocks.session.mockRejectedValue(new Error("auth unavailable")); mount(null); expect(await screen.findByText("boot_error")).toBeTruthy(); });
test("Insights shows failed reads instead of an indefinite blank", async () => { mocks.insights.mockRejectedValue(new Error("offline")); mount(<Insights />); expect(await screen.findByText("Can’t reach your analysis")).toBeTruthy(); });
test("cached analytics carries an explicit label", async () => { mocks.insights.mockResolvedValue({ data: { attempts: [], losses: [] }, stale: true }); mount(<Insights />); expect(await screen.findByText("Last available analysis.")).toBeTruthy(); });
test("reversed completion cannot replace a newer resource and changing student hides old data", async () => {
  const first = deferred<any>(); const second = deferred<any>(); const read = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValue(new Promise(() => {}));
  function Probe({ id }: { id: string }) { const { resource, reload } = useResource(id, read); return <><span>{resource.data ?? resource.state}</span><button onClick={() => void reload()}>Reload</button></>; }
  const view = render(<Probe id="one" />); await userEvent.click(screen.getByText("Reload"));
  await act(async () => second.resolve({ data: "newer" })); await act(async () => first.resolve({ data: "older" })); expect(screen.queryByText("older")).toBeNull(); expect(screen.getByText("newer")).toBeTruthy();
  view.rerender(<Probe id="two" />); expect(screen.queryByText("newer")).toBeNull(); expect(screen.getByText("loading")).toBeTruthy();
});

test("cached papers paint during refresh without claiming live success", async () => {
  const network = deferred<any>();
  function Probe() {
    const { resource } = useResource("student", () => network.promise, async () => "cached paper");
    return <span>{resource.state}:{resource.data}</span>;
  }
  render(<Probe />);
  expect(await screen.findByText("loading:cached paper")).toBeTruthy();
  await act(async () => network.resolve({ data: "live paper" }));
  expect(screen.getByText("ready:live paper")).toBeTruthy();
});

test("slow cache completion cannot replace the live result", async () => {
  const cache = deferred<string>();
  function Probe() {
    const { resource } = useResource("student", async () => ({ data: "live paper" }), () => cache.promise);
    return <span>{resource.state}:{resource.data}</span>;
  }
  render(<Probe />);
  await screen.findByText("ready:live paper");
  await act(async () => cache.resolve("older paper"));
  expect(screen.getByText("ready:live paper")).toBeTruthy();
  expect(screen.queryByText(/older paper/)).toBeNull();
});
/** n papers in one subject, each losing two marks to the same cause, with the student's own fix. */
function evidence(n: number) {
  const papers = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, type: "unit_test", tier: "tier_1", date_taken: `2026-0${i + 1}-10`, subject: "Physics" }));
  const attempts = papers.map((p, i) => ({ id: `a${i}`, paper_id: p.id, question_label: `Q${i + 1}`, max_marks: 4, marks_awarded: 2, question_order: 0, answer_blank: false }));
  const losses = attempts.map((a, i) => ({
    id: `l${i}`, attempt_id: a.id, cause: "keyword_miss", marks_lost: 2, do_this_next: `Name the law in sentence one (${i + 1})`,
    command_word: "Explain", concepts: ["Newton's second law"], loss_reasons: null, depends_on_parts: null, created_at: "2026-09-01T00:00:00Z",
  }));
  return { papers, attempts, losses };
}

test("Coverage shows while evidence builds and disappears once patterns are ready", async () => {
  const few = evidence(2);
  mocks.papers.mockResolvedValue({ data: few.papers, stale: false });
  mocks.insights.mockResolvedValue({ data: { attempts: few.attempts, losses: few.losses }, stale: false });
  const first = mount(<Insights />);
  expect(await screen.findByText("Coverage")).toBeTruthy();
  expect(screen.queryByText("Mistakes that repeat")).toBeNull();
  first.unmount();
  const enough = evidence(5);
  mocks.papers.mockResolvedValue({ data: enough.papers, stale: false });
  mocks.insights.mockResolvedValue({ data: { attempts: enough.attempts, losses: enough.losses }, stale: false });
  mount(<Insights />);
  await screen.findByText("Where your marks go");
  expect(screen.queryByText("Coverage")).toBeNull();
  expect(screen.queryByText(/of 4 papers/)).toBeNull();
  // The checklist quotes the most recent fix, and links to the question it came from.
  expect(screen.getByText("Name the law in sentence one (5)")).toBeTruthy();
  expect(screen.getByText(/In 3 of your last 3 papers/)).toBeTruthy();
  expect(screen.getByText(/10 of 10 explained marks were lost where the knowledge was there/)).toBeTruthy();
});

test("Home names a focus only when a mistake repeats inside enough evidence", async () => {
  const few = evidence(3);
  mocks.papers.mockResolvedValue({ data: few.papers, stale: false });
  mocks.insights.mockResolvedValue({ data: { attempts: few.attempts, losses: few.losses }, stale: false });
  const first = mount(<Home />);
  await screen.findByText("Recent scans");
  await waitFor(() => expect(mocks.insights).toHaveBeenCalled());
  expect(screen.queryByText("Before your next paper")).toBeNull();
  first.unmount();
  const enough = evidence(4);
  mocks.papers.mockResolvedValue({ data: enough.papers, stale: false });
  mocks.insights.mockResolvedValue({ data: { attempts: enough.attempts, losses: enough.losses }, stale: false });
  mount(<Home />);
  expect(await screen.findByText("Before your next paper")).toBeTruthy();
  expect(screen.getByText("Name the law in sentence one (4)")).toBeTruthy();
});
