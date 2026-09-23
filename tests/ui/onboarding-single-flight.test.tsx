import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const fixture = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  finish: vi.fn(),
  loadProfiles: vi.fn(),
  currentSession: vi.fn(),
  listPurposes: vi.fn(),
  recordConsent: vi.fn(),
  parentGuard: vi.fn((action: () => void | Promise<void>) => action()),
}));
vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({
    session: { user: { id: "guardian", email: "parent@example.test" } },
    providerError: null,
    finishOnboarding: fixture.finish,
  }),
}));
vi.mock("../../src/ui/data/profiles", () => ({
  loadProfiles: fixture.loadProfiles,
  selectedProfile: vi.fn(),
}));
vi.mock("../../src/ui/data/useParentMode", () => ({
  useParentMode: () => ({ guard: fixture.parentGuard }),
}));
vi.mock("../../src/ui/data/modules", () => ({
  sb: { rpc: fixture.rpc, from: fixture.from },
  sendOtp: vi.fn(), verifyOtp: vi.fn(), currentSession: fixture.currentSession,
  currentGuardian: async () => ({ id: "guardian", name: "Parent", contact: "parent@example.test" }),
  signInWithProvider: vi.fn(), isProviderNotEnabled: () => false,
  OAUTH_PROVIDERS: [], PROVIDER_LABEL: {},
  listPurposes: fixture.listPurposes, recordConsent: fixture.recordConsent,
  PAPER_TYPES: [], startCheckout: vi.fn(),
  CURRICULUM_PROVIDERS: [{ key: "cambridge", label: "Cambridge" }],
  CURRICULUM_PROGRAMMES: {
    cambridge: [{ key: "cambridge_as", label: "Cambridge International AS Level" }],
  },
  CURRICULUM_STAGE_OPTIONS: {
    cambridge_as: [{ key: "cambridge_as", label: "AS Level · Year 12" }],
  },
  getSubjectOfferings: vi.fn(async () => [{
    id: "offering-physics",
    displayName: "Physics",
    externalCode: "9702",
    externalCodeKind: "syllabus_code",
    levelsSupported: [],
    languageCode: null,
    variant: null,
    aliases: [],
    group: null,
  }]),
  filterSubjectOfferings: (offerings: unknown[]) => offerings,
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
  await userEvent.click(screen.getByRole("button", { name: /Add subjects/ }));
  await userEvent.click(await screen.findByRole("button", { name: /Physics/ }));
  const create = screen.getByRole("button", { name: "Create profile" });
  for (let tap = 0; tap < 10; tap += 1) fireEvent.click(create);

  await waitFor(() => expect(fixture.rpc).toHaveBeenCalledTimes(1));
  expect((create as HTMLButtonElement).disabled).toBe(true);
  expect(fixture.rpc).toHaveBeenCalledWith("create_student_profile_v2", expect.objectContaining({
    p_first_name: "Sam",
    p_programme_key: "cambridge_as",
    p_stage_key: "cambridge_as",
    p_avatar_key: "dreamBloom",
    p_subjects: [{ offering_id: "offering-physics", level: null }],
  }));

  await act(async () => result.resolve({ data: { id: "student", first_name: "Sam" }, error: null }));
  await screen.findByRole("heading", { name: /Hello, Sam/ });
});


test("consent stays opt-in and is submitted through Parent Mode", async () => {
  window.history.replaceState({}, "", "/");
  fixture.currentSession.mockResolvedValue({
    user: { id: "guardian", email: "parent@example.test" },
  });
  fixture.from.mockImplementation((table: string) => {
    if (table !== "guardian") throw new Error(`unexpected table: ${table}`);
    return {
      upsert: () => ({
        select: () => ({
          single: async () => ({
            data: { id: "guardian-row", name: "Parent", contact: "parent@example.test" },
            error: null,
          }),
        }),
      }),
    };
  });
  fixture.loadProfiles.mockResolvedValue({ data: [] });
  fixture.listPurposes.mockResolvedValue([
    { purpose: "store_papers", label: "Storing and reading uploaded papers", is_required: true, sort_order: 1 },
    { purpose: "extract_text", label: "Extracting text from uploaded papers", is_required: true, sort_order: 2 },
    { purpose: "generate_explanations", label: "Explaining where marks were lost", is_required: true, sort_order: 3 },
    { purpose: "track_progress", label: "Tracking progress over time", is_required: true, sort_order: 4 },
    { purpose: "weekly_parent_digest", label: "Weekly summary to the parent", is_required: false, sort_order: 5 },
    { purpose: "improve_extraction", label: "Improving extraction accuracy from corrections", is_required: false, sort_order: 6 },
  ]);
  fixture.recordConsent.mockResolvedValue([]);

  render(<MemoryRouter initialEntries={["/"]}><Onboarding /></MemoryRouter>);

  await screen.findByRole("heading", { name: "One detail" });
  await userEvent.type(screen.getByLabelText("Your name"), "Parent");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  await screen.findByRole("heading", { name: "What you're agreeing to" });

  expect(screen.getByRole("switch", { name: "Weekly summary to the parent" })
    .getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("switch", { name: "Improving extraction accuracy from corrections" })
    .getAttribute("aria-checked")).toBe("false");

  await userEvent.click(screen.getByRole("button", { name: "Give consent" }));

  await waitFor(() => expect(fixture.parentGuard).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(fixture.recordConsent).toHaveBeenCalledWith({
    guardianId: "guardian-row",
    studentId: null,
    decisions: {
      store_papers: true,
      extract_text: true,
      generate_explanations: true,
      track_progress: true,
      weekly_parent_digest: false,
      improve_extraction: false,
    },
  }));
});
