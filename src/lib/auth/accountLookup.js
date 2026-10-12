// Asks the account-lookup function what kind of account an email belongs to, so
// the sign-in step can show the right form while the guardian is still typing.
//
//   'new'      no account: offer to create one
//   'password' an account with a password: ask for it
//   'code'     an account that signs in with a code (Google or email code)
//   'unknown'  the check could not be made (offline, throttled, not deployed);
//              the screen falls back to a neutral form, never a guess
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../config.js';
import { fetchWithTimeout } from '../request.js';

export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ANSWERS = new Set(['new', 'password', 'code']);
const known = new Map();

export function normalisedEmail(value) { return String(value ?? '').trim().toLowerCase(); }

/** A previous answer for this email in this tab, so returning to the step is instant. */
export function cachedAccount(emailInput) { return known.get(normalisedEmail(emailInput)) ?? null; }

export async function lookupAccount(emailInput, { signal } = {}) {
  const email = normalisedEmail(emailInput);
  if (!EMAIL_SHAPE.test(email)) return 'unknown';
  // 'unknown' is never cached, so a later retry can succeed.
  if (known.has(email)) return known.get(email);
  try {
    const response = await fetchWithTimeout(SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/account-lookup', {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'omit', cache: 'no-store', signal,
    });
    if (!response.ok) return 'unknown';
    const { result } = await response.json();
    if (!ANSWERS.has(result)) return 'unknown';
    known.set(email, result);
    return result;
  } catch { return 'unknown'; }
}

/** After this browser creates or confirms an account, the cached 'new' is stale. */
export function forgetAccount(emailInput) { known.delete(normalisedEmail(emailInput)); }
