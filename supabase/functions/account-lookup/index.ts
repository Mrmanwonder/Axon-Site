// Tells the account step whether an email is new, signs in with a password, or
// signs in with a code. Answers one word. See the migration for why this exists
// and how it is bounded (20261012090000_account_lookup.sql).
//
// Deploy with --no-verify-jwt: the caller is a signed-out browser holding only
// the publishable key, which is not a JWT.

import { CORS, failure, json, readJson, serviceClient } from '../_shared/http.ts';

const VALID = new Set(['new', 'password', 'code', 'throttled', 'invalid']);

async function clientKey(req: Request): Promise<string> {
  const ip = (req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]
    ?? 'unknown').trim();
  const salt = Deno.env.get('ACCOUNT_LOOKUP_SALT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return failure('Use POST.', 405);
  try {
    const body = await readJson<{ email?: unknown }>(req);
    if (typeof body?.email !== 'string') return failure('Enter an email address.', 400);
    const { data, error } = await serviceClient().rpc('account_lookup', {
      p_email: body.email,
      p_client: await clientKey(req),
    });
    if (error || typeof data !== 'string' || !VALID.has(data)) {
      return failure('The check is unavailable right now.', 503);
    }
    return json({ result: data });
  } catch {
    return failure('The check is unavailable right now.', 503);
  }
});
