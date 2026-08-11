// Supabase client and auth.
//
// Auth is email or phone OTP only — no passwords, no social sign-in. Only the
// guardian ever holds credentials; the student works inside the guardian's
// session and is never an auth user.

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// The UMD bundle is vendored rather than loaded from a CDN, so the app has no
// third-party runtime dependency and keeps working offline. Fail with something
// legible if it did not load, instead of a bare destructuring TypeError.
if (!window.supabase?.createClient) {
  throw new Error(
    'vendor/supabase.umd.js did not load, so the client cannot be created. ' +
      'Check that it is present and served alongside index.html.',
  );
}
const { createClient } = window.supabase;

// Snapshot the URL before the client is constructed. `detectSessionInUrl` reads
// the fragment and then strips it, so anything we want to say about a failed
// link has to be taken now — a moment later it is gone and the app simply shows
// the landing page as though nothing had been attempted.
const LANDED_WITH = { hash: location.hash, search: location.search };

export const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Must stay true. Supabase's Magic Link template is what `signInWithOtp`
    // uses, and unless that template contains {{ .Token }} it sends a *link*
    // rather than a code. With this false, clicking that link did nothing: the
    // session arrives in the URL fragment and was being ignored.
    detectSessionInUrl: true,
  },
});

/**
 * Why the emailed link did not sign anyone in, in words worth showing.
 *
 * Supabase reports a failed verification by redirecting back with the reason in
 * the fragment, which the client then discards. Read once at boot, from the
 * snapshot taken above; returns null when the landing was ordinary.
 *
 * `otp_expired` is the common one and it is usually not the guardian's fault:
 * scanners and mail previews follow links, and the token is spent by whoever
 * touches it first. So the message points at the code rather than blaming them.
 */
