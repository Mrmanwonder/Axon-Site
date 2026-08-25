// mastery-api: the HTTP entry point. submit, upload, review-complete, and the
// signed asset route every worker's images resolve through.
//
// Ported from paper-submit, upload-intent, upload-complete and
// review-complete (supabase/functions/*/index.ts). All four keep running as
// the caller — Authorization is forwarded to PostgREST and RLS decides what
// is reachable — exactly as in the Supabase version. Nothing here needed the
// `jose`-based local JWT verification CLOUDFLARE_WORKERS.md §5 describes: the
// existing routes never had to resolve the caller's id themselves, because
// RLS proves ownership at the query rather than at an explicit join, and that
// pattern carries over unchanged.

import { CORS, clientFor, failure, json, readJson, serviceClient } from '../../shared/http.ts';
import {
  BUCKET_FOR, type Bucket, headObject, type ObjectKind, objectKey,
  presignPut, PUT_TTL_SECONDS, signAssetUrl, verifyAssetSignature,
} from '../../shared/r2.ts';
import { PIPELINE_VERSION } from '../../shared/contract.ts';
import type { Env } from '../../shared/env.ts';

const MAX_PAGES = 25;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_OBJECTS = 60;

const ALLOWED_CONTENT_TYPES: Record<string, string[]> = {
  'image/webp': ['webp'],
  'image/jpeg': ['jpg'],
  'image/png': ['png'],
  'image/heic': ['heic'],
  'application/pdf': ['pdf'],
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');

    try {
      if (path === '/asset' || path.startsWith('/asset/')) return await serveAsset(req, env, url);
      if (req.method !== 'POST') return failure('not found', 404);

      switch (path) {
        case '/paper-submit': return await paperSubmit(req, env);
        case '/upload-intent': return await uploadIntent(req, env);
        case '/upload-complete': return await uploadComplete(req, env);
        case '/review-complete': return await reviewComplete(req, env);
        case '/page-asset-urls': return await pageAssetUrls(req, env);
        default: return failure('not found', 404);
      }
    } catch (cause) {
      console.error('mastery-api unhandled error', String(cause));
      return failure('Something went wrong on our end. Nothing was lost — try again.', 500);
    }
  },
};

// ── the signed asset route ──────────────────────────────────────────────────
// GET /asset/:bucket/:key?exp=...&sig=... — what every presigned GET in the
// Supabase version becomes. CLOUDFLARE_WORKERS.md §6: an HMAC over a string,
// no SigV4, and a Worker route this codebase controls end to end.

async function serveAsset(req: Request, env: Env, url: URL): Promise<Response> {
  const parts = url.pathname.split('/').filter(Boolean); // ['asset', bucket, ...key]
  if (parts.length < 3 || parts[0] !== 'asset') return failure('not found', 404);
  const bucket = parts[1];
  const key = decodeURIComponent(parts.slice(2).join('/'));
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') ?? '';

  if (bucket !== 'originals' && bucket !== 'derived') return failure('unknown bucket', 400);
  const ok = await verifyAssetSignature(env, bucket, key, exp, sig);
  if (!ok) return failure('expired or invalid', 403);

  const binding = bucket === 'originals' ? env.ORIGINALS : env.DERIVED;
  if (!binding) return failure('asset storage is not configured', 500);

  const obj = await binding.get(key);
  if (!obj) return failure('not found', 404);

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=60',
    },
  });
}

// ── paper-submit ─────────────────────────────────────────────────────────────

interface PageInput {
  page_number: number;
  r2_bucket?: string;
  r2_key: string;
  mask_key?: string | null;
  original_key?: string | null;
  thumb_key?: string | null;
  bytes?: number;
  sha256?: string;
  etag?: string;
  preprocess_version?: string;
  quality_verdict?: string;
  quality_signals?: Record<string, unknown>;
  conditioning_meta?: Record<string, unknown>;
  layer_fallback?: string | null;
  teacher_marks?: unknown[];
}

interface SubmitBody {
  student_id: string;
  // Set when the client already created the paper row itself (to get a real
  // id to key R2 uploads under, via upload-intent — see
  // src/scan/pipeline.js). submit_paper finishes that row instead of minting
  // a second one; see 20260825050000_submit_paper_accept_existing_draft.sql.
  paper_id?: string | null;
  type: string;
  tier?: 'tier_1' | 'tier_2';
  // Nullable at the schema level (paper.subject), and the client has no
  // subject-selection UI yet — nothing forces a value here that the DB
  // itself does not require.
  subject?: string | null;
  date_taken?: string;
  pages: PageInput[];
  idempotency_key: string;
  reported_total?: number | null;
  stated_maximum?: number | null;
}

