import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useApp } from "../data/AppProvider";
import { changePassword } from "../data/modules";
import PasswordField from "../components/PasswordField";
import { Shell, Err } from "./chrome";

export default function PasswordRecovery() {
  const { finishPasswordRecovery } = useApp();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flight = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (flight.current) return;
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    flight.current = true; setBusy(true); setError(null);
    try {
      await changePassword(password);
      setPassword(""); setConfirmation("");
      finishPasswordRecovery();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not change your password. Try again later."); }
    finally { flight.current = false; setBusy(false); }
  };
  return <Shell title="Choose a new password">
    <form className="password-access" onSubmit={event => void submit(event)}>
      <Err message={error} />
      <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} creating disabled={busy} />
      <PasswordField id="reset-confirmation" label="Confirm password" value={confirmation} onChange={setConfirmation} creating disabled={busy} />
      <div className="obfoot">
        <button type="submit" className="btn primary" disabled={busy} aria-busy={busy}>{busy ? "Saving…" : "Save password"}</button>
        <button type="button" className="btn plain" disabled={busy} onClick={() => { setPassword(""); setConfirmation(""); finishPasswordRecovery(); }}>Cancel</button>
      </div>
    </form>
  </Shell>;
}
