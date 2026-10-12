// Asks the account-lookup function what kind of account an email belongs to, so
// the sign-in step can show the right form the moment the address is typed.
//
//   'new'      no account: offer to create one
//   'password' an account with a password: ask for it
//   'code'     an account that signs in with a code (Google or email code)
//   'unknown'  the check could not be made (offline, throttled, not deployed);
//              the screen falls back to a neutral form, never a guess
//
// Speed comes from three things: an address this browser has seen before is
// answered from its own memory with no network at all (and re-checked quietly
// afterwards), the function is woken before the first address is typed, and a
// superseded request is cancelled rather than waited for.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../config.js';
import { fetchWithTimeout } from '../request.js';

// Stricter than "something@something.xx": the auth server rejects what this lets
// through (a leading, trailing or doubled dot, a label that starts with a hyphen).
export const EMAIL_SHAPE = /^(?!\.)(?!.*\.\.)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+(?<!\.)@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
const ANSWERS = new Set(['new', 'password', 'code']);
const BASE = SUPABASE_URL.replace(/\/$/, '');
// One hop: the REST API straight to the database function (about 0.2 s), where
// the Edge Function took 1 to 2 s. The Edge Function stays as the fallback.
const DIRECT = BASE + '/rest/v1/rpc/account_lookup_public';
const ENDPOINT = BASE + '/functions/v1/account-lookup';
const DIRECT_HEADERS = { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY };
const STORE = 'axon.acct.v1';
const TTL_MS = 30 * 24 * 3600 * 1000;
const known = new Map();

export function normalisedEmail(value) { return String(value ?? '').trim().toLowerCase(); }

/* The browser keeps a short code for an address, never the address itself. It
   is for this device's own speed, not for secrecy: only 'password' and 'code'
   are kept, and each is re-checked on use. */
function short(email) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < email.length; i++) {
    const c = email.charCodeAt(i);
    a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}
function readStore() { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function writeStore(next) { try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* private mode */ } }
function remember(email, result) {
  known.set(email, result);
  const store = readStore(); const id = short(email);
  if (result === 'password' || result === 'code') store[id] = { r: result, t: Date.now() };
  else delete store[id];
  writeStore(store);
}

/** A previous answer for this email on this device, so the step opens already knowing. */
export function cachedAccount(emailInput) {
  const email = normalisedEmail(emailInput);
  if (known.has(email)) return known.get(email);
  const entry = readStore()[short(email)];
  if (entry && ANSWERS.has(entry.r) && Date.now() - entry.t < TTL_MS) { known.set(email, entry.r); return entry.r; }
  return null;
}

/* text/plain with no custom header is a CORS "simple" request: the browser sends
   it straight away instead of first asking permission with an OPTIONS round trip.
   The function reads the body as JSON whatever the content type says. */
const SIMPLE = { 'Content-Type': 'text/plain;charset=UTF-8' };

let warmed = false;
/** Wakes the function before the first real address is typed. Its answer is ignored. */
export function warmAccountLookup() {
  if (warmed) return;
  warmed = true;
  try {
    // An empty address answers 'invalid' and writes nothing. What it buys: the
    // TLS connection is open and the browser has the CORS preflight cached
    // (an hour) before the first real address is typed.
    void fetchWithTimeout(DIRECT, {
      method: 'POST', headers: DIRECT_HEADERS,
      body: JSON.stringify({ p_email: '' }), credentials: 'omit', cache: 'no-store',
    }).catch(() => {});
  } catch { /* nothing to warm */ }
}

/**
 * `fresh` skips the saved answer and asks the server (used to re-check one).
 * @param {string} emailInput
 * @param {{ signal?: AbortSignal, fresh?: boolean }} [options]
 */
export async function lookupAccount(emailInput, { signal, fresh = false } = {}) {
  const email = normalisedEmail(emailInput);
  if (!EMAIL_SHAPE.test(email)) return 'unknown';
  if (!fresh) { const saved = cachedAccount(email); if (saved) return saved; }
  const answer = async (response) => {
    if (!response.ok) return null;
    const body = await response.json();
    const result = typeof body === 'string' ? body : body?.result;
    return ANSWERS.has(result) ? result : null;
  };
  let result = null;
  try {
    const direct = await fetchWithTimeout(DIRECT, {
      method: 'POST', headers: DIRECT_HEADERS,
      body: JSON.stringify({ p_email: email }),
      credentials: 'omit', cache: 'no-store', signal,
    });
    result = await answer(direct);
  } catch (error) { if (signal?.aborted) return 'unknown'; }
  if (!result && !signal?.aborted) {
    try {
      const response = await fetchWithTimeout(ENDPOINT, {
        method: 'POST', headers: SIMPLE, body: JSON.stringify({ email }),
        credentials: 'omit', cache: 'no-store', signal,
      });
      result = await answer(response);
    } catch { /* offline or throttled: neutral form */ }
  }
  if (!result) return 'unknown';
  remember(email, result);   // 'unknown' is never kept, so a retry can succeed
  return result;
}

/** After this browser creates or confirms an account, any saved answer is stale. */
export function forgetAccount(emailInput) {
  const email = normalisedEmail(emailInput);
  known.delete(email);
  const store = readStore(); delete store[short(email)]; writeStore(store);
}
