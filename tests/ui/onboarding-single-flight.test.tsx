  await userEvent.click(screen.getByRole("button", { name: "Continue with email or phone" }));
  await userEvent.click(screen.getByRole("button", { name: "Continue with email or phone" }));
  await userEvent.type(screen.getByLabelText("Your name"), "Parent");
  await userEvent.type(screen.getByLabelText("Email or phone"), "parent@example.test");
  await userEvent.click(screen.getByRole("button", { name: "Send me a code" }));
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

test("password flight locks method switching and Back, then releases after failure", async () => {
  fixture.session = null;
  window.history.replaceState({}, "", "/");
  const proof = deferred<unknown>();
  fixture.passwordSignIn.mockReturnValue(proof.promise);
  render(<MemoryRouter><Onboarding /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Continue with email or phone" }));
  await userEvent.click(screen.getByRole("button", { name: "Sign in with a password instead" }));
  await userEvent.type(screen.getByLabelText("Email", { exact: true }), "parent@example.test");
  await userEvent.type(screen.getByLabelText("Password", { exact: true }), "secret123");
  const code = screen.getByRole("button", { name: "Use a sign-in code instead" });
  expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
  const form = screen.getByRole("button", { name: "Sign in", exact: true }).closest("form")!;
  for (let n = 0; n < 5; n++) fireEvent.submit(form);
  fireEvent.click(code);
  expect(fixture.passwordSignIn).toHaveBeenCalledOnce();
  expect(fixture.provider).not.toHaveBeenCalled();
  expect((code as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Back", exact: true })).toBeNull();
  expect(screen.getByRole("heading", { name: "Sign in with a password" })).toBeTruthy();
  // Missing confirmed session is a recoverable sign-in response.
  await act(async () => proof.resolve(null));
  expect((google as HTMLButtonElement).disabled).toBe(false);
  await userEvent.click(code);
  expect(screen.getByLabelText("Email or phone")).toBeTruthy();
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
  expect((screen.getByRole("button", { name: "Continue with email or phone" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Back", exact: true })).toBeNull();
  await act(async () => handoff.resolve());
});test("welcome has a single continuation and account methods reveal progressively", async () => {
  fixture.session = null;
  window.history.replaceState({}, "", "/");
  render(<MemoryRouter><Onboarding /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: /See where the marks went/ })).toBeTruthy();
  expect(screen.getAllByRole("button").map(button => button.textContent?.trim())).toEqual(["Continue"]);
  expect(screen.getByText(/parent or guardian sets up the account/i)).toBeTruthy();

  await userEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  expect(screen.getByRole("heading", { name: "Set up your account" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Continue with email or phone" })).toBeTruthy();
  expect(screen.queryByLabelText("Email or phone")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Continue with email or phone" }));
  expect(screen.getByLabelText("Email or phone")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Continue", exact: true })).toBeTruthy();
});


