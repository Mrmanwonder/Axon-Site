import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const fixture = vi.hoisted(() => ({ rpc: vi.fn(), finish: vi.fn() }));
vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({
    session: { user: { id: "guardian", email: "parent@example.test" } },
    providerError: null,
    finishOnboarding: fixture.finish,
  }),
}));
vi.mock("../../src/ui/data/profiles", () => ({ loadProfiles: vi.fn(), selectedProfile: vi.fn() }));
vi.mock("../../src/ui/data/modules", () => ({
  sb: { rpc: fixture.rpc, from: vi.fn() },
  sendOtp: vi.fn(), verifyOtp: vi.fn(), currentSession: vi.fn(),
  currentGuardian: async () => ({ id: "guardian", name: "Parent", contact: "parent@example.test" }),
  signInWithProvider: vi.fn(), isProviderNotEnabled: () => false,
  OAUTH_PROVIDERS: [], PROVIDER_LABEL: {}, listPurposes: vi.fn(), recordConsent: vi.fn(),
  BOARD: "CAIE", CLASS_LEVELS: [9, 10, 11, 12],
  classLabel: (level: number) => `Class ${level}`,
  stageForClass: () => ({ label: "Cambridge International AS & A Level" }),
  subjectsForClass: () => [{ subject: "Physics", code: "9702" }],
  syllabusCode: () => "9702",
  PAPER_TYPES: [], startCheckout: vi.fn(),
}));

import Onboarding from "../../src/ui/onboarding/Onboarding";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/?billing=success");
});

test("ten rapid Create Profile actions issue one atomic profile request", async () => {
  const result = deferred<{ data: { id: string; first_name: string }; error: null }>();
  fixture.rpc.mockReturnValue(result.promise);
  render(<MemoryRouter initialEntries={["/?billing=success"]}><Onboarding /></MemoryRouter>);

  await screen.findByRole("heading", { name: "The student" });
  await userEvent.type(screen.getByLabelText("First name"), "Sam");
  await userEvent.click(screen.getByRole("button", { name: /Physics/ }));
  const create = screen.getByRole("button", { name: "Create profile" });
  for (let tap = 0; tap < 10; tap += 1) fireEvent.click(create);

  await waitFor(() => expect(fixture.rpc).toHaveBeenCalledTimes(1));
  expect((create as HTMLButtonElement).disabled).toBe(true);
  expect(fixture.rpc).toHaveBeenCalledWith("create_student_profile", expect.objectContaining({
    p_first_name: "Sam",
    p_subjects: [{ subject: "Physics", syllabus_code: "9702" }],
  }));

  await act(async () => result.resolve({ data: { id: "student", first_name: "Sam" }, error: null }));
  await screen.findByRole("heading", { name: /Hello, Sam/ });
});
