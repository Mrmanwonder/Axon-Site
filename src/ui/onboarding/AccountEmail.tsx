/* ═══════════════════════════════════════════════════════════════════════════
   EMAIL-FIRST ACCOUNT STEP

   One field to begin with. While the address is typed, Axon asks the
   `account-lookup` function what it belongs to and the form grows to fit:

     new        a password with its requirements ticking off live, then
                "Email me a code" once the password is valid
     password   a password box and a welcome back
     code       an account that signs in with a code: just the code button
     unknown    the check could not be made: a password box, with a way to
                create an account instead. Never a guess dressed as a result.

   A new account is created by the emailed code, not by a password alone: the
   code proves the address, then the password is saved against it (see
   Onboarding.verifyOtpCode). That keeps one verified path for every guardian.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import PressBox from "../components/PressBox";
import { hapticTick } from "../lib/haptics";
import {
  passwordSignIn, requestPasswordReset, assertSafeNewPassword, PASSWORD_RULES,
  lookupAccount, cachedAccount, warmAccountLookup, normalisedEmail, EMAIL_SHAPE, WORKOS_PASSWORD,
} from "../data/modules";
import { Err, Icon, ICONS } from "./chrome";
import "./AccountEmail.css";

export type AccountKind = "idle" | "checking" | "new" | "password" | "code" | "unknown" | "workos";

/* Short enough to feel instant, long enough that a paste or a fast typist asks
   once. The check starts the moment the address is complete in shape. */
const LOOKUP_DELAY_MS = 90;
const SIGN_IN_FAILED = "That password didn't work. Check it and try again, or have us email you a code.";

export function PasswordInput({ id, label, value, onChange, creating, disabled, onFocusChange }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  creating: boolean; disabled: boolean; onFocusChange?: (focused: boolean) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="obfield obpassword">
      <label className="k" htmlFor={id}>{label}</label>
      <div className="obpassword-row">
        <input id={id} type={shown ? "text" : "password"} value={value} disabled={disabled}
               onChange={(e) => onChange(e.target.value)}
               onFocus={() => onFocusChange?.(true)} onBlur={() => onFocusChange?.(false)}
               autoComplete={creating ? "new-password" : "current-password"}
               autoCapitalize="none" spellCheck={false} placeholder={creating ? "Create a password" : "Your password"} />
        <button type="button" className="obpassword-toggle" disabled={disabled}
                aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}
                onClick={() => setShown((v) => !v)}>
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export function Requirements({ password }: { password: string }) {
  const results = PASSWORD_RULES.map((rule: { id: string; label: string; test: (p: string) => boolean }) => (
    { id: rule.id, label: rule.label, met: rule.test(password) }));
  const metCount = results.filter((r: { met: boolean }) => r.met).length;
  return (
    <div className="obrules">
      <p className="obrules-title" id="ob-rules-title">Your password needs</p>
      <ul aria-labelledby="ob-rules-title">
        {results.map((r: { id: string; label: string; met: boolean }) => (
          <li key={r.id} data-met={r.met ? "" : undefined}>
            <span className="obrules-mark" aria-hidden="true"><Icon d={ICONS.tick} /></span>
            <span>{r.label}<span className="obsr"> — {r.met ? "done" : "not yet"}</span></span>
          </li>
        ))}
      </ul>
      <span className="obsr" role="status">{metCount} of {results.length} requirements met</span>
    </div>
  );
}

