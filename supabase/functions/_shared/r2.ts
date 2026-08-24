// Cloudflare R2, over the S3 API.
//
// STORAGE_R2.md. Two rules shape everything here:
//
//   · Bytes never pass through an Edge Function. A function has two seconds of
//     CPU, and a single 800KB body read and re-emit spends most of it. Devices
//     PUT straight to the bucket on a presigned URL, and the model provider GETs
//     straight from it on another one. This module mints URLs and deletes
//     objects; it never carries a payload.
//
//   · A presigned GET is a bearer capability to a minor's exam paper, held by a
//     third party, possibly in their request logs. So: ten minutes, never
//     logged, and keys that carry a nonce so one leaked URL says nothing about
//     its neighbours.
//
// aws4fetch rather than @aws-sdk/client-s3 on purpose. The SDK is hundreds of
// kilobytes with a large dependency graph, and its initialisation alone is a
// meaningful fraction of the CPU budget.

import { AwsClient } from 'npm:aws4fetch@1.0.20';

export type Bucket = 'originals' | 'derived';

/** Presigned PUT lifetime. Long enough for one page on bad 4G, plus a retry. */
export const PUT_TTL_SECONDS = 900;

/**
 * Presigned GET lifetime. Long enough for a slow provider fetch and one retry,
 * short enough that a leaked log line expires before it is useful.
 */
export const GET_TTL_SECONDS = 600;

let signer: AwsClient | null = null;

function client(): AwsClient {
  if (signer) return signer;
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are not set for this function');
  }
  // Region is always `auto` for R2; the endpoint decides where the bucket is.
  signer = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  return signer;
}

function endpoint(): string {
  const url = Deno.env.get('R2_ENDPOINT');
  if (!url) throw new Error('R2_ENDPOINT is not set for this function');
  return url.replace(/\/+$/, '');
}

export function bucketName(bucket: Bucket): string {
  const name = bucket === 'originals'
    ? Deno.env.get('R2_BUCKET_ORIGINALS')
    : Deno.env.get('R2_BUCKET_DERIVED');
  if (!name) throw new Error(`R2 bucket for '${bucket}' is not configured`);
  return name;
}

function objectUrl(bucket: Bucket, key: string): string {
  // Encode each segment but keep the slashes: R2 keys are paths, and encoding
  // the separator turns one object into a differently-named one.
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${endpoint()}/${bucketName(bucket)}/${path}`;
}

// ── keys ────────────────────────────────────────────────────────────────────
// {student_id} leads so erasure and export are both a prefix walk. The nonce is
// 16 random bytes: presigned URLs go to third parties, and key structure must
// not be an enumeration surface if one leaks.

export function nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export type ObjectKind = 'upload' | 'raw' | 'page' | 'mask' | 'crop' | 'cropmask' | 'thumb';

/** Which bucket a kind lives in. Originals expire after 30 days; derived do not. */
export const BUCKET_FOR: Record<ObjectKind, Bucket> = {
  upload: 'originals',
  raw: 'originals',
  page: 'derived',
  mask: 'derived',
  crop: 'derived',
  cropmask: 'derived',
  thumb: 'derived',
};

export function objectKey(opts: {
  studentId: string;
  paperId: string;
  kind: ObjectKind;
  /** Page index, question id, or upload id — whatever names this object. */
  name: string | number;
  extension: string;
  /** Thumbs are overwritten in place, so they take no nonce. */
  unguessable?: boolean;
}): string {
  const ext = opts.extension.replace(/^\./, '');
  const stem = opts.unguessable === false ? String(opts.name) : `${opts.name}-${nonce()}`;
  return `${opts.studentId}/${opts.paperId}/${opts.kind}/${stem}.${ext}`;
}

export function paperPrefix(studentId: string, paperId: string): string {
  return `${studentId}/${paperId}/`;
}

export function studentPrefix(studentId: string): string {
  return `${studentId}/`;
}

// ── presigning ──────────────────────────────────────────────────────────────

/** Presigned PUT for direct device upload. Bytes never touch an Edge Function. */
export async function presignPut(
  bucket: Bucket,
  key: string,
  contentType: string,
  ttlSeconds = PUT_TTL_SECONDS,
): Promise<string> {
  const url = new URL(objectUrl(bucket, key));
  url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
  const signed = await client().sign(
    new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }),
    { aws: { signQuery: true, allHeaders: false } },
  );
  return signed.url;
}

/** Presigned GET, handed to the model provider. Never log what this returns. */
export async function presignGet(
  bucket: Bucket,
  key: string,
  ttlSeconds = GET_TTL_SECONDS,
): Promise<string> {
  const url = new URL(objectUrl(bucket, key));
  url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
  const signed = await client().sign(new Request(url, { method: 'GET' }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

// ── verification ────────────────────────────────────────────────────────────

export interface ObjectHead { bytes: number; etag: string | null; contentType: string | null }

/**
 * Confirm an object is really there, and how big it is.
 *
 * Not optional after an upload. Without it a client can register a row for an
 * object that was never uploaded, and the failure surfaces much later as a
 * model call against a 404 — which looks like a model problem and is not.
 */
export async function headObject(bucket: Bucket, key: string): Promise<ObjectHead | null> {
  const res = await client().fetch(objectUrl(bucket, key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`r2 head failed ${res.status}`);
  const length = Number(res.headers.get('content-length') ?? '0');
  return {
    bytes: Number.isFinite(length) ? length : 0,
    etag: res.headers.get('etag')?.replace(/"/g, '') ?? null,
    contentType: res.headers.get('content-type'),
  };
}

// ── deletion ────────────────────────────────────────────────────────────────

/** A 404 is success: the object is not there, which is what was asked for. */
export async function deleteObject(bucket: Bucket, key: string): Promise<void> {
  const res = await client().fetch(objectUrl(bucket, key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`r2 delete failed ${res.status}`);
}

export interface PrefixDeletion { deleted: number; done: boolean; continuation?: string }

/**
 * Delete everything under a prefix, in bounded work.
 *
 * `maxKeys` exists because this runs inside a 2-second CPU budget and a paper
 * with sixteen pages has upward of fifty objects. The caller drains across
 * ticks: an unfinished walk returns done=false and the row stays on the queue,
 * which is what makes "deleted" mean deleted.
 */
export async function deletePrefix(
  bucket: Bucket,
  prefix: string,
  opts: { maxKeys?: number; continuation?: string } = {},
): Promise<PrefixDeletion> {
  const budget = opts.maxKeys ?? 200;
  let token = opts.continuation;
  let deleted = 0;

  while (deleted < budget) {
    const list = new URL(`${endpoint()}/${bucketName(bucket)}`);
    list.searchParams.set('list-type', '2');
    list.searchParams.set('prefix', prefix);
    list.searchParams.set('max-keys', String(Math.min(1000, budget - deleted)));
    if (token) list.searchParams.set('continuation-token', token);

    const res = await client().fetch(list.toString());
    if (!res.ok) throw new Error(`r2 list failed ${res.status}`);
    const xml = await res.text();

    // Deliberately crude. Correct for R2's ListObjectsV2 shape, and it avoids
    // pulling an XML parser into an isolate for one code path.
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => decodeXml(m[1]));
    for (const key of keys) {
      await deleteObject(bucket, key);
      deleted += 1;
    }

    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1];
    if (!token) return { deleted, done: true };
  }

  return { deleted, done: false, continuation: token };
}

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