async function paperSubmit(req: Request, env: Env): Promise<Response> {
  const user = clientFor(req, env);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<SubmitBody>(req);
  if (!body?.student_id || !body?.type || !body?.idempotency_key) {
    return failure('That paper is missing something we need to file it.');
  }
  if (!Array.isArray(body.pages) || !body.pages.length) return failure('A paper needs at least one page.');
  if (body.pages.length > MAX_PAGES) return failure(`We can take up to ${MAX_PAGES} pages in one paper.`);
  if (body.pages.some((p) => !p.r2_key || !Number.isInteger(p.page_number) || p.page_number < 1)) {
    return failure('One of those pages has not finished uploading.');
  }

  const { data, error } = await user.rpc('submit_paper', {
    p_student_id: body.student_id,
    p_type: body.type,
    p_tier: body.tier ?? 'tier_1',
    p_date_taken: body.date_taken ?? null,
    p_subject: body.subject ?? null,
    p_pages: body.pages,
    p_idempotency_key: body.idempotency_key,
    p_reported_total: body.reported_total ?? null,
    p_stated_maximum: body.stated_maximum ?? null,
    p_pipeline_version: PIPELINE_VERSION,
    p_paper_id: body.paper_id ?? null,
  });

  if (error) return failure('We could not save that paper. Nothing was lost — try again.', 500, error.message);

  const runId = (data as { run_id: string; created: boolean }).run_id;
  const admin = serviceClient(env);

  // Enqueue once. A resubmit reuses the run in flight, and a second triage
  // message against the same run would pay for the same call twice.
  const { data: run } = await admin.from('extraction_run').select('status').eq('id', runId).single();

  if (run?.status === 'queued') {
    if (!env.TRIAGE_QUEUE) return json({ ...(data as object), queued: false, reason: 'Reading has not started yet.' }, 202);
    try {
      await env.TRIAGE_QUEUE.send({ run_id: runId });
      await admin.rpc('run_advance', { p_run_id: runId, p_to: 'queued' });
    } catch {
      // The paper is saved. Say so, and say the reading has not started yet,
      // rather than reporting a success the student will watch not happen.
      return json({ ...(data as object), queued: false, reason: 'Reading has not started yet.' }, 202);
    }
  }

  return json({ ...(data as object), queued: true }, 202);
}

// ── upload-intent ────────────────────────────────────────────────────────────

interface RequestedObject { kind: ObjectKind; name: string | number; content_type: string; bytes?: number }
interface UploadIntentBody { student_id: string; paper_id: string; objects: RequestedObject[] }

async function uploadIntent(req: Request, env: Env): Promise<Response> {
  const user = clientFor(req, env);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<UploadIntentBody>(req);
  if (!body?.student_id || !body?.paper_id || !Array.isArray(body.objects) || !body.objects.length) {
    return failure('Nothing to upload.');
  }
  if (body.objects.length > MAX_OBJECTS) return failure(`That is more than ${MAX_OBJECTS} files in one go.`);

  const { data: paper } = await user
    .from('paper').select('id, student_id')
    .eq('id', body.paper_id).eq('student_id', body.student_id).maybeSingle();
  if (!paper) return failure('That paper is not yours.', 403);

  const admin = serviceClient(env);
  const minted: { kind: ObjectKind; name: string | number; bucket: string; key: string; url: string; upload_id?: string }[] = [];

  for (const object of body.objects) {
    const extensions = ALLOWED_CONTENT_TYPES[object.content_type];
    if (!extensions) return failure(`We cannot take a ${object.content_type} file.`);
    if (object.bytes && object.bytes > MAX_BYTES) return failure('One of those files is too large to upload.');
    if (!BUCKET_FOR[object.kind]) return failure('Unknown file kind.');

    const bucket: Bucket = BUCKET_FOR[object.kind];
    const key = objectKey({
      studentId: body.student_id, paperId: body.paper_id, kind: object.kind, name: object.name,
      extension: extensions[0],
    });

    const entry = {
      kind: object.kind, name: object.name, bucket, key,
      url: await presignPut(env, bucket, key, object.content_type),
    } as (typeof minted)[number];

    if (object.kind === 'upload' || object.kind === 'raw') {
      const { data: row } = await admin.from('upload').insert({
        paper_id: body.paper_id, student_id: body.student_id,
        kind: object.content_type === 'application/pdf' ? 'pdf' : 'image',
        r2_bucket: bucket, r2_key: key, content_type: object.content_type,
      }).select('id').single();
      entry.upload_id = row?.id;
    }

    minted.push(entry);
  }

  return json({ objects: minted, expires_in: PUT_TTL_SECONDS });
}

// ── upload-complete ──────────────────────────────────────────────────────────