export default function AccountEmail({
  email, onEmail, locked, onKind, onSendCode, onSignedIn, onWorkOS, onBusyChange,
}: {
  email: string;
  onEmail: (value: string) => void;
  /** Another route (Google, a code already on its way) is in flight. */
  locked: boolean;
  onKind: (kind: AccountKind) => void;
  /** Start the emailed code. `password` is set when creating an account. */
  onSendCode: (password: string | null) => void | Promise<void>;
  onSignedIn: () => void | Promise<void>;
  onWorkOS: () => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const initial = useMemo<AccountKind>(() => {
    const e = normalisedEmail(email);
    if (!EMAIL_SHAPE.test(e)) return "idle";
    if (WORKOS_PASSWORD) return "workos";
    return (cachedAccount(e) as AccountKind | null) ?? "idle";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [kind, setKind] = useState<AccountKind>(initial);
  const [password, setPassword] = useState("");
  const [passwordActive, setPasswordActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "signin" | "create" | "reset">(null);
  const [resetAt, setResetAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const flight = useRef(false);
  const seq = useRef(0);
  const resolvedFor = useRef<string | null>(initial !== "idle" ? normalisedEmail(email) : null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordWrap = useRef<HTMLDivElement>(null);

  useEffect(() => { warmAccountLookup(); }, []);

  const setKindAndTell = (next: AccountKind) => { setKind(next); onKind(next); };
  useEffect(() => { onKind(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  /* Recognise the address while it is typed. The result belongs to the address
     it was asked about: a late answer for an address that has since been edited
     is dropped, never applied to the new one. */
  useEffect(() => {
    const e = normalisedEmail(email);
    if (!EMAIL_SHAPE.test(e)) {
      resolvedFor.current = null; seq.current++;
      setKindAndTell("idle"); setPassword(""); setError(null); setNotice(null);
      return;
    }
    if (resolvedFor.current === e) return;
    resolvedFor.current = null; setPassword(""); setError(null); setNotice(null);
    if (WORKOS_PASSWORD) { resolvedFor.current = e; setKindAndTell("workos"); return; }
    const mine = ++seq.current;
    const controller = new AbortController();
    const apply = (result: string) => {
      if (mine !== seq.current) return;
      resolvedFor.current = result === "unknown" ? null : e;
      setKindAndTell(result as AccountKind);
    };
    // Seen on this device before: show it now, with no wait and no network, then
    // quietly confirm it and correct the screen only if the answer has changed.
    const saved = cachedAccount(e) as AccountKind | null;
    if (saved) {
      apply(saved);
      void lookupAccount(e, { fresh: true, signal: controller.signal }).then((result) => {
        if (result !== "unknown" && result !== saved) { setPassword(""); apply(result); }
      });
      return () => controller.abort();
    }
    setKindAndTell("checking");
    const timer = setTimeout(() => { void lookupAccount(e, { signal: controller.signal }).then(apply); }, LOOKUP_DELAY_MS);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  /* The assurance line under the form is the one thing that moves when the form
     grows. Slide it from where it was to where it is, on the compositor, rather
     than letting it jump. */
  useLayoutEffect(() => {
    const root = emailRef.current?.closest("#obroot");
    const el = root?.querySelector<HTMLElement>(".obaccount-assurance");
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const previous = Number(el.dataset.top);
    el.dataset.top = String(top);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "reduce";
    const delta = previous - top;
    if (!previous || reduced || Math.abs(delta) < 2 || typeof el.animate !== "function") return;
    el.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }],
      { duration: 360, easing: "cubic-bezier(.32,.72,0,1)" });
  }, [kind, passwordActive, password === ""]);

  /* A new reset request cancels the one before it. Mail can take a minute, and
     asking again while waiting is what made the first email's link say expired. */
  const RESET_COOLDOWN_S = 60;
  const resetWait = resetAt === null ? 0 : Math.max(0, RESET_COOLDOWN_S - Math.floor((now - resetAt) / 1000));
  useEffect(() => {
    if (resetWait <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resetWait > 0]);

  const valid = EMAIL_SHAPE.test(normalisedEmail(email));
  const rulesMet = PASSWORD_RULES.every((r: { test: (p: string) => boolean }) => r.test(password));
  const disabled = locked || busy !== null;

  const run = async (label: "signin" | "create" | "reset", work: () => Promise<void>) => {
    if (flight.current || locked) return;
    flight.current = true; onBusyChange(true); setBusy(label); setError(null); setNotice(null);
    try { await work(); } finally { flight.current = false; onBusyChange(false); setBusy(null); }
  };

  const signIn = () => run("signin", async () => {
    try {
      await passwordSignIn(email, password);
    } catch { setError(SIGN_IN_FAILED); return; }
    setPassword("");
    await onSignedIn();
  });

  /* The code is requested after the flight is released: starting it is its own
     route (the parent locks every other route while it runs) and must not find
     this form's own password check still holding the lock. */
  const create = async () => {
    let chosen: string | null = null;
    await run("create", async () => {
      try { await assertSafeNewPassword(password); }
      catch (e) { setError((e as Error).message); return; }
      chosen = password;
    });
    if (chosen === null) return;
    setPassword("");
    await onSendCode(chosen);
  };

  const reset = () => run("reset", async () => {
    try {
      await requestPasswordReset(email);
      setNow(Date.now()); setResetAt(Date.now());
      setNotice("If this email has an account, a reset link is on its way. It can take a minute. Open only the newest email, on this device. Asking again cancels the earlier one.");
    } catch (e) { setError((e as Error).message); }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) { setError("Enter a valid email address."); return; }
    if (kind === "password" || kind === "unknown") { if (password) void signIn(); else setError("Enter your password."); }
    else if (kind === "new") { if (rulesMet) void create(); }
    else if (kind === "code") void onSendCode(null);
    else if (kind === "workos") void onWorkOS();
    else if (kind === "idle" || kind === "checking") {
      // Enter before the check has finished: settle it now instead of waiting.
      const e = normalisedEmail(email);
      const mine = ++seq.current;
      setKindAndTell("checking");
      void lookupAccount(e).then((result) => {
        if (mine !== seq.current) return;
        resolvedFor.current = result === "unknown" ? null : e;
        setKindAndTell(result as AccountKind);
      });
    }
  };

  const switchToCode = () => { hapticTick(); void onSendCode(null); };
  const showStatus = kind === "checking";

  return (
    <form className="obemail" onSubmit={onSubmit} noValidate>
      <div className="obfield obemail-field">
        <label className="k" htmlFor="ob-email">Email</label>
        <input id="ob-email" ref={emailRef} type="email" inputMode="email" name="email"
               value={email} onChange={(e) => onEmail(e.target.value)}
               autoComplete="username" autoCapitalize="none" spellCheck={false}
               autoFocus={typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches}
               placeholder="you@example.com" aria-describedby="ob-email-status" />
        <div className="hint obemail-status" id="ob-email-status" role="status" aria-live="polite">
          {showStatus
            ? <><span className="obdots" aria-hidden="true"><i /><i /><i /></span>Checking for your account</>
            : !valid ? "Use the email you'd like to sign in with."
            : kind === "new" ? "No account with this email yet. Let's create one."
            : kind === "password" || kind === "code" ? "We found your account."
            : kind === "unknown" ? "We couldn't check this email just now."
            : ""}
        </div>
      </div>

      {error && <div className="obreveal" style={{ ["--i" as string]: 0 }}><Err message={error} /></div>}

      {(kind === "password" || kind === "unknown") && (
        <div className="obreveal-group" key={kind}>
          <div className="obreveal" style={{ ["--i" as string]: 0 }}>
            <PasswordInput id="ob-password" label="Password" value={password} onChange={setPassword}
                           creating={false} disabled={disabled} />
          </div>
          <div className="obreveal obfoot" style={{ ["--i" as string]: 1 }}>
            <PressBox as="button" type="submit" className="btn primary" disabled={disabled || !password}
                      aria-busy={busy === "signin"}>
              {busy === "signin" ? "Signing in…" : "Sign in"}
            </PressBox>
          </div>
          <div className="obreveal obemail-links" style={{ ["--i" as string]: 2 }}>
            <button type="button" disabled={disabled} onClick={switchToCode}>Email me a code instead</button>
            <button type="button" disabled={disabled || resetWait > 0} onClick={() => void reset()}>
              {busy === "reset" ? "Sending…" : resetWait > 0 ? `Resend in ${resetWait}s` : resetAt !== null ? "Send the link again" : "Forgot password?"}
            </button>
          </div>
          {kind === "unknown" && (
            <div className="obreveal obemail-links" style={{ ["--i" as string]: 3 }}>
              <button type="button" disabled={disabled}
                      onClick={() => { hapticTick(); setPassword(""); setError(null); setKindAndTell("new"); }}>
                New to Axon? Create an account
              </button>
            </div>
          )}
          {notice && <p className="obemail-notice" role="status">{notice}</p>}
        </div>
      )}

      {kind === "new" && (
        <div className="obreveal-group" key="new">
          <div className="obreveal" style={{ ["--i" as string]: 0 }} ref={passwordWrap}>
            <PasswordInput id="ob-password" label="Password" value={password} onChange={setPassword}
                           creating disabled={disabled} onFocusChange={(f) => { if (f) setPasswordActive(true); }} />
          </div>
          {(passwordActive || password.length > 0) && (
            <div className="obreveal" style={{ ["--i" as string]: 0 }}><Requirements password={password} /></div>
          )}
          <div className="obreveal obfoot" style={{ ["--i" as string]: 1 }}>
            <PressBox as="button" type="submit" className="btn primary" disabled={disabled || !rulesMet}
                      aria-busy={busy === "create"}>
              {busy === "create" ? "Checking your password…" : "Email me a code"}
            </PressBox>
          </div>
          <p className="obemail-fine obreveal" style={{ ["--i" as string]: 2 }}>
            We'll send a code to confirm this email. Your password is checked against known breaches first.
          </p>
        </div>
      )}

      {kind === "code" && (
        <div className="obreveal-group" key="code">
          <div className="obreveal obfoot" style={{ ["--i" as string]: 0 }}>
            <PressBox as="button" type="submit" className="btn primary" disabled={disabled}>
              Email me a code
            </PressBox>
          </div>
        </div>
      )}

      {kind === "workos" && (
        <div className="obreveal-group" key="workos">
          <div className="obreveal obfoot" style={{ ["--i" as string]: 0 }}>
            <PressBox as="button" type="submit" className="btn primary" disabled={disabled}>
              Continue with a password
            </PressBox>
          </div>
          <div className="obreveal obemail-links" style={{ ["--i" as string]: 1 }}>
            <button type="button" disabled={disabled} onClick={switchToCode}>Email me a code instead</button>
          </div>
        </div>
      )}
    </form>
  );
}
