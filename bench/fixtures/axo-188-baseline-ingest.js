export async function ingest({ studentId, draft, paperType, dateTaken, onProgress, sendStartedAt, onTelemetry }) {
  const timing = uploadTiming({ startedAt: sendStartedAt, emit: onTelemetry });
  let submission; let paperId;
  const total = draft.pages.length;
  const say = (stage, message, extra = {}) => onProgress?.({ stage, message, ...extra });
  try {

if (!draft.pages.length) throw new Error('There are no pages to send yet.');
const pending = await timing.measure('planning', () => {
  const objects = draft.pages.flatMap(p => [
    { kind: 'page', blob: p.blob }, { kind: 'mask', blob: p.mask },
    { kind: 'thumb', blob: p.thumb },
    { kind: 'raw', blob: p.original && CAPTURE.UPLOAD_EXTENSIONS[p.original_type || p.original.type || 'image/jpeg'] ? p.original : null },
  ].filter(o => o.blob));
  timing.count(objects, draft.pages.length);
  return pendingPages(draft);
});


// ── the paper row ────────────────────────────────────────────────────────

paperId = draft.paper_id;
  const type = paperType ?? draft.paper_type;
  const taken = dateTaken ?? new Date().toISOString().slice(0, 10);

if (!paperId) {
  const paper = await timing.measure('paper_create', () => createPaper({ studentId, type, dateTaken: taken, requestId: draft.id }));
  paperId = paper.id;
  draft.paper_id = paperId;
  draft.paper_type = paper.type;
  await timing.measure('persistence', () => saveDraft(draft));
}

// A retry after a dropped connection must submit the same paper the same
// way, or the server sees a second booklet rather than the rest of the
// first one. One id, made once, kept for the life of the draft.
if (!draft.idempotency_key) {
  draft.idempotency_key = draft.id;
  await timing.measure('persistence', () => saveDraft(draft));
}

// ── stages 0-2 are already done; upload what has not landed ──────────────

  for (const page of pending) {
    say('upload', `Sending page ${page.page_number} of ${total}`, { page: page.page_number, of: total });
    const uploaded = await uploadScannedPage({ studentId, paperId, page, timing });
    await timing.measure('persistence', () => markUploaded(draft, page.page_number, uploaded));
  }

const pages = draft.pages.map((p) => ({
  page_number: p.page_number,
  // Recorded, not assumed. This was the literal string 'upload' on every page
  // ever submitted, camera captures included, which made the one question the
  // scanner's own telemetry exists to answer — is the camera path ever taken —
  // unanswerable (AXON_FIX_BRIEF.md §7.1). A draft written by an older build
  // has no source kind to report and says 'upload', which is what it was
  // recorded as; it is not re-guessed here.
  source_kind: p.source_kind ?? p.meta?.source_kind ?? 'upload',
  r2_bucket: p.r2_bucket,
  r2_key: p.r2_key,
  mask_key: p.mask_key ?? null,
  original_key: p.original_key ?? null,
  thumb_key: p.thumb_key ?? null,
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
  submission = await timing.measure('submit', () => submitPaper({
    student_id: studentId,
    type,
    tier: tierForType(type),
    date_taken: taken,
    paper_id: paperId,
    idempotency_key: draft.idempotency_key,
    pages,
  }, timing.retry));
  timing.finish(null, submission.queued);
  } catch (error) { timing.finish(error); throw error; }

// ── watch it move through triage, structure, content and reconciliation ──

const run = await waitForReview(submission.run_id, say);

if (run.processing) {
  return { paperId, runId: submission.run_id, processing: true, status: run.status };
}

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
