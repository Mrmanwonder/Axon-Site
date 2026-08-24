// The bindings and secrets every worker script needs, declared once.
//
// `wrangler.jsonc` wires the R2 buckets and queue producers per script — a
// consumer-only script simply has fewer of the producer bindings below than
// its own wrangler.jsonc declares, which is fine, they're all optional here.
//
// Secrets (`wrangler secret put`, never in a wrangler.jsonc): SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_ORIGINALS,
// R2_BUCKET_DERIVED, ASSET_SIGNING_SECRET.

import type { Queue, R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  // Secrets
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENROUTER_API_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ENDPOINT: string;
  R2_BUCKET_ORIGINALS: string;
  R2_BUCKET_DERIVED: string;
  ASSET_SIGNING_SECRET: string;
  MASTERY_SITE_URL?: string;
  MASTERY_ASSET_URL?: string;

  // R2 bindings — native access, no signing, for a worker's own reads/writes.
  ORIGINALS?: R2Bucket;
  DERIVED?: R2Bucket;

  // Queue producer bindings — present only on the scripts that send to them.
  TRIAGE_QUEUE?: Queue;
  STRUCTURE_QUEUE?: Queue;
  CONTENT_QUEUE?: Queue;
  RECONCILE_QUEUE?: Queue;
  ADJUDICATE_QUEUE?: Queue;
  EXPLAIN_QUEUE?: Queue;
  // No R2_DELETE_QUEUE binding: deletion is drained straight from the
  // r2_deletion Postgres table on mastery-sweep's cron tick, not through a
  // Cloudflare Queue — see workers/sweep/src/index.ts for why.
}
