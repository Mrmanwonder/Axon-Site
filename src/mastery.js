// The client for mastery-api — the one Cloudflare Worker the app ever talks
// to directly. workers/README.md, CLOUDFLARE_WORKERS.md §5.
//
// Every call carries the guardian's own Supabase session as a bearer token.
// mastery-api forwards it to PostgREST for the ownership-scoped queries
// (paper-submit's student lookup) and does an explicit ownership join for the
// routes that use the service role (upload-intent, upload-complete) — the
// same rule REVIEW_PIPELINE.md and CLOUDFLARE_WORKERS.md §5 both state: never
// trust an id from a request body, always prove it through the caller's own
// session first.

import { MASTERY_API_URL } from './config.js';
import { currentSession } from './supabase.js';

async function authHeader() {
  const session = await currentSession();
  if (!session) throw new Error('Sign in first.');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function post(path, body) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch(`${MASTERY_API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // The route's own message is the useful one — it was written for the
    // student, same as the old sb.functions.invoke error unwrapping.
    const message = data?.error || `That did not go through (${res.status}).`;
    const error = new Error(message);
    error.status = res.status;
    error.detail = data?.detail ?? null;
    throw error;
  }
  return data;
}

/** upload-intent — presigned R2 PUT URLs for a batch of objects. */
export function uploadIntent({ studentId, paperId, objects }) {
  return post('/upload-intent', { student_id: studentId, paper_id: paperId, objects });
}

/**
 * PUT bytes straight to R2 on a presigned URL. No Supabase involvement —
 * this is the whole point of the presigned-PUT shape (STORAGE_R2.md §5):
 * bytes never pass through a function or through PostgREST.
 */
export async function putToR2(url, blob, contentType) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}). Try again.`);
  return { etag: res.headers.get('ETag')?.replace(/"/g, '') ?? null };
}

/** upload-complete — confirm the bytes actually landed, before trusting the key. */
export function uploadComplete({ paperId, uploads }) {
  return post('/upload-complete', { paper_id: paperId, uploads });
}

/** paper-submit — files the pages against a paper the client already created, and queues triage. */
export function submitPaper(body) {
  return post('/paper-submit', body);
}

/** review-complete — starts stage 8, once every question has the student's eyes on it. */
export function reviewComplete(runId) {
  return post('/review-complete', { run_id: runId });
}

/**
 * Signed GET URLs for a batch of pages, for the review screen's crops
 * (src/scan/crops.js). Pages live in R2 now, not Supabase Storage, and the
 * signing secret is a Worker secret — the client asks mastery-api to mint
 * these rather than doing it itself.
 */
export function pageAssetUrls({ paperId, pageNumbers }) {
  return post('/page-asset-urls', { paper_id: paperId, page_numbers: pageNumbers });
}
