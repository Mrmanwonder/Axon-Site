// Confirm that the bytes the device says it uploaded are actually there.
//
// Not optional, and not a formality. Without a server-side HEAD a client can
// register a row for an object that was never uploaded, and the failure surfaces
// much later as a model call against a 404 — which looks like a model problem
// and is not. This is also where a size mismatch is caught, which is what a
// truncated PUT on a dropped connection looks like.

import { CORS, clientFor, failure, json, readJson, serviceClient } from '../_shared/http.ts';
import { type Bucket, deleteObject, headObject } from '../_shared/r2.ts';

interface Claim { bucket: Bucket; key: string; bytes: number; sha256?: string; etag?: string }
interface Body { paper_id: string; uploads: Claim[] }

const MAX_BYTES = 25 * 1024 * 1024;
const VALID_BUCKETS = new Set<Bucket>(['originals', 'derived']);

function validDeclaredSize(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= MAX_BYTES;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return failure('Method not allowed.', 405);

  const user = clientFor(req);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.paper_id || !Array.isArray(body.uploads) || !body.uploads.length) {
    return failure('Nothing to confirm.');
  }

  const { data: paper } = await user
    .from('paper').select('id, student_id').eq('id', body.paper_id).maybeSingle();
  if (!paper) return failure('That paper is not yours.', 403);

  const admin = serviceClient();
  const confirmed: string[] = [];
  const missing: { key: string; reason: string }[] = [];

  for (const claim of body.uploads) {
    // TypeScript types do not validate JSON. Refuse unknown bucket names and
    // missing/zero sizes before they reach the R2 helper.
    if (!VALID_BUCKETS.has(claim.bucket)) {
      missing.push({ key: claim.key ?? '', reason: 'that storage bucket is not valid' });
      continue;
    }
    if (!validDeclaredSize(claim.bytes)) {
      missing.push({ key: claim.key ?? '', reason: 'that file did not declare a valid size' });
      continue;
    }

    // A key outside the student's own prefix is not a mistake to tolerate.
    if (!claim.key?.startsWith(`${paper.student_id}/${paper.id}/`)) {
      missing.push({ key: claim.key ?? '', reason: 'that file does not belong to this paper' });
      continue;
    }

    let head;
    try {
      head = await headObject(claim.bucket, claim.key);
    } catch (cause) {
      missing.push({ key: claim.key, reason: `we could not check that file (${cause})` });
      continue;
    }

    if (!head) {
      missing.push({ key: claim.key, reason: 'that file did not arrive' });
      continue;
    }

    // Never trust the size declaration simply because the presigned PUT was
    // valid. The original implementation only compared sizes when the caller
    // supplied a truthy `bytes`, so omitting/zeroing it made the cap decorative.
    if (head.bytes > MAX_BYTES) {
      try { await deleteObject(claim.bucket, claim.key); } catch (cause) {
        console.error('upload-complete: failed to delete oversized object', claim.key, cause);
      }
      missing.push({ key: claim.key, reason: 'that file is too large' });
      continue;
    }
    if (claim.bytes !== head.bytes) {
      missing.push({ key: claim.key, reason: 'that file arrived incomplete or with an unexpected size' });
      continue;
    }

    const { error } = await admin.from('upload').update({
      confirmed: true,
      bytes: head.bytes,
      etag: head.etag,
      sha256: claim.sha256 ?? null,
    }).eq('paper_id', body.paper_id).eq('r2_key', claim.key);
    if (error) {
      missing.push({ key: claim.key, reason: 'we could not record that file as complete' });
      continue;
    }

    confirmed.push(claim.key);
  }

  // Say exactly which pages did not make it, so the client can retry those and
  // the student can see what is missing rather than a generic failure.
  return json({ confirmed, missing }, missing.length ? 409 : 200);
});