export function authRedirectError() {
  const from = (s) => new URLSearchParams(String(s ?? '').replace(/^[#?]/, ''));
  for (const params of [from(LANDED_WITH.hash), from(LANDED_WITH.search)]) {
    const code = params.get('error_code');
    const error = params.get('error');
    if (!code && !error) continue;
    if (code === 'otp_expired' || /expired|invalid/i.test(params.get('error_description') ?? '')) {
      return 'That link had already been used — mail apps often open links before you do. ' +
        'Ask for a new code and type the six digits instead.';
    }
    if (error === 'access_denied') return 'That link did not sign you in. Ask for a new code and type it here.';
    return (params.get('error_description') || 'That link did not work.').replace(/\+/g, ' ');
  }
  return null;
}

/**
 * Drop auth debris from the address bar.
 *
 * The success path is cleaned by the client itself, but a failed verification
 * leaves `#error=…` sitting there, and a reload would then re-report an error
 * the guardian has already read and moved past.
 */
export function clearAuthParamsFromUrl() {
  if (!/error|access_token|token_hash/.test(location.hash + location.search)) return;
  history.replaceState(null, '', location.pathname);
}

/** True when the string looks like a phone number rather than an email. */
export function isPhone(contact) {
  return /^\+?[0-9][0-9\s-]{6,}$/.test(contact.trim());
}

/** Send a one-time code to an email address or phone number. */
export async function sendOtp(contact) {
  const value = contact.trim();
  const payload = isPhone(value)
    ? { phone: value.replace(/[\s-]/g, '') }
    : { email: value };
  const { error } = await sb.auth.signInWithOtp({
    ...payload,
    options: {
      // A guardian signing up and a guardian returning are the same gesture, so
      // we do not make them choose a path up front.
      shouldCreateUser: true,
      // Point any emailed link back at wherever the app is actually running,
      // rather than at whatever the project's Site URL happens to be. Without
      // this, a stale Site URL sends people to a dead host.
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) throw new Error(sendFailureMessage(error, isPhone(value)));
  return { channel: isPhone(value) ? 'sms' : 'email', sentTo: value };
}

/**
 * Turn a send failure into something a parent can act on.
 *
 * The two that actually happen are worth naming. The rate limit is per address
 * and short, so "wait" is the whole answer. A 5xx from the mail step usually
 * means the project's SMTP is not configured to reach addresses outside the
 * team — a setup problem on our side, and saying so is better than letting
 * someone retype their address believing they got it wrong.
 */
function sendFailureMessage(error, phone) {
  const raw = error?.message ?? '';
  if (error?.status === 429 || /rate limit/i.test(raw)) {
    return 'That was a lot of requests in a row. Wait a minute, then ask again.';
  }
  if (error?.status >= 500 || /error sending|smtp/i.test(raw)) {
    return phone
      ? 'The message could not be sent. This one is on us, not you — try again shortly.'
      : 'The email could not be sent. This one is on us, not you — try again shortly.';
  }
  if (/invalid|malformed/i.test(raw)) {
    return phone
      ? 'That phone number does not look complete. Include the country code, like +91.'
      : 'That email address does not look complete.';
  }
  return raw || 'That code could not be sent.';
}

/**
 * Pull a verification token out of a pasted magic link.
 *
 * Supabase sends a link instead of a code unless the Magic Link email template
 * contains {{ .Token }}. Rather than leave someone stranded when it does, the
 * code field accepts the whole link and we take the token out of it. Handles
 * both the ?token_hash=… form and the #access_token=… fragment the redirect
 * lands with.
 *
 * @returns {{kind:'hash', token_hash:string, type:string}
 *          |{kind:'session', access_token:string, refresh_token:string}
 *          |null}
 */
export function tokenFromPastedLink(text) {
  const value = String(text ?? '').trim();
  if (!/^https?:\/\//i.test(value)) return null;
  let url;
  try { url = new URL(value); } catch { return null; }

  const frag = new URLSearchParams(url.hash.replace(/^#/, ''));
  const q = url.searchParams;

  const access = frag.get('access_token');
  const refresh = frag.get('refresh_token');
  if (access && refresh) return { kind: 'session', access_token: access, refresh_token: refresh };

  const hash = q.get('token_hash') || frag.get('token_hash');
  if (hash) return { kind: 'hash', token_hash: hash, type: q.get('type') || frag.get('type') || 'email' };

  // /auth/v1/verify?token=…&type=magiclink — the raw token, not a hash
  const token = q.get('token');
  if (token) return { kind: 'hash', token_hash: token, type: q.get('type') || 'magiclink' };

  return null;
}

/**
 * Exchange a code — or a pasted link — for a session.
 *
 * Accepting the link is not a nicety: with the default email template there is
 * no code to type, and a link that Gmail has already prefetched is dead by the
 * time it is clicked. Pasting it still works, because the token is only
 * consumed by the POST we make here.
 */
export async function verifyOtp(contact, input) {
  const value = contact.trim();
  const raw = String(input ?? '').trim();

  const fromLink = tokenFromPastedLink(raw);
  if (fromLink) {
    if (fromLink.kind === 'session') {
      const { data, error } = await sb.auth.setSession({
        access_token: fromLink.access_token,
        refresh_token: fromLink.refresh_token,
      });
      if (error) throw error;
      return data.session;
    }
    const { data, error } = await sb.auth.verifyOtp({
      token_hash: fromLink.token_hash,
      type: fromLink.type,
    });
    if (error) throw error;
    return data.session;
  }

  const token = raw.replace(/\s/g, '');
  const payload = isPhone(value)
    ? { phone: value.replace(/[\s-]/g, ''), token, type: 'sms' }
    : { email: value, token, type: 'email' };
  const { data, error } = await sb.auth.verifyOtp(payload);
  if (error) {
    // A spent or timed-out code is the ordinary case, not an error condition
    // worth alarming anyone about. Say what to do instead of what went wrong.
    if (/expired|invalid|not found/i.test(error.message ?? '')) {
      throw new Error('That code has expired or has already been used. Ask for a new one.');
    }
    throw error;
  }
  return data.session;
}

export async function currentSession() {
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export async function signOut() {
  await sb.auth.signOut();
}

export function onAuthChange(fn) {
  return sb.auth.onAuthStateChange((_event, session) => fn(session));
}

/** The guardian row for the current session, or null before onboarding. */
export async function currentGuardian() {
  const session = await currentSession();
  if (!session) return null;
  const { data, error } = await sb
    .from('guardian')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
