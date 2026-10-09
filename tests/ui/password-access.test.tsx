import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
const fake = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn(), reset: vi.fn(), update: vi.fn(), finish: vi.fn() }));
vi.mock("../../src/ui/data/modules", () => ({
  passwordSignIn: fake.signIn, passwordSignUp: fake.signUp, requestPasswordReset: fake.reset, changePassword: fake.update,
}));
vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => ({ finishPasswordRecovery: fake.finish }) }));
vi.mock("../../src/ui/onboarding/chrome", () => ({
  Err: ({ message }: { message: string | null }) => message ? <p role="alert">{message}</p> : null,
  Shell: ({ title, children }: { title: string; children: React.ReactNode }) => <main><h1>{title}</h1>{children}</main>,
}));
import { useState } from "react";
import PasswordAccess from "../../src/ui/onboarding/PasswordAccess";
import PasswordRecovery from "../../src/ui/onboarding/PasswordRecovery";
function Access({ done = vi.fn() }: { done?: () => void }) {
  const [email, setEmail] = useState("parent@example.test");
  return <PasswordAccess email={email} onEmail={setEmail} onAuthenticated={done} />;
}
beforeEach(() => { vi.resetAllMocks(); });
test("password field has correct autocomplete and an accessible show/hide control", async () => {
  render(<Access />);
  const input = screen.getByLabelText("Password") as HTMLInputElement;
  expect(input.type).toBe("password"); expect(input.autocomplete).toBe("current-password");
  expect((screen.getByLabelText("Email") as HTMLInputElement).autocomplete).toBe("email");
  await userEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(input.type).toBe("text");
  await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(input.type).toBe("password");
  await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
  expect((screen.getByLabelText("Password") as HTMLInputElement).autocomplete).toBe("new-password");
});
test("sign-in is single-flight and clears credentials before opening the account", async () => {
  let resolve!: (value: object) => void;
  fake.signIn.mockReturnValue(new Promise(r => { resolve = r; }));
  const done = vi.fn();
  render(<Access done={done} />);
  await userEvent.type(screen.getByLabelText("Password"), "secret123");
  const form = screen.getByRole("button", { name: "Sign in" }).closest("form")!;
  for (let i = 0; i < 8; i++) fireEvent.submit(form);
  expect(fake.signIn).toHaveBeenCalledOnce(); expect(done).not.toHaveBeenCalled();
  await act(async () => resolve({ user: { id: "guardian" } }));
  expect(done).toHaveBeenCalledOnce();
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
});
test("unconfirmed signup does not advance or create a guardian", async () => {
  fake.signUp.mockResolvedValue(null);
  const done = vi.fn(); render(<Access done={done} />);
  await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
  await userEvent.type(screen.getByLabelText("Password"), "secret123");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect((await screen.findByRole("status")).textContent).toContain("confirmation link if one is needed");
  expect(done).not.toHaveBeenCalled();
});
test("forgot-password status is generic and password is discarded on mode change", async () => {
  fake.reset.mockResolvedValue(undefined); render(<Access />);
  await userEvent.type(screen.getByLabelText("Password"), "secret123");
  await userEvent.click(screen.getByRole("button", { name: "Forgot password" }));
  expect(screen.queryByLabelText("Password")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect((await screen.findByRole("status")).textContent).toContain("If this email can receive a reset link");
  await userEvent.click(screen.getByRole("button", { name: "Sign in instead" }));
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
});
test("recovery requires matching passwords and only finishes after successful update", async () => {
  fake.update.mockResolvedValue(undefined); render(<PasswordRecovery />);
  await userEvent.type(screen.getByLabelText("New password"), "secret123");
  await userEvent.type(screen.getByLabelText("Confirm password"), "different");
  await userEvent.click(screen.getByRole("button", { name: "Save password" }));
  expect(screen.getByRole("alert").textContent).toContain("do not match");
  expect(fake.update).not.toHaveBeenCalled();
  await userEvent.clear(screen.getByLabelText("Confirm password"));
  await userEvent.type(screen.getByLabelText("Confirm password"), "secret123");
  await userEvent.click(screen.getByRole("button", { name: "Save password" }));
  await waitFor(() => expect(fake.finish).toHaveBeenCalledOnce());
});
test("a failed recovery remains visible and retryable", async () => {
  fake.update.mockRejectedValue(new Error("We could not complete that request. Try again later."));
  render(<PasswordRecovery />);
  await userEvent.type(screen.getByLabelText("New password"), "secret123");
  await userEvent.type(screen.getByLabelText("Confirm password"), "secret123");
  await userEvent.click(screen.getByRole("button", { name: "Save password" }));
  expect((await screen.findByRole("alert")).textContent).toContain("could not complete");
  expect(fake.finish).not.toHaveBeenCalled();
});
