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
  session: vi.fn(),
  guardian: vi.fn(),
  loadProfiles: vi.fn(),
  scopeState: vi.fn(),
  setScope: vi.fn(),
  clearScope: vi.fn(),
  purge: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../src/ui/data/profiles", () => ({
  loadProfiles: fixture.loadProfiles,
}));

vi.mock("../../src/cache.js", () => ({
  getCached: async () => null,
  clearStudentLocalData: fixture.purge,
}));

vi.mock("../../src/ui/data/modules", () => ({
  sb: {
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  },
  currentSession: fixture.session,
  currentGuardian: fixture.guardian,
  studentScopeState: fixture.scopeState,
  setStudentScope: fixture.setScope,
  clearStudentScope: fixture.clearScope,
  signOut: fixture.signOut,
  takeProviderError: () => null,
  onAuthChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  readLocal: () => ({ ...basePrefs }),
  loadPrefs: async () => ({ ...basePrefs }),
  savePrefs: async () => ({ ...basePrefs }),
  readConsentState: async () => ({}),
  recordConsent: vi.fn(),
  withdrawConsent: vi.fn(),
  listPapers: async () => ({ data: [], stale: false }),
  paperProgress: async () => new Map(),
  watchLibrary: () => () => {},
}));

const A = { id: "student-a", first_name: "A", board: "CAIE", class_level: 11 };
const B = { id: "student-b", first_name: "B", board: "CAIE", class_level: 12 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function Probe() {
  const app = useApp();
  return <>
    <span data-testid="gate">{app.gate}</span>
    <span data-testid="student">{app.student?.id ?? "none"}</span>
    <button onClick={() => void app.selectStudent("student-b").catch(() => {})}>Switch B</button>
  </>;
}

function mount() {
  return render(<MemoryRouter><AppProvider><Probe /></AppProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
  fixture.session.mockResolvedValue({ user: { id: "guardian-user" } });
  fixture.guardian.mockResolvedValue({ id: "guardian", name: "Parent", contact: "parent@example.test" });
  fixture.loadProfiles.mockResolvedValue({ data: [A, B], stale: false });
  fixture.scopeState.mockResolvedValue({
    active: true, student_id: A.id, remaining_seconds: 1200,
  });
  fixture.setScope.mockImplementation(async (studentId: string) => ({
    active: true, student_id: studentId, remaining_seconds: 1800,
  }));
  fixture.clearScope.mockResolvedValue(true);
  fixture.purge.mockResolvedValue(undefined);
  fixture.signOut.mockResolvedValue(undefined);
});

test("boot trusts live server scope instead of a different remembered sibling", async () => {
  localStorage.setItem("axon.active_student_id:guardian", B.id);

  mount();

  expect(await screen.findByText(A.id)).toBeTruthy();
  expect(screen.getByTestId("gate").textContent).toBe("ready");
  expect(fixture.purge).toHaveBeenCalledWith(B.id);
  expect(localStorage.getItem("axon.active_student_id:guardian")).toBe(A.id);
});

test("multi-profile boot with no server scope refuses to adopt localStorage", async () => {
  localStorage.setItem("axon.active_student_id:guardian", B.id);
  fixture.scopeState.mockResolvedValue({
    active: false, student_id: null, remaining_seconds: 0, reason: "no_active_scope",
  });

  mount();

  await waitFor(() => expect(screen.getByTestId("gate").textContent).toBe("choose_profile"));
  expect(screen.getByTestId("student").textContent).toBe("none");
  expect(fixture.setScope).not.toHaveBeenCalled();
  expect(fixture.purge).toHaveBeenCalledWith(B.id);
});

test("single-profile boot establishes its only server scope automatically", async () => {
  fixture.loadProfiles.mockResolvedValue({ data: [A], stale: false });
  fixture.scopeState.mockResolvedValue({
    active: false, student_id: null, remaining_seconds: 0,
  });

  mount();

  expect(await screen.findByText(A.id)).toBeTruthy();
  expect(fixture.setScope).toHaveBeenCalledWith(A.id);
  expect(screen.getByTestId("gate").textContent).toBe("ready");
});

test("switch does not expose incoming sibling until server scope and outgoing purge both finish", async () => {
  const scope = deferred<{ active: boolean; student_id: string; remaining_seconds: number }>();
  const purge = deferred<void>();
  fixture.setScope.mockImplementation((studentId: string) => (
    studentId === B.id ? scope.promise : Promise.resolve({
      active: true, student_id: studentId, remaining_seconds: 1800,
    })
  ));
  fixture.purge.mockReturnValue(purge.promise);

  mount();
  await screen.findByText(A.id);

  await userEvent.click(screen.getByRole("button", { name: "Switch B" }));
  expect(screen.getByTestId("gate").textContent).toBe("loading");
  expect(screen.getByTestId("student").textContent).toBe("none");
  expect(fixture.purge).not.toHaveBeenCalled();

  await act(async () => scope.resolve({
    active: true, student_id: B.id, remaining_seconds: 1800,
  }));
  await waitFor(() => expect(fixture.purge).toHaveBeenCalledWith(A.id));
  expect(screen.getByTestId("student").textContent).toBe("none");

  await act(async () => purge.resolve());
  expect(await screen.findByText(B.id)).toBeTruthy();
  expect(screen.getByTestId("gate").textContent).toBe("ready");
  expect(localStorage.getItem("axon.active_student_id:guardian")).toBe(B.id);
});

test("failed sibling switch restores the previous server scope and never exposes the target", async () => {
  fixture.setScope
    .mockRejectedValueOnce(Object.assign(new Error("parent required"), { hint: "parent_mode_required" }))
    .mockResolvedValueOnce({ active: true, student_id: A.id, remaining_seconds: 1800 });

  mount();
  await screen.findByText(A.id);

  await userEvent.click(screen.getByRole("button", { name: "Switch B" }));

  await waitFor(() => expect(screen.getByTestId("student").textContent).toBe(A.id));
  expect(screen.queryByText(B.id)).toBeNull();
  expect(fixture.purge).not.toHaveBeenCalled();
  expect(fixture.setScope.mock.calls.map(([id]) => id)).toEqual([B.id, A.id]);
  expect(localStorage.getItem("axon.active_student_id:guardian")).not.toBe(B.id);
});

test("multi-profile offline boot never chooses a remembered sibling without server authority", async () => {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
  localStorage.setItem("axon.active_student_id:guardian", B.id);

  mount();

  await waitFor(() => expect(screen.getByTestId("gate").textContent).toBe("choose_profile"));
  expect(screen.getByTestId("student").textContent).toBe("none");
  expect(fixture.scopeState).not.toHaveBeenCalled();
  expect(fixture.setScope).not.toHaveBeenCalled();
});
