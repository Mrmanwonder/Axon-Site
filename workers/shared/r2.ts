// R2 access from a Worker: bindings for the worker's own reads and writes, a
// presigned PUT for direct device upload, and a signed Worker route for the
// one case that needs a real fetchable URL — a third-party model provider.
//
// CLOUDFLARE_WORKERS.md §6. Two things carried over unchanged from
// STORAGE_R2.md: keys are never guessable (a nonce, because presigned and
// signed-route URLs both go to third parties), and {student_id} leads so
// erasure and export are both a prefix walk.

import { AwsClient } from 'aws4fetch';
import type { Env } from './env.ts';

export type Bucket = 'originals' | 'derived';

/** Presigned PUT lifetime. Long enough for one page on bad 4G, plus a retry. */
export const PUT_TTL_SECONDS = 900;

/**
 * Signed asset-route lifetime. Long enough for a slow provider fetch and one
 * retry, short enough that a leaked log line expires before it is useful.
 */
export const GET_TTL_SECONDS = 600;

export function bucketName(env: Env, bucket: Bucket): string {
  const name = bucket === 'originals' ? env.R2_BUCKET_ORIGINALS : env.R2_BUCKET_DERIVED;
  if (!name) throw new Error(`R2 bucket for '${bucket}' is not configured`);
  return name;
}

export function binding(env: Env, bucket: Bucket) {
  const b = bucket === 'originals' ? env.ORIGINALS : env.DERIVED;
  if (!b) throw new Error(`R2 binding for '${bucket}' is not attached to this worker`);
  return b;
}

// ── keys ────────────────────────────────────────────────────────────────────

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

// ── presigned PUT, for direct device upload ────────────────────────────────
// Kept on aws4fetch rather than a binding: the browser needs a URL it can PUT
// to directly, and only a signed S3-style URL gives it one without routing
// the bytes through a Worker.

function objectUrl(env: Env, bucket: Bucket, key: string): string {
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `${env.R2_ENDPOINT.replace(/\/+$/, '')}/${bucketName(env, bucket)}/${path}`;
}

function signer(env: Env): AwsClient {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials are not set for this worker');
  }
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
}

export async function presignPut(
  env: Env,
  bucket: Bucket,
  key: string,
  contentType: string,
  ttlSeconds = PUT_TTL_SECONDS,
): Promise<string> {
  const url = new URL(objectUrl(env, bucket, key));
  url.searchParams.set('X-Amz-Expires', String(ttlSeconds));
  const signed = await signer(env).sign(
    new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }),
    { aws: { signQuery: true, allHeaders: false } },
  );
  return signed.url;
}

// ── native reads, writes, deletes — via the binding, no signing at all ────
// The simplification CLOUDFLARE_WORKERS.md §6 and §12 point at: no aws4fetch,
// no XML parsing, for anything the worker itself does to the bucket.

export interface ObjectHead { bytes: number; etag: string | null; contentType: string | null }

/**
 * Confirm an object is really there, and how big it is.
 *
 * Not optional after an upload. Without it a client can register a row for an
 * object that was never uploaded, and the failure surfaces much later as a
 * model call against a 404 — which looks like a model problem and is not.
 */
export async function headObject(env: Env, bucket: Bucket, key: string): Promise<ObjectHead | null> {
  const obj = await binding(env, bucket).head(key);
  if (!obj) return null;
  return {
    bytes: obj.size,
    etag: obj.httpEtag?.replace(/"/g, '') ?? null,
    contentType: obj.httpMetadata?.contentType ?? null,
  };
}

/** A missing object is success: it is not there, which is what was asked for. */
export async function deleteObject(env: Env, bucket: Bucket, key: string): Promise<void> {
  await binding(env, bucket).delete(key);
}

export interface PrefixDeletion { deleted: number; done: boolean; cursor?: string }

/**
 * Delete everything under a prefix, in bounded work.
 *
 * `maxKeys` exists because a paper with sixteen pages has upward of fifty
 * objects and a queue consumer still has a wall-clock ceiling worth respecting
 * even though it is generous now. The caller drains across deliveries: an
 * unfinished walk returns done=false and the row stays claimable, which is
 * what makes "deleted" mean deleted.
 */
export async function deletePrefix(
  env: Env,
  bucket: Bucket,
  prefix: string,
  opts: { maxKeys?: number; cursor?: string } = {},
): Promise<PrefixDeletion> {
  const budget = opts.maxKeys ?? 200;
  const b = binding(env, bucket);
  let cursor = opts.cursor;
  let deleted = 0;

  while (deleted < budget) {
    const listing = await b.list({ prefix, limit: Math.min(1000, budget - deleted), cursor });
    if (listing.objects.length) {
      await Promise.all(listing.objects.map((o) => b.delete(o.key)));
      deleted += listing.objects.length;
    }
    if (listing.truncated) {
      cursor = listing.cursor;
    } else {
      return { deleted, done: true };
    }
  }

  return { deleted, done: false, cursor };
}

// ── signed asset route — the one place a real URL is still needed ─────────
// OpenRouter is a third-party HTTP service; it cannot use an R2 binding. An
// HMAC over the bucket, key and expiry, native to this stack and simpler than
// SigV4 because it never leaves it.

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

export async function signAssetUrl(
  env: Env,
  bucket: Bucket,
  key: string,
  ttlSeconds = GET_TTL_SECONDS,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const cryptoKey = await hmacKey(env.ASSET_SIGNING_SECRET);
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${bucket}:${key}:${exp}`));
  const sig = base64url(new Uint8Array(mac));
  const base = env.MASTERY_ASSET_URL ?? 'https://mastery-api.workers.dev';
  return `${base}/asset/${bucket}/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}`;
}

export async function verifyAssetSignature(
  env: Env,
  bucket: string,
  key: string,
  exp: number,
  sig: string,
): Promise<boolean> {
  if (!exp || exp < Date.now() / 1000) return false;
  const cryptoKey = await hmacKey(env.ASSET_SIGNING_SECRET);
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${bucket}:${key}:${exp}`));
  const expected = base64url(new Uint8Array(mac));
  return timingSafeEqual(expected, sig);
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** ImageRef the model client can use — a signed URL plus the key for the ledger. */
export async function imageRef(
  env: Env,
  bucket: Bucket,
  key: string,
  detail: 'low' | 'high' = 'high',
): Promise<{ url: string; key: string; detail: 'low' | 'high' }> {
  return { url: await signAssetUrl(env, bucket, key), key, detail };
}
