import { useState } from "react";
import "./PasswordField.css";

type Props = { id: string; label?: string; value: string; onChange: (value: string) => void; creating?: boolean; disabled?: boolean };
export default function PasswordField({ id, label = "Password", value, onChange, creating = false, disabled = false }: Props) {
  const [shown, setShown] = useState(false);
  return <div className="password-field">
    <label htmlFor={id}>{label}</label>
    <div className="password-field-row">
      <input id={id} type={shown ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
        autoComplete={creating ? "new-password" : "current-password"} disabled={disabled} required
        autoCapitalize="none" spellCheck={false} minLength={creating ? 8 : undefined} />
      <button type="button" className="btn plain" aria-label={shown ? "Hide password" : "Show password"}
        aria-controls={id} aria-pressed={shown} disabled={disabled} onClick={() => setShown(v => !v)}>{shown ? "Hide" : "Show"}</button>
    </div>
    {creating && <p className="subnote">Use at least 8 characters.</p>}
  </div>;
}
