// The pipeline, end to end, from the client's side of it.
//
// Ten stages live in three places: 0 to 2 on the device, 3 to 8 on the server, 9
// in the student's hands and 10 back on the server. This is the thing that walks
// them in order, keeps the student told which one is running, and makes sure the
// order actually holds — in particular that no question is explained before its
// mark has survived reconciliation.
//
// Stages 3 to 8 run on Cloudflare (`mastery-*`, behind the `mastery-api` Worker)
// rather than as Supabase Edge Functions — a sixteen-page booklet's structure
// and content passes do not fit inside Supabase's 2-second CPU cap, and that is
// the whole reason this backend exists. Once `paper-submit` hands a run to that
// queue, this module has nothing left to call — it watches `extraction_run.status`
// change underneath it and narrates what it sees.
//
// Progress is reported per page and by name. "Reading page 3 of 6" tells someone
// waiting on a 4G connection that something is happening and roughly how much is
// left; a spinner tells them nothing, and a generic bar tells them something
// false. There is no bar and no spinner anywhere in here.

import { sb } from '../supabase.js';
import { createPaper, tierForType, uploadScannedPage } from '../papers.js';
import { processPage, makeProxy } from './device.js';
import { addPage, markUploaded, pendingPages, saveDraft } from './drafts.js';
import { pool, reviewComplete, submitPaper } from './functions.js';
import { CAPTURE } from './contract.js';

/**
 * Condition a captured frame, separate its layers, and put it in the draft.
 *
 * Runs the moment a page is accepted, not at upload, because this is where the
 * quality verdict comes from and the verdict is only useful while the paper is
 * still in front of the student.
 *
 * @param {{draft:Object, bitmap:ImageBitmap, quad:Array|null, replacing?:number, capturePath?:string, liveGate?:Object}} args
 */
export async function acceptPage({ draft, bitmap, quad, replacing = null, capturePath = null, liveGate = null }) {
  if (draft.pages.length >= CAPTURE.MAX_PAGES && replacing === null) {
    throw new Error(`A paper can hold ${CAPTURE.MAX_PAGES} pages. Start a second one for the rest.`);
  }

if (replacing !== null && !draft.pages.some((p) => p.page_number === replacing)) {
  throw new Error('That page is not in this booklet any more.');
}

const pageNumber = replacing ?? draft.pages.length + 1;
  const processed = await processPage(bitmap, { quad, pageNumber, capturePath, liveGate });
  const proxy = await makeProxy(processed.blob);

const page = {
  blob: processed.blob,
  // Computed from the decoded pixels before the page was encoded, which is the
  // whole reason it exists: a faint thin stroke the lossy page loses is still
  // at full strength here. See bench/README.md.
  mask: processed.mask,
  proxy,
  width: processed.width,
  height: processed.height,
  quality: processed.quality,
  meta: { ...processed.meta, coverage: processed.coverage },
  teacher_marks: processed.teacher_marks,
  margin_band: processed.margin_band,
  layer_fallback: processed.layer_fallback,
};

if (replacing !== null) {
  draft.pages = draft.pages.map((p) => (p.page_number === replacing
                                        ? { ...p, ...page, page_number: replacing, uploaded: false } : p));
  await saveDraft(draft);
} else {
  await addPage(draft, page);
}

return { draft, page: draft.pages.find((p) => p.page_number === pageNumber) };
}

// extraction_status, in order. Everything before 'needs_review' is server work
// this module only watches; 'needs_review' is where it hands control to the
// student, and 'rejected'/'failed' are the ways it can end before that.
const STAGE_FOR_STATUS = {
  queued: 'structure',
  triaging: 'structure',
  structure: 'structure',
  content: 'content',
  attribution: 'content',
  reconciliation: 'reconcile',
  adjudicating: 'reconcile',
};

const MESSAGE_FOR_STATUS = {
  queued: 'Waiting to start',
  triaging: 'Checking this is a marked paper',
  structure: 'Finding the questions',
  content: 'Reading the answers and the marking',
  attribution: 'Matching the marks to the questions',
  reconciliation: 'Checking the marks add up',
  adjudicating: 'Checking the marks add up',
};

