// Supabase client and auth.
//
// Auth is passwordless: email or phone OTP, or Google or Apple. Only the
// guardian ever holds credentials; the student works inside the guardian's
// session and is never an auth user.
//
// A provider sign-in changes who vouches for the email address and nothing
// else. It does not shorten the flow: the guardian row, the age gate,
// verification and consent all still happen, because none of them is something
// Google or Apple can assert on a parent's behalf.

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

/** Providers offered on the account step, in the order they are shown. */
export const OAUTH_PROVIDERS = ['google', 'apple'];

export const PROVIDER_LABEL = { google: 'Google', apple: 'Apple' };

/**
 * Hand off to Google or Apple.
 *
 * This navigates away, so nothing after it runs on success — a resolved promise
 * only means the redirect was accepted. The session comes back in the URL on
 * return and `detectSessionInUrl` above picks it up, which is the same path the
 * emailed link already uses.
 */
export async function signInWithProvider(provider) {
  if (!OAUTH_PROVIDERS.includes(provider)) {
    throw new Error(`Unknown sign-in provider: ${provider}`);
  }
  // Which provider we left with, so the message on the way back can name it.
  // Session storage rather than local: it belongs to this attempt in this tab,
  // and a stale value would misattribute a later failure.
  try { sessionStorage.setItem(ATTEMPT_KEY, provider); } catch { /* private mode */ }
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: {
      // Same reason as the OTP path: back to wherever the app is actually
      // running, not to whatever the project's Site URL happens to say.
      redirectTo: window.location.origin + window.location.pathname,
      // A shared family device is the normal case here, so never silently
      // resume whichever Google account the browser saw last.
      ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
    },
  });
  if (error) throw error;
}

const ATTEMPT_KEY = 'mastery.oauthAttempt';

/**
 * True when the failure is the provider not being switched on in the Supabase
 * project, rather than anything the parent did. Worth telling apart: the raw
 * message is developer-facing and reads like the parent's account is at fault.
 */
export function isProviderNotEnabled(error) {
  return /provider is not enabled|unsupported provider|provider.*disabled/i
    .test(error?.message ?? error?.description ?? '');
}

/**
 * Read a failed provider round trip out of the URL we were returned to.
 *
 * `signInWithOAuth` navigates away, so it does not reject when the provider is
 * refused — the failure comes back as `error` and `error_description` on the
 * return URL instead, in the query string or the fragment depending on where it
 * gave up. Without reading them the parent lands back on a blank first screen
 * with no idea why, which is exactly the silent failure the project forbids.
 *
 * The params are stripped from the address bar on the way out, so a reload does
 * not resurrect an error that has already been shown and dealt with.
 *
 * @returns {{provider:string|null, code:string, description:string, message:string}|null}
 */
export function takeProviderError() {
  const url = new URL(window.location.href);
  const frag = new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('error') || frag.get('error');
  if (!code) return null;

  const description =
    url.searchParams.get('error_description') || frag.get('error_description') || '';
  let provider = null;
  try {
    provider = sessionStorage.getItem(ATTEMPT_KEY);
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch { /* private mode */ }

  for (const k of ['error', 'error_code', 'error_description']) {
    url.searchParams.delete(k);
    frag.delete(k);
  }
  const rest = frag.toString();
  url.hash = rest ? `#${rest}` : '';
  history.replaceState(null, '', url.toString());

  const name = PROVIDER_LABEL[provider] ?? 'That provider';
  let message;
  if (/access_denied/i.test(code)) {
    // Backing out is a decision, not a fault. Say what happened and stop.
    message = `${name} sign-in was cancelled.`;
  } else if (isProviderNotEnabled({ message: `${code} ${description}` })) {
    message = `${name} sign-in isn't switched on yet. Use your email or phone instead.`;
  } else {
    message = description || `${name} sign-in didn't complete.`;
  }
  return { provider, code, description, message };
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
