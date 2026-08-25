// The pipeline, end to end, from the client's side of it.
//
// Ten stages live in three places: 0 to 2 on the device, 3 to 8 on the server, 9
// in the student's hands and 10 back on the server. This is the thing that walks
// them in order, keeps the student told which one is running, and makes sure the
// order actually holds — in particular that no question is explained before its
// mark has survived review.
//
// Progress is reported per page and by name. "Reading page 3 of 6" tells someone
// waiting on a 4G connection that something is happening and roughly how much is
// left; a spinner tells them nothing, and a generic bar tells them something
// false. There is no bar and no spinner anywhere in here.
//
// Rewired for workers/README.md's Cloudflare pipeline (was: synchronous
// extract-structure / extract-content / extract-finalize Edge Functions).
// Pages upload straight to R2 on presigned PUTs instead of Supabase Storage,
// paper-submit queues stage 3 and returns immediately, and ingest() waits on
// extraction_run's own status rather than getting stages 3–6's results back
// in a response. Stage 8 (explainPaper, below) no longer runs right after
// ingest — REVIEW_PIPELINE.md §3 and the deployed w-explain worker both
// refuse to explain a question the student has not confirmed, so starting it
// before review is not a UI choice, it is a call the server no-ops. It now
// runs once review has nothing outstanding — see ui.js's call site.

import { createPaper } from '../papers.js';
import { putToR2, reviewComplete, submitPaper, uploadComplete, uploadIntent } from '../mastery.js';
import { processPage, makeProxy } from './device.js';
import { addPage, markUploaded, pendingPages, saveDraft } from './drafts.js';
import { messageForStatus, pollRun } from './functions.js';
import { CAPTURE } from './contract.js';

/**
 * Condition a captured frame, separate its layers, and put it in the draft.
 *
 * Runs the moment a page is accepted, not at upload, because this is where the
 * quality verdict comes from and the verdict is only useful while the paper is
 * still in front of the student.
 *
 * @param {{draft:Object, bitmap:ImageBitmap, quad:Array|null, replacing?:number}} args
 */
export async function acceptPage({ draft, bitmap, quad, replacing = null }) {
  if (draft.pages.length >= CAPTURE.MAX_PAGES && replacing === null) {
    throw new Error(`A paper can hold ${CAPTURE.MAX_PAGES} pages. Start a second one for the rest.`);
  }

  if (replacing !== null && !draft.pages.some((p) => p.page_number === replacing)) {
    throw new Error('That page is not in this booklet any more.');
  }

  const pageNumber = replacing ?? draft.pages.length + 1;
  const processed = await processPage(bitmap, { quad, pageNumber });
  // makeProxy still runs — it's what the review screen's fast preview uses
  // before the full page is fetchable — but the proxy itself is not uploaded
  // any more: mastery-structure reads the full page directly, per
  // workers/structure/src/index.ts, and has no proxy_path column to read.
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
      ? { ...p, ...page, page_number: replacing, uploaded: false, r2_page_key: null, r2_mask_key: null } : p));
    await saveDraft(draft);
  } else {
    await addPage(draft, page);
  }

  return { draft, page: draft.pages.find((p) => p.page_number === pageNumber) };
}

/**
 * Upload one page's bytes to R2 and confirm they landed.
 *
 * Two objects per page at most — the page itself, and its red-ink mask where
 * one exists. Presigned PUTs (STORAGE_R2.md §5): bytes go straight to R2,
 * never through mastery-api.
 */
async function uploadPageToR2({ studentId, paperId, page }) {
  const objects = [{
    kind: 'page', name: page.page_number,
    content_type: page.blob.type || 'image/jpeg', bytes: page.blob.size,
  }];
  if (page.mask) {
    objects.push({
      kind: 'mask', name: page.page_number, content_type: 'image/png', bytes: page.mask.size,
    });
  }

  const { objects: minted } = await uploadIntent({ studentId, paperId, objects });
  const pageObj = minted.find((o) => o.kind === 'page');
  const maskObj = minted.find((o) => o.kind === 'mask');

  const uploads = [];
  const { etag: pageEtag } = await putToR2(pageObj.url, page.blob, page.blob.type || 'image/jpeg');
  uploads.push({ bucket: pageObj.bucket, key: pageObj.key, bytes: page.blob.size, etag: pageEtag });

  if (maskObj) {
    const { etag: maskEtag } = await putToR2(maskObj.url, page.mask, 'image/png');
    uploads.push({ bucket: maskObj.bucket, key: maskObj.key, bytes: page.mask.size, etag: maskEtag });
  }

  const { missing } = await uploadComplete({ paperId, uploads });
  if (missing?.length) {
    throw new Error(missing[0].reason || `Page ${page.page_number} did not finish uploading. Try again.`);
  }

  return { pageKey: pageObj.key, maskKey: maskObj?.key ?? null };
}

