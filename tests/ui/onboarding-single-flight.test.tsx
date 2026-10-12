import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const fixture = vi.hoisted(() => ({
  session: { user: { id: "guardian", email: "parent@example.test" } } as { user: { id: string; email: string } } | null,
  sendOtp: vi.fn(),
  passwordSignIn: vi.fn(),
  provider: vi.fn(),
  verifyOtp: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  finish: vi.fn(),
  loadProfiles: vi.fn(),
  currentSession: vi.fn(),
  listPurposes: vi.fn(),
  recordConsent: vi.fn(),
  parentGuard: vi.fn((action: () => void | Promise<void>) => action()),
  workos: false,
  lookup: vi.fn(),
  saved: null as string | null,
  changePassword: vi.fn(),
  assertSafe: vi.fn(),
  guardian: { id: "guardian", name: "Parent", contact: "parent@example.test" } as { id: string; name: string; contact: string } | null,
}));
vi.mock("../../src/ui/data/AppProvider", () => ({
  useApp: () => ({
    session: fixture.session,
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
vi.mock("../../src/ui/data/modules", async () => {
  const notice = await vi.importActual<typeof import("../../src/notice.js")>("../../src/notice.js");
  const policy = await vi.importActual<typeof import("../../src/lib/auth/passwordPolicy.js")>("../../src/lib/auth/passwordPolicy.js");
  const lookupLib = await vi.importActual<typeof import("../../src/lib/auth/accountLookup.js")>("../../src/lib/auth/accountLookup.js");
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
    sendOtp: fixture.sendOtp, verifyOtp: fixture.verifyOtp, currentSession: fixture.currentSession,
    currentGuardian: async () => fixture.guardian,
    lookupAccount: fixture.lookup, cachedAccount: () => fixture.saved, forgetAccount: vi.fn(), warmAccountLookup: vi.fn(),
    normalisedEmail: lookupLib.normalisedEmail, EMAIL_SHAPE: lookupLib.EMAIL_SHAPE,
    PASSWORD_RULES: policy.PASSWORD_RULES, assertSafeNewPassword: fixture.assertSafe,
    changePassword: fixture.changePassword,
    passwordSignIn: fixture.passwordSignIn, passwordSignUp: vi.fn(), requestPasswordReset: vi.fn(),
    signInWithProvider: fixture.provider, isProviderNotEnabled: () => false,
    OAUTH_PROVIDERS: ["google"], PROVIDER_LABEL: { google: "Google", "custom:workos": "your email and password" },
    get WORKOS_PASSWORD() { return fixture.workos; },
    listPurposes: fixture.listPurposes, recordConsent: fixture.recordConsent,
    NOTICE_LANGUAGES: notice.LANGUAGES, noticeStrings: notice.noticeStrings,
    purposeLabel: notice.purposeLabel, purposeNote: notice.purposeNote, noticeIsComplete: notice.noticeIsComplete,
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

const EMAIL = "parent@example.test";
async function openAccountStep() {
  fixture.session = null;
  window.history.replaceState({}, "", "/");
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
}
async function typeEmail(value = EMAIL) {
  await userEvent.type(screen.getByLabelText("Email", { exact: true }), value);
}

test("welcome has a single continuation and the account step starts with one email field", async () => {
  fixture.session = null;
  window.history.replaceState({}, "", "/");
  render(<MemoryRouter><Onboarding /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: /See where the marks went/ })).toBeTruthy();
  expect(screen.getAllByRole("button").map(button => button.textContent?.trim())).toEqual(["Continue"]);
  expect(screen.getByText(/parent or guardian sets up the account/i)).toBeTruthy();

  await userEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  expect(screen.getByRole("heading", { name: "Welcome to Axon" })).toBeTruthy();
  expect(screen.queryByText("Set up your account", { selector: "h1" })).toBeNull();
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
  expect(screen.getByLabelText("Email", { exact: true })).toBeTruthy();
  expect(screen.queryByLabelText(/phone/i)).toBeNull();
  expect(screen.queryByLabelText("Your name")).toBeNull();
  expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Continue", exact: true })).toBeTruthy();
});

test("an existing password account is recognised as the email is typed and asks only for its password", async () => {
  fixture.lookup.mockReset().mockResolvedValue("password");
  await openAccountStep();
  await typeEmail("pare");
  expect(fixture.lookup).not.toHaveBeenCalled();
  await typeEmail("nt@example.test");
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
  // No debounce: the check starts the moment the address is valid in shape, and
  // a stale one is cancelled. The last one is for the complete address.
  expect(fixture.lookup).toHaveBeenLastCalledWith(EMAIL, expect.objectContaining({ signal: expect.anything() }));
  const password = screen.getByLabelText("Password", { exact: true }) as HTMLInputElement;
  expect(password.autocomplete).toBe("current-password");
  expect(screen.queryByText("Your password needs")).toBeNull();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  // Editing the address drops back to the neutral heading; nothing stale stays.
  await userEvent.type(screen.getByLabelText("Email", { exact: true }), "{backspace}{backspace}{backspace}{backspace}");
  expect(screen.getByRole("heading", { name: "Welcome to Axon" })).toBeTruthy();
  expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();
});

test("a new email gets a password whose requirements tick off live, and the code is offered only once they are met", async () => {
  fixture.lookup.mockReset().mockResolvedValue("new");
  fixture.assertSafe.mockReset().mockResolvedValue(undefined);
  fixture.sendOtp.mockReset().mockResolvedValue(undefined);
  await openAccountStep();
  await typeEmail();
  expect(await screen.findByRole("heading", { name: "Create your account" })).toBeTruthy();
  const password = screen.getByLabelText("Password", { exact: true }) as HTMLInputElement;
  expect(password.autocomplete).toBe("new-password");
  expect(screen.queryByText("Your password needs")).toBeNull();

  const send = screen.getByRole("button", { name: "Email me a code" }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  await userEvent.click(password);
  const rules = () => within(screen.getByRole("list", { name: "Your password needs" })).getAllByRole("listitem");
  expect(rules().map(li => li.hasAttribute("data-met"))).toEqual([false, false, false, false]);

  await userEvent.type(password, "abcdefgh");
  expect(rules().map(li => li.hasAttribute("data-met"))).toEqual([true, false, true, false]);
  expect(send.disabled).toBe(true);
  await userEvent.type(password, "A");
  expect(rules().map(li => li.hasAttribute("data-met"))).toEqual([true, true, true, false]);
  await userEvent.type(password, "1");
  expect(rules().every(li => li.hasAttribute("data-met"))).toBe(true);
  expect(send.disabled).toBe(false);

  await userEvent.click(send);
  expect(fixture.assertSafe).toHaveBeenCalledWith("abcdefghA1");
  await waitFor(() => expect(fixture.sendOtp).toHaveBeenCalledWith(EMAIL));
  expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy();
});

test("the password chosen for a new account is saved after the code is confirmed, and a failed save is shown and retried", async () => {
  fixture.lookup.mockReset().mockResolvedValue("new");
  fixture.assertSafe.mockReset().mockResolvedValue(undefined);
  fixture.sendOtp.mockReset().mockResolvedValue(undefined);
  fixture.verifyOtp.mockReset().mockResolvedValue({});
  fixture.currentSession.mockReset().mockResolvedValue({ user: { id: "guardian", email: EMAIL } });
  fixture.changePassword.mockReset().mockRejectedValueOnce(new Error("no")).mockResolvedValue(undefined);
  fixture.guardian = null;
  try {
    await openAccountStep();
    await typeEmail();
    await userEvent.type(await screen.findByLabelText("Password", { exact: true }), "Abcdefg1");
    await userEvent.click(screen.getByRole("button", { name: "Email me a code" }));
    await userEvent.type(await screen.findByLabelText("Your code"), "12345678");
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't save your password");
    expect(fixture.verifyOtp).toHaveBeenCalledTimes(1);
    expect(fixture.changePassword).toHaveBeenCalledWith("Abcdefg1");
    // Retrying does not spend the code again, and no guardian row is written
    // without a name: the flow asks for it next.
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "One detail" })).toBeTruthy();
    expect(fixture.verifyOtp).toHaveBeenCalledTimes(1);
    expect(fixture.changePassword).toHaveBeenCalledTimes(2);
  } finally { fixture.guardian = { id: "guardian", name: "Parent", contact: EMAIL }; }
});

test("an account that signs in with a code is offered the code and no password", async () => {
  fixture.lookup.mockReset().mockResolvedValue("code");
  await openAccountStep();
  await typeEmail();
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
  expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();
  expect(screen.getByRole("button", { name: "Email me a code" })).toBeTruthy();
});

test("when the check cannot be made, the form is neutral and offers to create an account instead", async () => {
  fixture.lookup.mockReset().mockResolvedValue("unknown");
  await openAccountStep();
  await typeEmail();
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  expect(screen.getByLabelText("Password", { exact: true })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "New to Axon? Create an account" }));
  expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
  expect((screen.getByLabelText("Password", { exact: true }) as HTMLInputElement).autocomplete).toBe("new-password");
});

test("code entry opens before a slow send completes, with honest pending state and no duplicate requests", async () => {
  fixture.session = null;
  window.history.replaceState({}, "", "/");
  const sent = deferred<void>();
  fixture.sendOtp.mockReturnValue(sent.promise);
  fixture.lookup.mockReset().mockResolvedValue("code");
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  await typeEmail();
  const send = await screen.findByRole("button", { name: "Email me a code" });
  for (let i = 0; i < 10; i++) fireEvent.click(send);
  expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Sending a code");
  expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fixture.sendOtp).toHaveBeenCalledTimes(1);
  expect(fixture.verifyOtp).not.toHaveBeenCalled();
  await act(async () => sent.resolve());
  expect(screen.getByRole("status").textContent).toBe("Sent to parent@example.test.");
  expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole("button", { name: /Resend in/ })).toBeTruthy();
});