const REVIEW_POLL_MS = 1500;
const REVIEW_TIMEOUT_MS = 5 * 60 * 1000;

/** Watch a run until it reaches a state the student needs to act on, or a refusal. */
async function waitForReview(runId, say) {
  const startedAt = Date.now();
  let lastStatus = null;

for (;;) {
  const { data: run, error } = await sb
  .from('extraction_run')
  .select('status, status_reason')
  .eq('id', runId)
  .single();
  if (error) throw error;

  if (run.status !== lastStatus) {
    lastStatus = run.status;
    say(STAGE_FOR_STATUS[run.status] ?? 'structure', MESSAGE_FOR_STATUS[run.status] ?? 'Working through the paper');
  }

  if (['needs_review', 'rejected', 'failed', 'ready', 'committed'].includes(run.status)) return run;

  if (Date.now() - startedAt > REVIEW_TIMEOUT_MS) {
    throw new Error('This is taking longer than expected. Your pages are saved — check back on this paper shortly.');
  }
  await new Promise((resolve) => setTimeout(resolve, REVIEW_POLL_MS));
}
}

/**
 * Send a draft up and run the server stages over it.
 *
 * Resumable at page granularity: a draft that was half uploaded when the
 * connection dropped picks up at the first page that has not landed, and nothing
 * is captured or uploaded twice.
 *
 * @param {(event: {stage:string, message:string, page?:number, of?:number}) => void} onProgress
 */
export async function ingest({ studentId, draft, paperType, dateTaken, onProgress }) {
  const say = (stage, message, extra = {}) => onProgress?.({ stage, message, ...extra });

if (!draft.pages.length) throw new Error('There are no pages to send yet.');

// ── the paper row ────────────────────────────────────────────────────────

let paperId = draft.paper_id;
  const type = paperType ?? draft.paper_type;
  const taken = dateTaken ?? new Date().toISOString().slice(0, 10);

if (!paperId) {
  const paper = await createPaper({ studentId, type, dateTaken: taken });
  paperId = paper.id;
  draft.paper_id = paperId;
  draft.paper_type = paper.type;
  await saveDraft(draft);
}

// A retry after a dropped connection must submit the same paper the same
// way, or the server sees a second booklet rather than the rest of the
// first one. One id, made once, kept for the life of the draft.
if (!draft.idempotency_key) {
  draft.idempotency_key = crypto.randomUUID();
  await saveDraft(draft);
}

// ── stages 0-2 are already done; upload what has not landed ──────────────

const pending = pendingPages(draft);
  const total = draft.pages.length;
  for (const page of pending) {
    say('upload', `Sending page ${page.page_number} of ${total}`, { page: page.page_number, of: total });
    const uploaded = await uploadScannedPage({ studentId, paperId, page });
    await markUploaded(draft, page.page_number, uploaded);
  }

const pages = draft.pages.map((p) => ({
  page_number: p.page_number,
  source_kind: 'upload',
  r2_bucket: p.r2_bucket,
  r2_key: p.r2_key,
  mask_key: p.mask_key ?? null,
  bytes: p.bytes ?? p.blob?.size ?? null,
  width: p.width,
  height: p.height,
  preprocess_version: p.meta?.preprocess_version,
  quality_verdict: p.quality?.verdict,
  quality_signals: p.quality?.signals,
  conditioning_meta: p.meta,
  layer_fallback: p.layer_fallback,
  teacher_marks: p.teacher_marks,
}));

// ── hand the booklet to the pipeline ─────────────────────────────────────

say('structure', `Finding the questions across ${total} page${total === 1 ? '' : 's'}`);
  const submission = await submitPaper({
    student_id: studentId,
    type,
    tier: tierForType(type),
    date_taken: taken,
    paper_id: paperId,
    idempotency_key: draft.idempotency_key,
    pages,
  });

// ── watch it move through triage, structure, content and reconciliation ──

const run = await waitForReview(submission.run_id, say);

if (run.status === 'rejected' || run.status === 'failed') {
  return {
    paperId,
    runId: submission.run_id,
    refused: true,
    message: run.status_reason || 'We could not read this paper. The pages are kept.',
  };
}

const { data: regions, error: regionsError } = await sb
  .from('question_region')
  .select('id, order_index, question_label')
  .eq('run_id', submission.run_id)
  .order('order_index');
  if (regionsError) throw regionsError;

say('reconcile', `${regions.length} question${regions.length === 1 ? '' : 's'} found`, { page: total, of: total });

return { paperId, runId: submission.run_id, refused: false, regions: regions ?? [] };
}

