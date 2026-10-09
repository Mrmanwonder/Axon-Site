import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { passwordSignIn, passwordSignUp, requestPasswordReset } from "../data/modules";
import PasswordField from "../components/PasswordField";
import { Err } from "./chrome";

type Mode = "sign-in" | "create" | "forgot";
export default function PasswordAccess({ email, onEmail, onAuthenticated, disabled = false }: {
  email: string; onEmail: (value: string) => void; onAuthenticated: () => void | Promise<void>; disabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const changeMode = (next: Mode) => { setMode(next); setPassword(""); setError(null); setMessage(null); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (flight.current || disabled) return;
    flight.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      if (mode === "forgot") {
        await requestPasswordReset(email);
        setMessage("If this email can receive a reset link, check your inbox. Open the link on this device to choose a password.");
      } else {
        const session = mode === "create" ? await passwordSignUp(email, password) : await passwordSignIn(email, password);
        setPassword("");
        if (session) await onAuthenticated();
        else setMessage("Check your email for a confirmation link if one is needed. You can also sign in or request a password reset.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not complete that request. Try again later.");
    } finally { flight.current = false; setBusy(false); }
  };
  return <form className="password-access" onSubmit={event => void submit(event)}>
    <h2>{mode === "create" ? "Create an account" : mode === "forgot" ? "Reset your password" : "Sign in with a password"}</h2>
    <Err message={error} />
    <label htmlFor="password-email">Email</label>
    <input id="password-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
      value={email} onChange={event => onEmail(event.target.value)} required disabled={busy || disabled} />
    {mode !== "forgot" && <PasswordField key={mode} id="account-password" value={password} onChange={setPassword}
      creating={mode === "create"} disabled={busy || disabled} />}
    {message && <p role="status">{message}</p>}
    <div className="obfoot">
      <button type="submit" className="btn primary" disabled={busy || disabled} aria-busy={busy}>
        {busy ? "Working…" : mode === "create" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
      </button>
      {mode !== "sign-in" && <button type="button" className="btn plain" disabled={busy || disabled} onClick={() => changeMode("sign-in")}>Sign in instead</button>}
      {mode !== "create" && <button type="button" className="btn plain" disabled={busy || disabled} onClick={() => changeMode("create")}>Create an account</button>}
      {mode !== "forgot" && <button type="button" className="btn plain" disabled={busy || disabled} onClick={() => changeMode("forgot")}>Forgot password</button>}
    </div>
  </form>;
}