test("failed code delivery is visible and a retry is single-flight", async () => {
  fixture.session = null;
  window.history.replaceState({}, "", "/");
  fixture.sendOtp.mockRejectedValueOnce(new Error("delivery unavailable"));
  fixture.lookup.mockReset().mockResolvedValue("code");
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  await typeEmail();
  await userEvent.click(await screen.findByRole("button", { name: "Email me a code" }));
  expect((await screen.findByRole("alert")).textContent).toContain("That code could not be sent");
  expect(screen.getByRole("status").textContent).toContain("has not been sent");
  const retry = screen.getByRole("button", { name: "Try sending again" });
  const sent = deferred<void>();
  fixture.sendOtp.mockReturnValue(sent.promise);
  for (let i = 0; i < 10; i++) fireEvent.click(retry);
  expect(fixture.sendOtp).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("Sending a code");
  await act(async () => sent.resolve());
  expect(screen.getByRole("status").textContent).toContain("Sent to");
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.session = { user: { id: "guardian", email: "parent@example.test" } };
  window.history.replaceState({}, "", "/?billing=success");
});

test("ten rapid Create Profile actions issue one atomic profile request", async () => {
  const result = deferred<{ data: { id: string; first_name: string }; error: null }>();
  fixture.rpc.mockReturnValue(result.promise);
  render(<MemoryRouter initialEntries={["/?billing=success"]}><Onboarding /></MemoryRouter>);

  await screen.findByRole("heading", { name: "The student" });
  const identity = document.querySelector<HTMLElement>(".student-identity-row");
  expect(identity).toBeTruthy();
  expect(within(identity!).getByRole("button", { name: "Change profile picture" })).toBeTruthy();
  expect(within(identity!).getByLabelText("First name")).toBeTruthy();
  expect(screen.queryByText("Picture")).toBeNull();

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
    noticeLanguage: "en",
  }));
});

