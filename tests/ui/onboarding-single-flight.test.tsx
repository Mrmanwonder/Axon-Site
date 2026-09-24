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
vi.mock("../../src/ui/data/modules", () => {
  const offering = {
    id: "00000000-0000-0000-0000-000000009702",
    programme_id: "programme-as",
    stage_id: "stage-as",
    subject_id: "subject-physics",
    display_name: "Physics",
    external_code: "9702",
    external_code_kind: "syllabus_code",
    levels_supported: [],
    language_code: null,
    variant: null,
    aliases: [],
    metadata: {},
  };
  return {
    sb: { rpc: fixture.rpc, from: fixture.from },
    sendOtp: vi.fn(), verifyOtp: vi.fn(), currentSession: fixture.currentSession,
    currentGuardian: async () => ({ id: "guardian", name: "Parent", contact: "parent@example.test" }),
    signInWithProvider: vi.fn(), isProviderNotEnabled: () => false,
    OAUTH_PROVIDERS: [], PROVIDER_LABEL: {},
    listPurposes: fixture.listPurposes, recordConsent: fixture.recordConsent,
    startCheckout: vi.fn(),
    paperTypesFor: () => [],
    PROVIDER_KEYS: ["cambridge", "cbse", "ib"],
    providerLabel: (key: string) => ({ cambridge: "Cambridge", cbse: "CBSE", ib: "IB Diploma" }[key] ?? key),
    getProgrammes: async () => [{
      id: "programme-as", provider_id: "provider-cambridge",
      key: "cambridge_as", label: "Cambridge International AS Level", metadata: {},
    }],
    getStages: async () => [{
      id: "stage-as", programme_id: "programme-as", key: "cambridge_as",
      label: "AS Level", school_year_label: "Year 12", legacy_class_level: 11,
      sort_order: 10, metadata: {},
    }],
    getSubjectOfferings: async () => [offering],
    filterSubjectOfferings: (rows: typeof offering[], query: string) =>
      rows.filter(row => !query || row.display_name.toLowerCase().includes(query.toLowerCase()) || row.external_code?.includes(query)),
    defaultLevelFor: () => null,
    AVATAR_PRESETS: [{
      kind: "gradient", key: "dreamBloom", title: "Dream bloom",
      type: "volumetric", c: ["#eee", "#aaa", "#222", "#fff"],
    }],
    avatarRenderFor: () => ({
      kind: "gradient", preset: "dreamBloom", background: "#ddd", color: "#111", glyph: null,
    }),
    initialFor: (label?: string | null) => label?.trim()[0]?.toUpperCase() ?? "?",
  };
});

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

  const class11 = await screen.findByRole("button", { name: "Class 11" });
  await waitFor(() => expect(class11.getAttribute("aria-pressed")).toBe("true"));
  expect(screen.getByRole("button", { name: "Cambridge" }).getAttribute("aria-pressed")).toBe("true");

  const physics = await screen.findByRole("button", { name: /Physics/ });
  await userEvent.click(physics);

  const create = screen.getByRole("button", { name: "Create profile" });
  for (let tap = 0; tap < 10; tap += 1) fireEvent.click(create);

  await waitFor(() => expect(fixture.rpc).toHaveBeenCalledTimes(1));
  expect((create as HTMLButtonElement).disabled).toBe(true);
  expect(fixture.rpc).toHaveBeenCalledWith("create_student_profile_v2", expect.objectContaining({
    p_first_name: "Sam",
    p_programme_key: "cambridge_as",
    p_stage_key: "cambridge_as",
    p_avatar_key: "dreamBloom",
    p_subjects: [{ offering_id: "00000000-0000-0000-0000-000000009702", level: null }],
  }));

  await act(async () => result.resolve({
    data: {
      id: "student", first_name: "Sam", provider_key: "cambridge",
      programme_key: "cambridge_as", stage_key: "cambridge_as", subjects: [{
        offering_id: "00000000-0000-0000-0000-000000009702",
        subject: "Physics", external_code: "9702", level: null,
      }],
    },
    error: null,
  }));
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