interface Claim { bucket: Bucket; key: string; bytes?: number; sha256?: string; etag?: string }
interface UploadCompleteBody { paper_id: string; uploads: Claim[] }

async function uploadComplete(req: Request, env: Env): Promise<Response> {
  const user = clientFor(req, env);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<UploadCompleteBody>(req);
  if (!body?.paper_id || !Array.isArray(body.uploads) || !body.uploads.length) return failure('Nothing to confirm.');

  const { data: paper } = await user.from('paper').select('id, student_id').eq('id', body.paper_id).maybeSingle();
  if (!paper) return failure('That paper is not yours.', 403);

  const admin = serviceClient(env);
  const confirmed: string[] = [];
  const missing: { key: string; reason: string }[] = [];

  for (const claim of body.uploads) {
    if (!claim.key?.startsWith(`${paper.student_id}/${paper.id}/`)) {
      missing.push({ key: claim.key ?? '', reason: 'that file does not belong to this paper' });
      continue;
    }

    let head;
    try {
      head = await headObject(env, claim.bucket, claim.key);
    } catch (cause) {
      missing.push({ key: claim.key, reason: `we could not check that file (${cause})` });
      continue;
    }

    if (!head) { missing.push({ key: claim.key, reason: 'that file did not arrive' }); continue; }
    if (claim.bytes && claim.bytes !== head.bytes) {
      missing.push({ key: claim.key, reason: 'that file arrived incomplete' });
      continue;
    }

    await admin.from('upload').update({
      confirmed: true, bytes: head.bytes, etag: head.etag, sha256: claim.sha256 ?? null,
    }).eq('paper_id', body.paper_id).eq('r2_key', claim.key);

    confirmed.push(claim.key);
  }

  return json({ confirmed, missing }, missing.length ? 409 : 200);
}

// ── page-asset-urls ────────────────────────────────────────────────────────
// Pages live in R2, not Supabase Storage, so the review screen's crops
// (src/scan/crops.js) need a signed URL the same shape as the one every
// worker mints for itself via imageRef — but the HMAC secret is a Worker
// secret, never shipped to the client, so the client asks for one instead of
// minting it. Ownership is proven the same way every other route here proves
// it: the query runs as the caller, through RLS, so a page belonging to
// another student's paper simply is not among the rows returned.

interface PageAssetBody { paper_id: string; page_numbers: number[] }

async function pageAssetUrls(req: Request, env: Env): Promise<Response> {
  const user = clientFor(req, env);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<PageAssetBody>(req);
  if (!body?.paper_id || !Array.isArray(body.page_numbers) || !body.page_numbers.length) {
    return failure('Which pages?');
  }

  const { data: pages, error } = await user
    .from('paper_page')
    .select('page_number, r2_bucket, r2_key, mask_key')
    .eq('paper_id', body.paper_id)
    .in('page_number', body.page_numbers);
  if (error) return failure('We could not look up those pages.', 500, error.message);

  const urls: Record<number, { url: string | null; mask_url: string | null }> = {};
  for (const page of pages ?? []) {
    const bucket = (page.r2_bucket ?? 'derived') as Bucket;
    urls[page.page_number as number] = {
      url: page.r2_key ? await signAssetUrl(env, bucket, page.r2_key as string) : null,
      mask_url: page.mask_key ? await signAssetUrl(env, bucket, page.mask_key as string) : null,
    };
  }

  return json({ urls });
}

// ── review-complete ──────────────────────────────────────────────────────────

interface ReviewCompleteBody { run_id: string }

async function reviewComplete(req: Request, env: Env): Promise<Response> {
  const user = clientFor(req, env);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<ReviewCompleteBody>(req);
  if (!body?.run_id) return failure('Which paper?');

  const { data: run } = await user.from('extraction_run').select('id, status').eq('id', body.run_id).maybeSingle();
  if (!run) return failure('That paper is not yours.', 403);

  const { count } = await user
    .from('question_region')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', body.run_id).eq('needs_review', true).is('student_confirmed_at', null);

  if ((count ?? 0) > 0) {
    return failure(
      `${count} question${count === 1 ? '' : 's'} still need${count === 1 ? 's' : ''} your eyes.`,
      409,
      { outstanding: count },
    );
  }

  const admin = serviceClient(env);
  const { data: begin, error } = await admin.rpc('begin_explanations', { p_run_id: body.run_id });
  if (error) return failure('We could not start the explanations. Your corrections are saved.', 500, error.message);

  const regionIds = (begin?.region_ids ?? []) as string[];
  if (env.EXPLAIN_QUEUE) {
    for (const regionId of regionIds) {
      await env.EXPLAIN_QUEUE.send({ run_id: body.run_id, region_id: regionId });
    }
  }

  return json({ run_id: body.run_id, explaining: begin?.queued ?? 0 });
}
