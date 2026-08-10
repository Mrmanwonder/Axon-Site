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

export const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

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
  // shouldCreateUser: a guardian signing up and a guardian returning are the
  // same gesture, so we do not make them choose a path up front.
  const { error } = await sb.auth.signInWithOtp({ ...payload, options: { shouldCreateUser: true } });
  if (error) throw error;
  return { channel: isPhone(value) ? 'sms' : 'email', sentTo: value };
}

/** Exchange the code for a session. */
export async function verifyOtp(contact, token) {
  const value = contact.trim();
  const payload = isPhone(value)
    ? { phone: value.replace(/[\s-]/g, ''), token, type: 'sms' }
    : { email: value, token, type: 'email' };
  const { data, error } = await sb.auth.verifyOtp(payload);
  if (error) throw error;
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
