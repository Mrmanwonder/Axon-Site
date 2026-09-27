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
  listPapers: async () => ({ data: [], stale: false }),
  paperProgress: async () => new Map(),
  watchLibrary: () => () => {},
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function Controls() {
  const app = useApp();
  if (app.gate !== "ready") return <span>{app.gate}</span>;
  return <>
    <span data-testid="prefs">{`${app.prefs.reduce_motion}:${app.prefs.text_size}`}</span>
    <span data-testid="avatar">{app.student?.avatar_seed}</span>
    <button onClick={() => void app.setPref({ reduce_motion: true })}>Reduce Motion</button>
    <button onClick={() => void app.setPref({ text_size: "l" })}>Text Size L</button>
    <button onClick={() => void app.setAvatar("second")}>Second avatar</button>
    <button onClick={() => void app.setAvatar("third")}>Third avatar</button>
  </>;
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.savePrefs.mockResolvedValue({ ...basePrefs });
  fixture.avatarWrite.mockResolvedValue({ error: null });
});

test("rapid preference changes stay optimistic and are committed in order", async () => {
  const first = deferred<typeof basePrefs>();
  fixture.savePrefs
    .mockReset()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ ...basePrefs, reduce_motion: true, text_size: "l" });
  render(<MemoryRouter><AppProvider><Controls /></AppProvider></MemoryRouter>);
  await screen.findByText("Reduce Motion");

  const user = userEvent.setup();
  await user.click(screen.getByText("Reduce Motion"));
  await user.click(screen.getByText("Text Size L"));
  expect(screen.getByTestId("prefs").textContent).toBe("true:l");
  await waitFor(() => expect(fixture.savePrefs).toHaveBeenCalledTimes(1));

  await act(async () => first.resolve({ ...basePrefs, reduce_motion: true }));
  await waitFor(() => expect(fixture.savePrefs).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByTestId("prefs").textContent).toBe("true:l"));
  expect(fixture.savePrefs.mock.calls).toEqual([
    ["guardian", { reduce_motion: true }],
    ["guardian", { text_size: "l" }],
  ]);
});

test("rapid avatar changes cannot let an older write replace the newest choice", async () => {
  const first = deferred<{ error: null }>();
  fixture.avatarWrite
    .mockReset()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ error: null });
  render(<MemoryRouter><AppProvider><Controls /></AppProvider></MemoryRouter>);
  await screen.findByText("Second avatar");

  const user = userEvent.setup();
  await user.click(screen.getByText("Second avatar"));
  await user.click(screen.getByText("Third avatar"));
  expect(screen.getByTestId("avatar").textContent).toBe("third");
  await waitFor(() => expect(fixture.avatarWrite).toHaveBeenCalledTimes(1));

  await act(async () => first.resolve({ error: null }));
  await waitFor(() => expect(fixture.avatarWrite).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("avatar").textContent).toBe("third");
  expect(fixture.avatarWrite.mock.calls.map(([call]) => call.patch)).toEqual([
    { avatar_seed: "second" },
    { avatar_seed: "third" },
  ]);
});
