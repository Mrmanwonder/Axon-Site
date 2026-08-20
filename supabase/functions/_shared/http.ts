// Request plumbing shared by every pipeline function.
//
// One rule runs through all of it: user data is read and written as the user.
// The service role bypasses RLS, and a pipeline that ran as service_role would
// be one bug away from writing a student's marks into another student's paper.
// The only thing service_role is used for here is nothing at all.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
export function clientFor(req: Request): SupabaseClient | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try { return await req.json() as T; } catch { return null; }
}

/** Fetch a stored page as base64, for a vision request. */
export async function fetchPageBase64(
  sb: SupabaseClient, bucket: string, path: string,
): Promise<{ data: string; bytes: Uint8Array } | null> {
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { data: base64(bytes), bytes };
}

export function base64(bytes: Uint8Array): string {
  // Chunked, because a spread over an eight-megapixel page's worth of bytes
  // overflows the argument list and takes the whole function down with it.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const PAPERS_BUCKET = 'papers';
