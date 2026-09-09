/* ═══════════════════════════════════════════════════════════════════════════
   PARENT MODE

   The guardian is the only auth principal and the student is a profile under
   the guardian's session. That is deliberate — it is what keeps a child from
   needing an account, and what makes every RLS policy a single ownership
   check. The cost is that the phone in the student's hands holds the parent's
   authority, and the daily user of this app is a teenager.

   So a handful of actions need more than "this session owns the row". They
   need "a parent is here, now".

   ── What this module is not ──────────────────────────────────────────────

   It is not the boundary. The boundary is in the database — see
   20260909140000_parent_mode_authority_boundary.sql — where withdrawing
   consent, deleting papers, deleting a profile and deleting the account are
   refused for a session that has not re-authenticated recently. That refusal
   holds against a fetch typed into the console, which is the only version of
   this that means anything.

   What lives here is the part a person interacts with: asking whether the gate
   is currently open, opening it, and recognising the server's refusal when it
   is not. A component that forgets to call `ensureParentMode` produces a failed
   write and a clear message, not a breach.

   ── The proof ────────────────────────────────────────────────────────────

   Re-authenticating — a passkey, or a code to the parent's own email or phone —
   updates the session's `amr` claim, and the database reads the timestamp out
   of that. Nothing is minted, stored or expired on our side: the window closes
   on its own because the claim ages. A page reload cannot reopen it, because
   the reload carries the same token.
   ═══════════════════════════════════════════════════════════════════════════ */

import { sb } from '../../supabase.js';
import { signInWithPasskey, isPasskeySupported } from './passkeys';

/** What the server says about the current session's freshness. Advisory: every
    guarded action re-checks server-side, so a client that lies about this
    reaches nothing. */
export type ParentModeState = {
  fresh: boolean;
  /** How long the window is, so the UI need not hardcode it beside the SQL. */
  windowSeconds: number;
  ageSeconds: number | null;
  remainingSeconds: number;
  /** False means the token carries no `amr` claim at all — a configuration
      problem, not a parent who has been away. Different message, different fix,
      and impossible to tell apart from the refusal alone. */
  amrPresent: boolean;
};

export async function parentModeState(): Promise<ParentModeState> {
  const { data, error } = await sb.rpc('parent_mode_state');
  if (error) throw error;
  const d = data as Record<string, unknown>;
  return {
    fresh: Boolean(d.fresh),
    windowSeconds: Number(d.window_seconds ?? 900),
    ageSeconds: d.age_seconds == null ? null : Number(d.age_seconds),
    remainingSeconds: Number(d.remaining_seconds ?? 0),
    amrPresent: Boolean(d.amr_present),
  };
}

/**
 * Did the server refuse this because a parent was not present?
 *
 * Postgres gives 42501 to every RLS refusal and to our own raise, so the code
 * alone cannot separate "not yours" from "not now". The hint disambiguates the
 * RPC; for a policy refusal there is no hint to read, and the caller knows
 * which action it attempted — an action the UI only offers on rows the session
 * owns. Ownership failures are not a state a correct client can reach.
 */
export function isParentModeRequired(error: unknown): boolean {
  const e = error as { code?: string; hint?: string; message?: string } | null;
  if (!e) return false;
  if (e.hint === 'parent_mode_required') return true;
  if (e.code === '42501') return true;
  // An RLS policy that refuses an INSERT surfaces as a check violation rather
  // than a privilege error, and PostgREST reports it with its own code.
  return e.code === '42501' || e.code === 'PGRST301' || /row-level security/i.test(e.message ?? '');
}

export type UnlockOutcome =
  | { outcome: 'unlocked' }
  | { outcome: 'cancelled' }
  /** No passkey here, or none registered. The caller falls back to a code. */
  | { outcome: 'needs_code' }
  | { outcome: 'failed'; message: string };

/**
 * Unlock with a passkey — Face ID, Touch ID, or the device's screen lock.
 *
 * The right default on a shared family phone: the parent's face or fingerprint
 * is something the student standing next to them cannot supply, and it takes a
 * second rather than a round trip through an inbox.
 */
export async function unlockWithPasskey(): Promise<UnlockOutcome> {
  if (!isPasskeySupported()) return { outcome: 'needs_code' };
  try {
    const result = await signInWithPasskey();
    if (result.outcome === 'ok') return { outcome: 'unlocked' };
    if (result.outcome === 'cancelled') return { outcome: 'cancelled' };
    // 'no_credential' and 'unsupported' are both "not on this device", which is
    // a reason to offer the other route rather than to report a failure.
    if (result.outcome === 'no_credential' || result.outcome === 'unsupported') {
      return { outcome: 'needs_code' };
    }
    return { outcome: 'failed', message: "That didn't work." };
  } catch {
    return { outcome: 'needs_code' };
  }
}

/**
 * Send a code to the guardian's own contact.
 *
 * Deliberately the contact on the account rather than one typed in: a parent
 * proving they are present does not get to nominate where the proof goes, or
 * the check is one text field away from proving nothing.
 */
export async function sendParentCode(contact: string): Promise<void> {
  const value = contact.trim();
  const payload = /^\+?[0-9][0-9\s-]{6,}$/.test(value)
    ? { phone: value.replace(/[\s-]/g, '') }
    : { email: value };
  const { error } = await sb.auth.signInWithOtp({
    ...payload,
    // Never during a re-auth. The account exists — this is the parent proving
    // they are here, and a typo must fail rather than quietly create anything.
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function unlockWithCode(contact: string, code: string): Promise<UnlockOutcome> {
  const value = contact.trim();
  const token = String(code ?? '').replace(/\s/g, '');
  if (!token) return { outcome: 'cancelled' };
  const payload = /^\+?[0-9][0-9\s-]{6,}$/.test(value)
    ? { phone: value.replace(/[\s-]/g, ''), token, type: 'sms' as const }
    : { email: value, token, type: 'email' as const };
  const { error } = await sb.auth.verifyOtp(payload);
  if (error) return { outcome: 'failed', message: 'That code was not right.' };
  return { outcome: 'unlocked' };
}
