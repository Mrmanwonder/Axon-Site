import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppProvider, useApp } from "../../src/ui/data/AppProvider";

const basePrefs = {
  theme: "dark" as const,
  text_size: "m" as const,
  reduce_motion: false,
  always_show_reasoning: false,
  notify_paper_ready: true,
  notify_correction: true,
};

const fixture = vi.hoisted(() => ({
  savePrefs: vi.fn(),
  avatarWrite: vi.fn(),
  listPapers: vi.fn(),
  paperProgress: vi.fn(),
}));

vi.mock("../../src/ui/data/profiles", () => ({
  loadProfiles: async () => ({
    data: [{ id: "student", first_name: "Sam", board: "CAIE", class_level: 11, avatar_seed: "first" }],
    stale: false,
  }),
  selectedProfile: (_guardianId: string, profiles: unknown[]) => profiles[0],
}));

vi.mock("../../src/ui/data/modules", () => ({
  sb: {
    from: (table: string) => ({
      update: (patch: unknown) => ({
        eq: (column: string, id: string) => fixture.avatarWrite({ table, patch, column, id }),
      }),
    }),
  },
  currentSession: async () => ({ user: { id: "guardian" } }),
  currentGuardian: async () => ({ id: "guardian", name: "Parent", contact: "parent@example.test" }),
  studentScopeState: async () => ({ active: false, student_id: null, remaining_seconds: 0 }),
  setStudentScope: async (studentId: string) => ({ active: true, student_id: studentId, remaining_seconds: 1800 }),
  clearStudentScope: async () => true,
  takeProviderError: () => null,
  onAuthChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  readLocal: () => ({ ...basePrefs }),
  loadPrefs: async () => ({ ...basePrefs }),
  savePrefs: fixture.savePrefs,
  readConsentState: async () => ({}),
  recordConsent: vi.fn(),
  withdrawConsent: vi.fn(),
  signOut: vi.fn(),
  listPapers: (...args: unknown[]) => fixture.listPapers(...args),
  paperProgress: (...args: unknown[]) => fixture.paperProgress(...args),
  watchLibrary: () => () => {},
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const paper = (id: string) => ({ id, type: "unit_test", date_taken: "2026-09-01" });
const A = paper("paper-a"), B = paper("paper-b");

function Probe() {
  const app = useApp();
  if (app.gate !== "ready") return <span>{app.gate}</span>;
  return <>
    <span data-testid="papers">{app.papers.map(p => p.id).join(",")}</span>
    <span data-testid="progress">{[...app.progress.keys()].join(",")}</span>
    <button onClick={() => void app.refreshLibrary()}>Refresh</button>
    <button onClick={() => app.removePaperFromLibrary("paper-a")}>Remove A</button>
  </>;
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.savePrefs.mockResolvedValue({ ...basePrefs });
  fixture.listPapers.mockReset().mockResolvedValue({ data: [A, B], stale: false });
  fixture.paperProgress.mockReset().mockResolvedValue(new Map([["paper-a", { id: "paper-a" }], ["paper-b", { id: "paper-b" }]]));
});

test("a Library/progress read issued before a delete cannot resurrect the removed paper", async () => {
  render(<MemoryRouter><AppProvider><Probe /></AppProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId("papers").textContent).toBe("paper-a,paper-b"));

  // A refresh starts (as Realtime or a focus refetch would) and is still in flight...
  const latePapers = deferred<{ data: unknown[]; stale: boolean }>();
  const lateProgress = deferred<Map<string, unknown>>();
  fixture.listPapers.mockReturnValueOnce(latePapers.promise);
  fixture.paperProgress.mockReturnValueOnce(lateProgress.promise);
  const user = userEvent.setup();
  await user.click(screen.getByText("Refresh"));

  // ...then the guardian deletes paper A and it disappears optimistically.
  await user.click(screen.getByText("Remove A"));
  expect(screen.getByTestId("papers").textContent).toBe("paper-b");
  expect(screen.getByTestId("progress").textContent).toBe("paper-b");

  // The pre-delete reads now land, still containing A. A must stay gone.
  await act(async () => {
    latePapers.resolve({ data: [A, B], stale: false });
    lateProgress.resolve(new Map([["paper-a", { id: "paper-a" }], ["paper-b", { id: "paper-b" }]]));
  });
  await waitFor(() => expect(fixture.listPapers).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("papers").textContent).toBe("paper-b");
  expect(screen.getByTestId("progress").textContent).toBe("paper-b");
});