/**
 * The most recent extraction_run for a paper, if any.
 *
 * Used to re-enter review or report progress on a paper the student left
 * mid-flow — the draft only ever remembers `paper_id`; the run itself is
 * looked up fresh rather than persisted, so it is never stale.
 */
export async function currentRunForPaper(paperId) {
  const { data, error } = await sb
    .from('extraction_run')
    .select('id, status, status_reason')
    .eq('paper_id', paperId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** A run's regions, for `watchExplanations` — used when re-entering review
    on a run that was already `ingest()`-ed in a previous session. */
export async function regionsForRun(runId) {
  const { data, error } = await sb
    .from('question_region')
    .select('id, order_index, question_label')
    .eq('run_id', runId)
    .order('order_index');
  if (error) throw error;
  return data ?? [];
}

const EXPLAIN_POLL_MS = 1500;
const EXPLAIN_TIMEOUT_MS = 5 * 60 * 1000;
const EXPLAIN_SETTLED = new Set(['done', 'skipped', 'failed']);

/**
 * Stage 8's gate, and only its gate.
 *
 * `review-complete` refuses (409) while any region on the run still needs the
 * student's eyes — which is guaranteed at the moment a scan finishes, before
 * review has happened at all. Call this only once review is actually done:
 * after the outstanding-count guard passes, from `save()`. Calling it any
 * earlier is not a race, it is certain to 409, every time — that was the
 * whole bug (see AXON_FIX_BRIEF.md §4.A1).
 *
 * On success the server has already started every explanation it is willing
 * to run; use `watchExplanations` to wait for them.
 */
export async function startExplanations(runId) {
  return reviewComplete({ run_id: runId });
}

/**
 * Watch a paper's explanations land. Does not start them — call
 * `startExplanations` first and only once it has resolved.
 *
 * Deliberately separate from ingest and deliberately not awaited by it: a
 * student should be reading question 1's explanation while question 9 is
 * still generating. `onQuestion` fires per question as each lands, so a
 * caller that wants to paint the review screen while this runs still can;
 * `save()` is the one caller that also awaits the whole thing, so it knows
 * when every region has settled and it is safe to commit (see
 * AXON_FIX_BRIEF.md §6.2 — commit only after explanations, not before).
 */
export async function watchExplanations({ runId, regions, onQuestion }) {
  if (!regions?.length) return [];

const pending = new Map(regions.map((r) => [r.id, r]));
  const startedAt = Date.now();
  const results = [];

while (pending.size) {
  const { data: rows, error } = await sb
  .from('question_region')
  .select('id, explain_status')
  .in('id', [...pending.keys()]);
  if (error) throw error;

  for (const row of rows ?? []) {
    if (!EXPLAIN_SETTLED.has(row.explain_status)) continue;
    const region = pending.get(row.id);
    pending.delete(row.id);
    results.push(row);
    onQuestion?.({ regionId: row.id, status: row.explain_status, region, done: regions.length - pending.size, of: regions.length });
  }

  if (!pending.size) break;
  if (Date.now() - startedAt > EXPLAIN_TIMEOUT_MS) break; // whatever landed stays visible; the rest catches up on refresh
  await new Promise((resolve) => setTimeout(resolve, EXPLAIN_POLL_MS));
}

return results;
}
