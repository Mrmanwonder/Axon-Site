// Request plumbing shared by every pipeline worker.
//
// One rule runs through all of it, unchanged from the Supabase version: user
// data is read and written as the user. The service role bypasses RLS, and a
// pipeline that ran as service_role would be one bug away from writing a
// student's marks into another student's paper. The only thing service_role
// is used for here is nothing at all — HTTP routes forward the caller's own
// JWT to PostgREST, and RLS decides what comes back.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './env.ts';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Say what went wrong, in words a student could act on.
 *
 * Hard rule 4 applies to errors as much as to pages: a failure the student
 * cannot see is a failure that looks like data loss. The paper is always
 * preserved; the message says what is missing and what to do.
 */
export function failure(message: string, status = 400, detail?: unknown): Response {
  return json({ error: message, detail: detail ?? null }, status);
}

/** A client carrying the caller's own JWT, so every query passes through RLS. */
export function clientFor(req: Request, env: Env): SupabaseClient | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

/**
 * A client that bypasses RLS. For the queue consumers only.
 *
 * Workers have no requester — they are woken by a queue delivery, not a
 * request — and the runtime tables they need (model_route, model_call,
 * r2_deletion) are deliberately unreadable to every authenticated role. So
 * they hold the service key, and every student row they touch is reached
 * through the id that was on the message, never through a query that could
 * return someone else's.
 *
 * The key lives in Worker secrets. It never reaches the client.
 */
export function serviceClient(env: Env): SupabaseClient {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set for this worker');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/** Authorise a service-to-service call between workers (unused once queues carry the work, kept for the sweep's HTTP-triggered paths). */
export function isServiceCall(req: Request, env: Env): boolean {
  const auth = req.headers.get('Authorization');
  return !!env.SUPABASE_SERVICE_ROLE_KEY && auth === `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`;
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try { return await req.json() as T; } catch { return null; }
}
