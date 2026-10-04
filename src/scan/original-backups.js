import { uploadDraftAssets } from './upload-runner.js';
import { backupComplete, processingReady, revisionOf, assertUploadSnapshot } from './upload-plan.js';
import { listDrafts, deleteDraft, mutateDraft, claimSendLease, touchSendLease, releaseSendLease, updateAssets, assertLease, startLeaseHeartbeat } from './drafts.js';
import { uploadIntent, uploadComplete, putObject, attachOriginals } from './functions.js';
const jobs = new Map();
export function cancelOriginalBackups() {
  for (const job of jobs.values()) job.controller.abort();
}
export async function finishDraftReview(draft) {
  await mutateDraft(draft, fresh => { fresh.review_saved = true; });
  if (draft.pages.every(backupComplete)) await deleteDraft(draft.id);
}
export async function resumeStudentBackups(studentId, onProgress) {
  const drafts = await listDrafts(studentId);
  return Promise.allSettled(drafts.filter(d => d.submission && !d.pages.every(backupComplete))
    .map(draft => resumeOriginalBackups(draft, undefined, onProgress)));
}
export function resumeOriginalBackups(draft, parentSignal, onProgress) {
  if (!draft.submission || draft.pages.every(backupComplete)) return Promise.resolve();
  if (jobs.has(draft.id)) return jobs.get(draft.id).promise;
  const controller = new AbortController(), owner = crypto.randomUUID();
  const cancel = () => controller.abort(parentSignal.reason);
  if (parentSignal?.aborted) cancel(); else parentSignal?.addEventListener('abort', cancel, { once: true });
  const job = { controller, promise: null };
  job.promise = (async () => {
    let leased = false, stopHeartbeat = () => {};
    try {
      controller.signal.throwIfAborted();
      await claimSendLease(draft, owner); leased = true;
      stopHeartbeat = startLeaseHeartbeat(draft, owner, error => controller.abort(error));
      const snapshot = draft.pages.map(p => ({ page_number: p.page_number, upload_revision: p.upload_revision }));
      onProgress?.({ complete: false, message: 'Your paper is submitted. Original backups are still pending on this device.' });
      await uploadDraftAssets({ draft, studentId: draft.student_id, paperId: draft.paper_id,
        mode: 'batch', concurrency: 3, signal: controller.signal,
        transport: { uploadIntent, uploadComplete, putObject },
        persist: (d, updates) => updateAssets(d, updates, owner),
        guard: () => touchSendLease(draft, owner) });
      controller.signal.throwIfAborted();
      const pages = draft.pages.filter(p => p.original_requires_attachment && !backupComplete(p)).map(p => ({
        page_number: p.page_number, page_revision: revisionOf(p), page_key: p.r2_key, original_key: p.original_key,
      }));
      if (pages.length) {
        const receipt = await attachOriginals({ student_id: draft.student_id, paper_id: draft.paper_id, pages }, { signal: controller.signal });
        const attached = receipt?.attached;
        if (!Array.isArray(attached) || attached.length !== pages.length ||
            pages.some(p => attached.filter(a => a.page_number === p.page_number && a.key === p.original_key).length !== 1)) {
          throw new Error('Original backup was not attached. Your originals remain on this device.');
        }
        await mutateDraft(draft, fresh => {
          assertLease(fresh, owner); assertUploadSnapshot(fresh, snapshot);
          for (const sent of pages) {
            const page = fresh.pages.find(p => p.page_number === sent.page_number);
            if (page.original_key !== sent.original_key || page.upload_assets?.raw?.status !== 'confirmed') throw new Error('Original backup changed. Retry this draft.');
            page.upload_assets.raw.attached = true;
            page.original = null;
            if (page.upload_assets?.thumb?.status === 'confirmed' || page.thumb_key) page.thumb = null;
            page.uploaded = processingReady(page) && backupComplete(page);
          }
        });
      }
      if (!draft.pages.every(backupComplete)) throw new Error('Some originals are still pending.');
      onProgress?.({ complete: true, message: 'Original backups are complete.' });
      if (draft.review_saved) await deleteDraft(draft.id);
    } catch (error) {
      onProgress?.({ complete: false, message: 'Original backups are pending. Keep this device’s draft and reconnect to retry.' });
      throw error;
    } finally {
      stopHeartbeat(); parentSignal?.removeEventListener('abort', cancel);
      if (leased) { try { await releaseSendLease(draft, owner); } catch { /* Never recreate cleared data. */ } }
    }
  })().finally(() => { if (jobs.get(draft.id) === job) jobs.delete(draft.id); });
  jobs.set(draft.id, job); return job.promise;
}