/* ── AXO-210: the consent notice in Hindi ─────────────────────────────────── */

const ALL_PURPOSES = [
  { purpose: "store_papers", label: "Storing and reading uploaded papers", is_required: true, sort_order: 1 },
  { purpose: "extract_text", label: "Extracting text from uploaded papers", is_required: true, sort_order: 2 },
  { purpose: "generate_explanations", label: "Explaining where marks were lost", is_required: true, sort_order: 3 },
  { purpose: "track_progress", label: "Tracking progress over time", is_required: true, sort_order: 4 },
  { purpose: "weekly_parent_digest", label: "Weekly summary to the parent", is_required: false, sort_order: 5 },
  { purpose: "improve_extraction", label: "Improving extraction accuracy from corrections", is_required: false, sort_order: 6 },
];

async function openConsent(purposes: typeof ALL_PURPOSES) {
  window.history.replaceState({}, "", "/");
  fixture.currentSession.mockResolvedValue({ user: { id: "guardian", email: "parent@example.test" } });
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
  fixture.listPurposes.mockResolvedValue(purposes);
  fixture.recordConsent.mockResolvedValue([]);
  render(<MemoryRouter initialEntries={["/"]}><Onboarding /></MemoryRouter>);
  await screen.findByRole("heading", { name: "One detail" });
  await userEvent.type(screen.getByLabelText("Your name"), "Parent");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "What you're agreeing to" });
}

