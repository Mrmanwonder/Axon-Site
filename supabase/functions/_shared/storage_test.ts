// Unit tests for the two clients that stand between the pipeline and everything
// outside it: the bucket, and the model provider.
//
// Neither can be tested end to end without credentials, and neither needs to be
// to check the parts that are decisions rather than plumbing — the shape of a
// key, what a signed URL commits to, which failures are worth retrying, and
// whether the retention policy can be relaxed by accident.
//
//   deno test --allow-env supabase/functions/_shared/storage_test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  BUCKET_FOR, GET_TTL_SECONDS, nonce, objectKey, paperPrefix, presignGet, presignPut, studentPrefix,
} from './r2.ts';
import { classify, PROVIDER_POLICY } from './openrouter.ts';

const STUDENT = 'aaaaaaaa-0000-4000-8000-000000000002';
const PAPER = 'aaaaaaaa-0000-4000-8000-000000000003';

Deno.env.set('R2_ACCESS_KEY_ID', 'test-access-key');
Deno.env.set('R2_SECRET_ACCESS_KEY', 'test-secret-key');
Deno.env.set('R2_ENDPOINT', 'https://acct.r2.cloudflarestorage.com');
Deno.env.set('R2_BUCKET_ORIGINALS', 'axon-originals');
Deno.env.set('R2_BUCKET_DERIVED', 'axon-derived');

// ── keys ────────────────────────────────────────────────────────────────────

Deno.test('a key leads with the student, so erasure is one prefix walk', () => {
  const key = objectKey({ studentId: STUDENT, paperId: PAPER, kind: 'page', name: 1, extension: 'webp' });
  assert(key.startsWith(`${STUDENT}/${PAPER}/page/`), key);
  assert(key.startsWith(studentPrefix(STUDENT)));
  assert(key.startsWith(paperPrefix(STUDENT, PAPER)));
});

Deno.test('a key is not guessable from the ids it contains', () => {
  const a = objectKey({ studentId: STUDENT, paperId: PAPER, kind: 'page', name: 1, extension: 'webp' });
  const b = objectKey({ studentId: STUDENT, paperId: PAPER, kind: 'page', name: 1, extension: 'webp' });
  // Same student, same paper, same page — and a different object. A presigned
  // URL goes to a third party, so knowing one key must say nothing about its
  // neighbours.
  assert(a !== b, 'two keys for the same page came out identical');
});

Deno.test('the nonce is url-safe and long enough to matter', () => {
  const n = nonce();
  assert(/^[A-Za-z0-9_-]{20,}$/.test(n), n);
  assertEquals(new Set(Array.from({ length: 200 }, nonce)).size, 200);
});

Deno.test('originals and derived are split by kind, not by prefix convention', () => {
  // The thirty-day expiry is a bucket-level rule. If a raw capture were filed
  // under derived it would outlive its retention, quietly.
  assertEquals(BUCKET_FOR.raw, 'originals');
  assertEquals(BUCKET_FOR.upload, 'originals');
  assertEquals(BUCKET_FOR.page, 'derived');
  assertEquals(BUCKET_FOR.mask, 'derived');
  assertEquals(BUCKET_FOR.crop, 'derived');
});

// ── presigning ──────────────────────────────────────────────────────────────

Deno.test('a presigned PUT names the object and expires', async () => {
  const key = objectKey({ studentId: STUDENT, paperId: PAPER, kind: 'raw', name: 2, extension: 'heic' });
  const url = new URL(await presignPut('originals', key, 'image/heic'));

  assertEquals(url.host, 'acct.r2.cloudflarestorage.com');
  assertStringIncludes(url.pathname, 'axon-originals');
  assertStringIncludes(url.pathname, STUDENT);
  assertEquals(url.searchParams.get('X-Amz-Expires'), '900');
  assert(url.searchParams.get('X-Amz-Signature'));
  // Query-signed, so the device sends bytes and nothing else.
  assert(!url.searchParams.get('X-Amz-SignedHeaders')?.includes('authorization'));
});

Deno.test('a presigned GET lasts ten minutes and no longer', async () => {
  const url = new URL(await presignGet('derived', `${STUDENT}/${PAPER}/crop/q1.webp`));
  assertEquals(url.searchParams.get('X-Amz-Expires'), String(GET_TTL_SECONDS));
  assertEquals(GET_TTL_SECONDS, 600);
});

Deno.test('a key keeps its slashes when it is signed', async () => {
  // Encoding the separator would sign a differently-named, non-existent object,
  // and the failure would arrive later as a 404 that looks like a missing page.
  const url = new URL(await presignGet('derived', `${STUDENT}/${PAPER}/crop/q1.webp`));
  assertStringIncludes(url.pathname, `/${STUDENT}/${PAPER}/crop/q1.webp`);
});

// ── the provider policy ─────────────────────────────────────────────────────

Deno.test('the retention policy is what it claims to be', () => {
  assertEquals(PROVIDER_POLICY.zdr, true);
  assertEquals(PROVIDER_POLICY.data_collection, 'deny');
  assertEquals(PROVIDER_POLICY.require_parameters, true);
});

// ── failure classification ──────────────────────────────────────────────────

Deno.test('transient failures retry and permanent ones do not', () => {
  assert(classify(429, 'slow down').retryable);
  assert(classify(503, 'upstream').retryable);
  assert(!classify(401, 'bad key').retryable);
  assert(!classify(402, 'no credit').retryable);
  assert(!classify(400, 'schema rejected').retryable);
});

Deno.test('a model with no compliant endpoint says so, rather than looking like a typo', () => {
  const err = classify(404, 'No endpoints found matching your data policy');
  assertEquals(err.code, 'no_compliant_provider');
  assert(!err.retryable, 'retrying an unsatisfiable policy burns four more attempts');
  assertStringIncludes(err.message, 'zero-data-retention');
});
