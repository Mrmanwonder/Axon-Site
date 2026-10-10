// Guardian credentials only. No student auth principal is created.
import { createClient } from '@supabase/supabase-js';
import { sb } from '../../supabase.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../config.js';
import { fetchWithTimeout } from '../request.js';
import { assertSafeNewPassword } from './passwordPolicy.js';

const ACCESS_ERROR = 'We could not complete that request. Check your details or try again later.';
const emailValue = value => String(value ?? '').trim().toLowerCase();
function requireEmail(value) {
  const email = emailValue(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter an email address.');
  return email;
}
function requirePassword(password) {
  if (typeof password !== 'string' || !password) throw new Error('Enter your password.');
}
function probeClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: fetchWithTimeout },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
async function installSession(session, email, expectedId = undefined) {
  if (!session?.user?.id || emailValue(session.user.email) !== email ||
      (expectedId && session.user.id !== expectedId)) throw new Error(ACCESS_ERROR);
  const { data, error } = await sb.auth.setSession({
    access_token: session.access_token, refresh_token: session.refresh_token,
  });
  if (error || !data?.session || data.session.user.id !== session.user.id ||
      emailValue(data.session.user.email) !== email) throw new Error(ACCESS_ERROR);
  return data.session;
}
export async function passwordSignIn(emailInput, password) {
  const email = requireEmail(emailInput); requirePassword(password);
  try {
    const { data, error } = await probeClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return await installSession(data?.session, email);
  } catch { throw new Error(ACCESS_ERROR); }
}
export async function passwordSignUp(emailInput, password) {
  const email = requireEmail(emailInput); requirePassword(password);
  // Show safe password-policy errors, but never expose account existence or Auth details.
  await assertSafeNewPassword(password);
  try {
    const { data, error } = await probeClient().auth.signUp({
      email, password, options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
    // Both an unconfirmed new account and an obfuscated existing account use
    // the same response. Never inspect identities to reveal account existence.
    return data?.session ? await installSession(data.session, email) : null;
  } catch { throw new Error(ACCESS_ERROR); }
}
export async function requestPasswordReset(emailInput) {
  const email = requireEmail(emailInput);
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname,
    });
    if (error) throw error;
  } catch { throw new Error(ACCESS_ERROR); }
}
export async function changePassword(password) {
  requirePassword(password);
  let expectedId;
  try {
    const { data: current, error: readError } = await sb.auth.getSession();
    if (readError || !current?.session?.user?.id) throw new Error(ACCESS_ERROR);
    expectedId = current.session.user.id;
  } catch { throw new Error(ACCESS_ERROR); }
  await assertSafeNewPassword(password);
  try {
    // A recovery session could have changed while HIBP was responding.
    const { data: latest, error: latestError } = await sb.auth.getSession();
    if (latestError || latest?.session?.user?.id !== expectedId) throw new Error(ACCESS_ERROR);
    const { data, error } = await sb.auth.updateUser({ password });
    if (error || data?.user?.id !== expectedId) throw new Error(ACCESS_ERROR);
  } catch { throw new Error(ACCESS_ERROR); }
}
export async function reauthenticateWithPassword(password) {
  requirePassword(password);
  try {
    const { data, error } = await sb.auth.getSession();
    const current = data?.session;
    if (error || !current?.user?.id || !current.user.email) throw new Error(ACCESS_ERROR);
    const email = emailValue(current.user.email);
    const { data: proof, error: proofError } = await probeClient().auth.signInWithPassword({ email, password });
    if (proofError) throw proofError;
    // Re-read after the request: a sign-out/account switch while it was in
    // flight must never reinstall the previous principal.
    const { data: latest, error: latestError } = await sb.auth.getSession();
    if (latestError || latest?.session?.user?.id !== current.user.id ||
        emailValue(latest.session.user.email) !== email) throw new Error(ACCESS_ERROR);
    await installSession(proof?.session, email, current.user.id);
  } catch { throw new Error(ACCESS_ERROR); }
}
