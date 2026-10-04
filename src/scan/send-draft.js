import { buildUploadPlan, processingReady, backupComplete, assetState, revisionOf, assertUploadSnapshot } from './upload-plan.js';
import { uploadDraftAssets } from './upload-runner.js';
import { uploadTiming } from './upload-telemetry.js';
export function submissionPage(page) {
  return {
    page_number: page.page_number, source_kind: page.source_kind ?? page.meta?.source_kind ?? 'upload',
    r2_bucket: page.r2_bucket, r2_key: page.r2_key, mask_key: page.mask_key ?? null,
    thumb_key: page.thumb_key ?? null, original_key: page.original_key ?? null,
    bytes: page.bytes ?? page.blob?.size ?? null, width: page.width, height: page.height,
    preprocess_version: page.meta?.preprocess_version, quality_verdict: page.quality?.verdict,
    quality_signals: page.quality?.signals, conditioning_meta: { ...page.meta, upload_revision: revisionOf(page) },
    layer_fallback: page.layer_fallback, teacher_marks: page.teacher_marks,
  };
}
/** Full durable handoff, separate from the potentially long processing watch. */
export async function sendDraft({ studentId, draft, paperType, dateTaken, mode = 'legacy',
  earlySubmit = false, concurrency = 3, signal, sendStartedAt, onTelemetry, onProgress }, services) {
  const timing = uploadTiming({ startedAt: sendStartedAt, emit: onTelemetry, mode });
  const callerSignal = signal, controller = new AbortController();
  const cancel = () => controller.abort(callerSignal.reason);
  if (callerSignal?.aborted) cancel(); else callerSignal?.addEventListener('abort', cancel, { once: true });
  signal = controller.signal;
  let stopHeartbeat = () => {};
  const owner = services.newId();
  let leased = false;
  const snapshot = draft.pages.map(p => ({ page_number: p.page_number, upload_revision: p.upload_revision }));
  const persist = action => timing.measure('persistence', action);
  try {
    if (!draft.pages.length || draft.student_id !== studentId) throw new Error('Open a draft for this student before sending.');
    signal?.throwIfAborted();
    const plan = await timing.measure('planning', () => buildUploadPlan(draft));
    timing.count(plan, draft.pages.length);
    await persist(() => services.claimSendLease(draft, owner)); leased = true;
    stopHeartbeat = services.startLeaseHeartbeat?.(draft, owner, error => controller.abort(error)) ?? (() => {});
    assertUploadSnapshot(draft, snapshot);
    const type = paperType ?? draft.paper_type;
    const taken = draft.date_taken ?? dateTaken ?? new Date().toISOString().slice(0, 10);
    if (!draft.paper_id) {
      const paper = await timing.measure('paper_create', () => services.createPaper({ studentId, type, dateTaken: taken, requestId: draft.id }));
      await persist(() => services.mutateDraft(draft, fresh => {
        services.assertLease(fresh, owner); assertUploadSnapshot(fresh, snapshot);
        if (fresh.paper_id && fresh.paper_id !== paper.id) throw new Error('This draft already belongs to another paper.');
        fresh.paper_id = paper.id; fresh.paper_type = paper.type; fresh.date_taken = taken; fresh.idempotency_key ??= fresh.id;
      }));
    } else if (!draft.idempotency_key || !draft.date_taken) {
      await persist(() => services.mutateDraft(draft, fresh => {
        services.assertLease(fresh, owner); fresh.idempotency_key ??= fresh.id; fresh.date_taken ??= taken;
      }));
    }
    const paperId = draft.paper_id;
    if (!draft.submission_started && !draft.submission) {
      await uploadDraftAssets({ draft, studentId, paperId, mode, criticalOnly: earlySubmit, concurrency,
        signal, timing, onProgress, transport: services.transport,
        persist: (d, updates) => services.updateAssets(d, updates, owner),
        guard: () => persist(() => services.touchSendLease(draft, owner)) });
      await persist(() => services.mutateDraft(draft, fresh => {
        services.assertLease(fresh, owner); assertUploadSnapshot(fresh, snapshot);
        if (!fresh.pages.every(processingReady)) throw new Error('Some processing files are still unconfirmed.');
        if (!earlySubmit && !fresh.pages.every(page => !page.original && !page.upload_assets?.raw && !page.original_key || assetState(page, 'raw').status === 'confirmed' && Boolean(page.original_key))) throw new Error('Some originals are still unconfirmed.');
        // Frozen before POST: a lost response cannot permit a retake or change
        // tomorrow's date/idempotency body on the retry.
        fresh.submission_started = {
          student_id: studentId, paper_id: paperId, type: fresh.paper_type ?? type,
          tier: services.tierForType(fresh.paper_type ?? type), date_taken: fresh.date_taken,
          idempotency_key: fresh.idempotency_key, pages: fresh.pages.map(submissionPage),
        };
        for (const page of fresh.pages) page.original_requires_attachment = Boolean(page.original && !page.original_key);
      }));
    }
    signal?.throwIfAborted();
    let submission = draft.submission;
    timing.data.reused_submission = Boolean(submission && submission.queued !== false);
    if (!submission || submission.queued === false) {
      submission = await timing.measure('submit', () => services.transport.submitPaper(draft.submission_started, { signal, onRetry: timing.retry }));
      if (!submission?.run_id) throw new Error('The server did not accept this paper.');
      timing.markAccepted();
      await persist(() => services.mutateDraft(draft, fresh => {
        services.assertLease(fresh, owner);
        fresh.submission = { run_id: submission.run_id, queued: submission.queued === true };
        // Original copies may only be removed after durable manifest/attachment.
        for (const page of fresh.pages) if (!page.original_requires_attachment && backupComplete(page)) {
          page.original = null;
          if (page.upload_assets?.thumb?.status === 'confirmed' || page.thumb_key) page.thumb = null;
        }
      }));
    }
    timing.finish(null, submission.queued);
    return { paperId, submission };
  } catch (error) { timing.finish(error); throw error; }
  finally {
    stopHeartbeat(); callerSignal?.removeEventListener('abort', cancel);
    if (leased) { try { await services.releaseSendLease(draft, owner); } catch { /* Cleared data stays cleared. */ } }
  }
}
