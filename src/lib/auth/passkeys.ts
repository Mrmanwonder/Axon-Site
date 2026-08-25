/* ═══════════════════════════════════════════════════════════════════════════
   PASSKEYS

   Supabase's native passkey support (WebAuthn, beta) is explicitly called out
   as an API that can change without notice. Every call into it lives here and
   nowhere else — no component calls `sb.auth.registerPasskey()` or
   `sb.auth.signInWithPasskey()` directly — so a shape change during the beta,
   or a decision to switch passkeys off, is a one-file fix.

   Registering a passkey requires an existing, confirmed, non-anonymous user.
   That is a real ordering constraint, not a suggestion: a brand-new parent
   cannot sign up with a passkey, because there is no account yet for the
   authenticator to attach to. Email OTP verifies the account first
   (supabase.js#sendOtp / verifyOtp); this module is only ever reached
   afterwards, either to register a passkey for next time or to sign back in
   with one already registered.
   ═══════════════════════════════════════════════════════════════════════════ */

import { sb } from '../../supabase.js';

/** A row from `auth.passkey.list()`, trimmed to what Settings shows. Nothing
    else is kept client-side — Supabase Auth is the store of record for the
    credential itself. */
export type Passkey = {
  id: string;
  friendly_name: string | null;
  created_at: string;
};

/** Plain-language outcomes a screen can switch on, instead of matching raw
    Supabase error codes (or their message strings) in component code. */
export type PasskeyOutcome =
  | 'ok'
  | 'unsupported'        // this browser/device has no WebAuthn platform authenticator
  | 'cancelled'           // the person dismissed the OS prompt — not a failure
  | 'no_credential'       // webauthn_credential_not_found — route to OTP, not a dead end
  | 'already_registered'  // webauthn_credential_exists — this device already has one
  | 'too_many'            // too_many_passkeys
  | 'disabled'            // passkey_disabled — a config bug, never meant to reach a user
  | 'error';

const OUTCOME_CODE: Record<string, PasskeyOutcome> = {
  webauthn_credential_not_found: 'no_credential',
  webauthn_credential_exists: 'already_registered',
  too_many_passkeys: 'too_many',
  passkey_disabled: 'disabled',
};

/** Copy for every outcome that is meant to reach a person. `disabled` is
    deliberately absent — see `classify`. */
export const PASSKEY_MESSAGE: Partial<Record<PasskeyOutcome, string>> = {
  unsupported: "This device doesn't support passkeys.",
  no_credential: "No passkey found on this device — we'll email you a code instead.",
  already_registered: "This device already has a passkey for this account.",
  too_many: "You've set up several passkeys already. Remove one in Settings before adding another.",
  error: "That didn't work. Try again, or use your email code.",
};

/** True when the platform can plausibly do a passkey ceremony at all. Not a
    guarantee — the OS prompt is the real test — but enough to decide whether
    to offer the button in the first place. */
export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.PublicKeyCredential !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.credentials;
}

/** WebAuthn's own cancellation signal, distinct from every real failure below
    it — the person backed out of the OS prompt, which the flow must treat as
    "nothing happened," not an error state. */
function isCancellation(error: unknown): boolean {
  const e = error as { name?: string } | null;
  return e?.name === 'NotAllowedError' || e?.name === 'AbortError';
}

function classify(error: unknown): PasskeyOutcome {
  if (isCancellation(error)) return 'cancelled';
  const code = (error as { code?: string } | null)?.code;
  if (code && code in OUTCOME_CODE) return OUTCOME_CODE[code];
  return 'error';
}

/**
 * Register a passkey for the signed-in user.
 *
 * Only ever called after a confirmed session exists — see the module note.
 * The WebAuthn ceremony itself (biometric / PIN / security-key prompt) is
 * entirely OS-driven; nothing here draws UI for it.
 */
export async function registerPasskey(): Promise<
  { outcome: 'ok'; friendlyName: string | null } | { outcome: PasskeyOutcome }
> {
  if (!isPasskeySupported()) return { outcome: 'unsupported' };
  try {
    const { data, error } = await (sb.auth as any).registerPasskey();
    if (error) return { outcome: classify(error) };
    return { outcome: 'ok', friendlyName: data?.friendly_name ?? data?.friendlyName ?? null };
  } catch (e) {
    return { outcome: classify(e) };
  }
}

/**
 * Sign in with a discoverable credential — no email typed, the authenticator
 * resolves the account. A cancelled OS prompt and "no passkey on this
 * device" both come back as a plain outcome rather than a thrown error, so
 * the sign-in screen can fall through to OTP without a dead-end error state.
 */
export async function signInWithPasskey(): Promise<
  { outcome: 'ok' } | { outcome: PasskeyOutcome }
> {
  if (!isPasskeySupported()) return { outcome: 'unsupported' };
  try {
    const { error } = await (sb.auth as any).signInWithPasskey();
    if (error) return { outcome: classify(error) };
    return { outcome: 'ok' };
  } catch (e) {
    return { outcome: classify(e) };
  }
}

/** Every passkey registered for the current session's account. */
export async function listPasskeys(): Promise<Passkey[]> {
  const { data, error } = await (sb.auth as any).passkey.list();
  if (error) throw error;
  return (data ?? []) as Passkey[];
}

/** Account hygiene, not a sensitive action — no re-auth challenge, per the
    same reasoning the rest of Settings uses for non-destructive changes. */
export async function renamePasskey(passkeyId: string, friendlyName: string): Promise<void> {
  const { error } = await (sb.auth as any).passkey.update({ passkeyId, friendlyName });
  if (error) throw error;
}

export async function deletePasskey(passkeyId: string): Promise<void> {
  const { error } = await (sb.auth as any).passkey.delete({ passkeyId });
  if (error) throw error;
}
