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

const mocks = vi.hoisted(() => ({ papers: vi.fn(), progress: vi.fn(), consent: vi.fn(), session: vi.fn(), analytics: vi.fn() }));
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
  takeProviderError: () => null, onAuthChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  readLocal: () => ({ theme: "dark", text_size: "m", reduce_motion: true }), loadPrefs: async () => ({ theme: "dark" }), savePrefs: vi.fn(),
  readConsentState: mocks.consent, recordConsent: vi.fn(), withdrawConsent: vi.fn(), signOut: vi.fn(),
  listPapers: mocks.papers, paperProgress: mocks.progress, watchLibrary: () => () => {},
  analyticsReadiness: mocks.analytics, lossByCause: async () => ({ data: {} }), needsCheck: async () => ({ data: { count: 0, papers: 0 } }), unreadablePages: async () => ({ data: [] }),
  paperTypeLabel: () => "Test paper", statusKeyForRun: () => "reading", PAPER_STATUS: { reading: { label: "Reading", tone: "wait" } },
  retryFailedPaper: vi.fn(),
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
test("failed progress refresh labels retained status and disables recovery", async () => {
  mocks.papers.mockResolvedValue({ data: [{ id: "p", date_taken: "2026-01-01" }] }); mocks.progress.mockResolvedValue(new Map([["p", { status: "reading" }]])); mount(<Library />);
  await screen.findByText("Reading"); mocks.progress.mockRejectedValue(new Error("offline")); await userEvent.click(screen.getByText("Refresh"));
  expect(await screen.findByText(/Last-known paper status/)).toBeTruthy(); expect(screen.getByRole("button", { name: /Test paper/ }).hasAttribute("disabled")).toBe(true);
});
test("consent failures remain failures", async () => { mocks.consent.mockRejectedValue(new Error("offline")); mount(null); expect(await screen.findByText("consent:failed")).toBeTruthy(); });
test("auth read error enters boot error", async () => { mocks.session.mockRejectedValue(new Error("auth unavailable")); mount(null); expect(await screen.findByText("boot_error")).toBeTruthy(); });
test("Insights shows failed reads instead of an indefinite blank", async () => { mocks.analytics.mockRejectedValue(new Error("offline")); mount(<Insights />); expect(await screen.findByText("Can’t reach your analysis")).toBeTruthy(); });
test("cached analytics carries an explicit label", async () => { mocks.analytics.mockResolvedValue({ data: { papers_counted: 1, questions_counted: 2, has_enough_data: false }, stale: true }); mount(<Insights />); expect(await screen.findByText("Last available analysis.")).toBeTruthy(); });
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
