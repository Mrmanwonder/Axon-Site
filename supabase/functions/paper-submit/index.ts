// The client has uploaded its conditioned pages. This makes the paper real and
// puts it on the queue.
//
// No model calls, no image work, one round trip. Everything that has to be
// atomic — the paper, its pages and its run — happens inside submit_paper(),
// which runs as the caller so RLS proves the student belongs to them.
//
// Idempotent on a key the device mints before its first attempt. A retried
// submit from a dropped connection is the normal case here, not the edge case,
// and two papers from one booklet would double every model call downstream.

import { CORS, clientFor, failure, json, readJson, serviceClient } from '../_shared/http.ts';
import { PIPELINE_VERSION } from '../_shared/contract.ts';

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
}

interface Body {
  student_id: string;
  type: string;
  tier?: 'tier_1' | 'tier_2';
  subject: string;
  date_taken?: string;
  pages: PageInput[];
  idempotency_key: string;
  reported_total?: number | null;
  stated_maximum?: number | null;
}

const MAX_PAGES = 25;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const user = clientFor(req);
  if (!user) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.student_id || !body?.subject || !body?.type || !body?.idempotency_key) {
    return failure('That paper is missing something we need to file it.');
  }
  if (!Array.isArray(body.pages) || !body.pages.length) {
    return failure('A paper needs at least one page.');
  }
  if (body.pages.length > MAX_PAGES) {
    return failure(`We can take up to ${MAX_PAGES} pages in one paper.`);
  }
  if (body.pages.some((p) => !p.r2_key || !Number.isInteger(p.page_number) || p.page_number < 1)) {
    return failure('One of those pages has not finished uploading.');
  }

  const { data, error } = await user.rpc('submit_paper', {
    p_student_id: body.student_id,
    p_type: body.type,
    p_tier: body.tier ?? 'tier_1',
    p_date_taken: body.date_taken ?? null,
    p_subject: body.subject,
    p_pages: body.pages,
    p_idempotency_key: body.idempotency_key,
    p_reported_total: body.reported_total ?? null,
    p_stated_maximum: body.stated_maximum ?? null,
    p_pipeline_version: PIPELINE_VERSION,
  });

  if (error) return failure('We could not save that paper. Nothing was lost — try again.', 500, error.message);

  const runId = (data as { run_id: string; created: boolean }).run_id;
  const admin = serviceClient();

  // Enqueue once. A resubmit reuses the run in flight, and a second triage
  // message against the same run would pay for the same call twice — so the
  // enqueue is skipped when the run has already moved past queued.
  const { data: run } = await admin
    .from('extraction_run').select('status').eq('id', runId).single();

  if (run?.status === 'queued') {
    const { error: queueError } = await admin.rpc('pgmq_send', {
      queue_name: 'axon_triage',
      msg: { run_id: runId },
    });
    if (queueError) {
      // The paper is saved. Say so, and say the reading has not started, rather
      // than reporting a success the student will watch not happen.
      return json({ ...(data as object), queued: false, reason: 'Reading has not started yet.' }, 202);
    }
    await admin.rpc('run_advance', { p_run_id: runId, p_to: 'queued' });
  }

  return json({ ...(data as object), queued: true }, 202);
});