/**
 * Send a draft up and start the server pipeline.
 *
 * Resumable at page granularity: a draft that was half uploaded when the
 * connection dropped picks up at the first page that has not landed, and nothing
 * is captured or uploaded twice. Waits for the run to reach `needs_review` (or a
 * refusal) before returning — everything from stage 3 through reconciliation now
 * happens off in Cloudflare Queues, so "done uploading" and "ready to read" are
 * no longer the same moment the way they were with the synchronous Edge
 * Functions.
 *
 * @param {(event: {stage:string, message:string, page?:number, of?:number}) => void} onProgress
 */
export async function ingest({ studentId, draft, paperType, dateTaken, onProgress }) {
  const say = (stage, message, extra = {}) => onProgress?.({ stage, message, ...extra });

  if (!draft.pages.length) throw new Error('There are no pages to send yet.');

  // ── the paper row ────────────────────────────────────────────────────────
  // Created here, directly, exactly as before — mastery-api's upload-intent
  // needs a real paper_id to check ownership against and to key R2 objects
  // under, so the paper has to exist before the first byte goes up. See
  // 20260825050000_submit_paper_accept_existing_draft.sql.

  let paperId = draft.paper_id;
  if (!paperId) {
    const paper = await createPaper({
      studentId,
      type: paperType ?? draft.paper_type,
      dateTaken: dateTaken ?? new Date().toISOString().slice(0, 10),
    });
    paperId = paper.id;
    draft.paper_id = paperId;
    draft.paper_type = paper.type;
    await saveDraft(draft);
  }

  // ── stages 0-2 are already done; upload what has not landed ──────────────

  const pending = pendingPages(draft);
  const total = draft.pages.length;
  for (const page of pending) {
    say('upload', `Sending page ${page.page_number} of ${total}`, { page: page.page_number, of: total });
    const { pageKey, maskKey } = await uploadPageToR2({ studentId, paperId, page });
    await markUploaded(draft, page.page_number, { pageKey, maskKey });
  }

  const pages = draft.pages.map((p) => ({
    page_number: p.page_number,
    r2_bucket: 'derived',
    r2_key: p.r2_page_key,
    mask_key: p.r2_mask_key,
    bytes: p.blob?.size,
    preprocess_version: 'v2',
    quality_verdict: p.quality?.verdict,
    quality_signals: p.quality?.signals ?? {},
    conditioning_meta: p.meta,
    layer_fallback: p.layer_fallback,
    teacher_marks: p.teacher_marks ?? [],
  }));

  // ── file the paper; stage 3 starts the moment this returns ──────────────

  say('structure', `Filing ${total} page${total === 1 ? '' : 's'}`);
  const submitted = await submitPaper({
    student_id: studentId,
    paper_id: paperId,
    type: draft.paper_type ?? paperType,
    subject: draft.subject ?? null,
    date_taken: dateTaken ?? new Date().toISOString().slice(0, 10),
    pages,
    idempotency_key: crypto.randomUUID(),
  });

  const runId = submitted.run_id;

  // ── wait for triage through reconciliation ───────────────────────────────

  const run = await pollRun(runId, {
    onStatus: (status) => say(stageKeyFor(status), messageForStatus(status), { page: total, of: total }),
  });

  if (run.status === 'rejected') {
    return { paperId, runId, refused: true, message: run.status_reason ?? 'This does not look like a marked exam paper.' };
  }
  if (run.status === 'failed') {
    throw new Error(run.status_reason ?? 'We could not finish reading this paper. Try again.');
  }

  return { paperId, runId, refused: false };
}

/** Maps an extraction_run status onto the progress rail's four named steps. */
function stageKeyFor(status) {
  if (['queued', 'triaging'].includes(status)) return 'upload';
  if (status === 'structure') return 'structure';
  if (['content', 'attribution'].includes(status)) return 'content';
  return 'reconcile'; // reconciliation, adjudicating, needs_review, ready, ...
}

/**
 * Stage 8, over a whole paper. Called once review has nothing outstanding —
 * see ui.js — never eagerly after ingest. mastery-api's /review-complete
 * refuses (409) while any question still needs the student's eyes, and
 * w-explain's own gate skips a question with no student_confirmed_at even if
 * it somehow got queued anyway. Explanations then land on their own schedule
 * via explain-queue; the caller is expected to keep polling question_region /
 * region_explanation the way review.js already does for corrections.
 */
export async function explainPaper(runId) {
  return reviewComplete(runId);
}