test("the consent notice offers English and Hindi, and Hindi switches the whole notice", async () => {
  await openConsent(ALL_PURPOSES);

  const choice = await screen.findByRole("group", { name: "Notice language" });
  const english = within(choice).getByRole("button", { name: "English" });
  const hindi = within(choice).getByRole("button", { name: "हिन्दी" });
  expect(english.getAttribute("aria-pressed")).toBe("true");
  expect(hindi.getAttribute("lang")).toBe("hi");

  // The choice comes before the purposes.
  const firstSection = screen.getByText("What we need to do");
  expect(choice.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await userEvent.click(hindi);

  const heading = await screen.findByRole("heading", { name: "आप किस बात के लिए सहमति दे रहे हैं" });
  expect(heading.closest("[lang]")?.getAttribute("lang")).toBe("hi");
  expect(screen.getByText("हमें जो करना ज़रूरी है")).toBeTruthy();
  expect(screen.getByText("अपलोड किए गए पेपर सहेजना और पढ़ना")).toBeTruthy();
  expect(screen.getByRole("switch", { name: "अभिभावक को साप्ताहिक सारांश" })
    .getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("button", { name: "सहमति दें" })).toBeTruthy();
  // No English purpose label, one-liner or section title survives in Hindi.
  expect(screen.queryByText("Storing and reading uploaded papers")).toBeNull();
  expect(screen.queryByText("The pages you upload, kept in the account")).toBeNull();
  expect(screen.queryByText("What we need to do")).toBeNull();

  // And back.
  await userEvent.click(within(screen.getByRole("group", { name: "सूचना की भाषा" }))
    .getByRole("button", { name: "English" }));
  await screen.findByRole("heading", { name: "What you're agreeing to" });
  expect(screen.getByText("Storing and reading uploaded papers")).toBeTruthy();
});

test("the language the notice was shown in is recorded with the consent", async () => {
  await openConsent(ALL_PURPOSES);
  await userEvent.click(within(await screen.findByRole("group", { name: "Notice language" }))
    .getByRole("button", { name: "हिन्दी" }));
  await userEvent.click(screen.getByRole("switch", { name: "अभिभावक को साप्ताहिक सारांश" }));
  await userEvent.click(screen.getByRole("button", { name: "सहमति दें" }));

  await waitFor(() => expect(fixture.recordConsent).toHaveBeenCalledWith({
    guardianId: "guardian-row",
    studentId: null,
    decisions: {
      store_papers: true,
      extract_text: true,
      generate_explanations: true,
      track_progress: true,
      weekly_parent_digest: true,
      improve_extraction: false,
    },
    noticeLanguage: "hi",
  }));
});

test("Hindi is not offered when a purpose on the notice has no Hindi text", async () => {
  await openConsent([
    ...ALL_PURPOSES,
    { purpose: "untranslated_purpose", label: "A purpose with no Hindi label", is_required: false, sort_order: 7 },
  ]);

  await screen.findByText("A purpose with no Hindi label");
  expect(screen.queryByRole("group", { name: "Notice language" })).toBeNull();
  expect(screen.queryByRole("button", { name: "हिन्दी" })).toBeNull();
  const note = screen.getByText("The Hindi notice is incomplete, so this notice is in English only for now.");
  expect(note.getAttribute("lang")).toBe("en");

  await userEvent.click(screen.getByRole("button", { name: "Give consent" }));
  await waitFor(() => expect(fixture.recordConsent).toHaveBeenCalledWith(
    expect.objectContaining({ noticeLanguage: "en" }),
  ));
});

test("password flight locks the other routes and Back, then releases after a failed sign-in", async () => {
  fixture.lookup.mockReset().mockResolvedValue("password");
  let failSignIn!: (reason: Error) => void;
  fixture.passwordSignIn.mockReset().mockReturnValue(new Promise((_, reject) => { failSignIn = reject; }));
  await openAccountStep();
  await typeEmail();
  await userEvent.type(await screen.findByLabelText("Password", { exact: true }), "secret123");
  const code = screen.getByRole("button", { name: "Email me a code instead" });
  const form = screen.getByRole("button", { name: "Sign in", exact: true }).closest("form")!;
  for (let n = 0; n < 5; n++) fireEvent.submit(form);
  fireEvent.click(code);
  expect(fixture.passwordSignIn).toHaveBeenCalledOnce();
  expect(fixture.provider).not.toHaveBeenCalled();
  expect((code as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Back", exact: true })).toBeNull();
  await act(async () => failSignIn(new Error("bad")));
  expect((await screen.findByRole("alert")).textContent).toContain("That password didn't work");
  expect((code as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole("button", { name: "Back", exact: true })).toBeTruthy();
});
test("Google is single-flight and keeps Back and password entry disabled during handoff", async () => {
  fixture.session = null;
  window.history.replaceState({}, "", "/");
  const handoff = deferred<void>();
  fixture.provider.mockReturnValue(handoff.promise);
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  const google = screen.getByRole("button", { name: "Continue with Google" });
  for (let n = 0; n < 5; n++) fireEvent.click(google);
  expect(fixture.provider).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Back", exact: true })).toBeNull();
  await act(async () => handoff.resolve());
});

// AXO-234: with the staging flag on, the password choice hands off to WorkOS,
// which holds the password and applies the policy and breach check.
test("with WorkOS on, a typed email offers the WorkOS password hand-off and no Supabase password form", async () => {
  fixture.session = null;
  fixture.workos = true;
  try {
    window.history.replaceState({}, "", "/");
    fixture.lookup.mockReset();
    fixture.provider.mockReset().mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Onboarding /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(screen.queryByRole("button", { name: /WorkOS/i })).toBeNull();
    await typeEmail();
    expect(await screen.findByRole("heading", { name: "Continue to Axon" })).toBeTruthy();
    expect(screen.queryByLabelText(/^Password$/)).toBeNull();
    expect(fixture.lookup).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Continue with a password" }));
    expect(fixture.provider).toHaveBeenCalledWith("custom:workos");
    expect(fixture.passwordSignIn).not.toHaveBeenCalled();
  } finally {
    fixture.workos = false;
  }
});

test("an address this device has seen before is recognised immediately, before any network answer", async () => {
  // The saved answer is shown at once; the quiet re-check is still in flight.
  const recheck = deferred<string>();
  fixture.lookup.mockReset().mockReturnValue(recheck.promise);
  fixture.saved = "password";
  try {
    await openAccountStep();
    await typeEmail();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByLabelText("Password", { exact: true })).toBeTruthy();
    // The server disagrees (the account now signs in with a code): the screen follows.
    await act(async () => recheck.resolve("code"));
    expect(await screen.findByRole("button", { name: "Email me a code" })).toBeTruthy();
    expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();
  } finally { fixture.saved = null; }
});
