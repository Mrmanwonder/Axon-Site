import { beforeEach, expect, test, vi } from "vitest";
const fake = vi.hoisted(() => ({
  createClient: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), setSession: vi.fn(),
  getSession: vi.fn(), reset: vi.fn(), update: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: fake.createClient }));
vi.mock("../../src/supabase.js", () => ({ sb: { auth: {
  setSession: fake.setSession, getSession: fake.getSession, resetPasswordForEmail: fake.reset, updateUser: fake.update,
} } }));
vi.mock("../../src/config.js", () => ({ SUPABASE_URL: "http://localhost:54321", SUPABASE_PUBLISHABLE_KEY: "local-test" }));
vi.mock("../../src/lib/request.js", () => ({ fetchWithTimeout: vi.fn() }));
import { passwordSignIn, passwordSignUp, requestPasswordReset, changePassword, reauthenticateWithPassword } from "../../src/lib/auth/password.js";
const session = (id = "guardian", email = "parent@example.test") => ({ user: { id, email }, access_token: "local-access", refresh_token: "local-refresh" });
beforeEach(() => {
  vi.resetAllMocks();
  fake.createClient.mockReturnValue({ auth: { signInWithPassword: fake.signIn, signUp: fake.signUp } });
  fake.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  fake.setSession.mockResolvedValue({ data: { session: session() }, error: null });
  fake.signIn.mockResolvedValue({ data: { session: session() }, error: null });
  fake.signUp.mockResolvedValue({ data: { session: null, user: { id: "obfuscated" } }, error: null });
  fake.reset.mockResolvedValue({ error: null });
  fake.update.mockResolvedValue({ data: { user: { id: "guardian" } }, error: null });
});
test("password sign-in normalizes only email, keeps password exact, isolates proof and installs matching principal", async () => {
  await expect(passwordSignIn(" Parent@Example.Test ", "  secret  ")).resolves.toEqual(session());
  expect(fake.signIn).toHaveBeenCalledWith({ email: "parent@example.test", password: "  secret  " });
  expect(fake.createClient.mock.calls[0][2].auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  expect(fake.setSession).toHaveBeenCalledOnce();
});
test("a mismatched returned email is never installed", async () => {
  fake.signIn.mockResolvedValue({ data: { session: session("other", "other@example.test") } });
  await expect(passwordSignIn("parent@example.test", "secret")).rejects.toThrow("could not complete");
  expect(fake.setSession).not.toHaveBeenCalled();
});
test.each(["Invalid login credentials", "User already registered", "Email not found", "Signups not allowed"])("auth failures never expose account existence: %s", async message => {
  fake.signIn.mockResolvedValue({ error: { message } });
  fake.signUp.mockResolvedValue({ error: { message } });
  fake.reset.mockResolvedValue({ error: { message } });
  for (const action of [() => passwordSignIn("parent@example.test", "secret"), () => passwordSignUp("parent@example.test", "secret123"), () => requestPasswordReset("parent@example.test")]) {
    await expect(action()).rejects.toThrow("We could not complete that request. Check your details or try again later.");
  }
});
test("unconfirmed and obfuscated existing signup responses share one result and never install a session", async () => {
  await expect(passwordSignUp("parent@example.test", "secret123")).resolves.toBeNull();
  fake.signUp.mockResolvedValue({ data: { session: null, user: { id: "new", identities: [{ provider: "email" }] } } });
  await expect(passwordSignUp("parent@example.test", "secret123")).resolves.toBeNull();
  expect(fake.setSession).not.toHaveBeenCalled();
});
test("signup with an immediate matching session installs it", async () => {
  fake.signUp.mockResolvedValue({ data: { session: session() } });
  await expect(passwordSignUp("parent@example.test", "secret123")).resolves.toEqual(session());
});
test("reset uses this application origin and route", async () => {
  await requestPasswordReset("parent@example.test");
  expect(fake.reset).toHaveBeenCalledWith("parent@example.test", { redirectTo: location.origin + location.pathname });
});
test("password update stays on the current auth user", async () => {
  await changePassword("secret123");
  expect(fake.update).toHaveBeenCalledWith({ password: "secret123" });
  fake.update.mockResolvedValue({ data: { user: { id: "other" } } });
  await expect(changePassword("secret123")).rejects.toThrow("could not complete");
});
test("a recovery update cannot run without an authenticated session", async () => {
  fake.getSession.mockResolvedValue({ data: { session: null } });
  await expect(changePassword("secret123")).rejects.toThrow("could not complete");
  expect(fake.update).not.toHaveBeenCalled();
});
test("Parent Mode reads the session email and requires exactly the same user id", async () => {
  await reauthenticateWithPassword("secret");
  expect(fake.signIn).toHaveBeenCalledWith({ email: "parent@example.test", password: "secret" });
  fake.setSession.mockClear();
  fake.signIn.mockResolvedValue({ data: { session: session("different-id") } });
  await expect(reauthenticateWithPassword("secret")).rejects.toThrow("could not complete");
  expect(fake.setSession).not.toHaveBeenCalled();
});
test.each([null, session("other"), session("guardian", "changed@example.test")])("an account switch or sign-out during reauth is rejected", async switched => {
  fake.getSession.mockResolvedValueOnce({ data: { session: session() } }).mockResolvedValueOnce({ data: { session: switched } });
  await expect(reauthenticateWithPassword("secret")).rejects.toThrow("could not complete");
  expect(fake.setSession).not.toHaveBeenCalled();
});
test("invalid email and new short passwords fail before any auth request", async () => {
  await expect(passwordSignUp("not-an-email", "secret123")).rejects.toThrow("Enter an email");
  await expect(passwordSignUp("parent@example.test", "short")).rejects.toThrow("at least 8");
  expect(fake.createClient).not.toHaveBeenCalled();
});
