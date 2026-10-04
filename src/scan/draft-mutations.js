import { openDraftDatabase, closeLocalDatabase, localDataEpoch } from '../local-data.js';
import { ASSET_FIELDS, assetState, processingReady, backupComplete, revisionOf, newRevision } from './upload-plan.js';
import { applyAssetUpdates, renumberPages as renumber } from './upload-state.js';
export function stampDraft(draft) {
  if (draft) {
    Object.defineProperty(draft, '_epoch', { value: localDataEpoch(), configurable: true });
    Object.defineProperty(draft, '_revisions', { value: draft.pages.map(p => [p.page_number, revisionOf(p)]), configurable: true });
  }
  return draft;
}
// Fresh-row transactions serialize across tabs, without overwriting another
// completion's recovery state. A removed/erased row is never resurrected.
export async function mutateDraft(draft, reduce) {
  const epoch = draft._epoch;
  if (epoch !== localDataEpoch()) throw new Error('This draft was cleared. Start a new scan.');
  const db = await openDraftDatabase(); let fresh, result, failure;
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = store.get(draft.id);
      request.onsuccess = () => {
        try {
          fresh = request.result;
          if (!fresh || epoch !== localDataEpoch() || fresh.student_id !== draft.student_id) throw new Error('This draft was cleared. Start a new scan.');
          result = reduce(fresh);
          fresh.updated_at = Date.now(); store.put(fresh);
        } catch (error) { failure = error; transaction.abort(); }
      };
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = event => reject(failure ?? event.target?.error ?? transaction.error ?? new Error('Could not save this draft.'));
    });
  } finally { closeLocalDatabase(db); }
  if (epoch !== localDataEpoch()) throw new Error('This draft was cleared. Start a new scan.');
  for (const key of Object.keys(draft)) if (!(key in fresh)) delete draft[key];
  Object.assign(draft, fresh); stampDraft(draft); return result;
}
export async function saveDraft(draft) {
  const incoming = structuredClone(draft), revisions = draft._revisions;
  await mutateDraft(draft, fresh => {
    if (JSON.stringify(revisions) !== JSON.stringify(fresh.pages.map(p => [p.page_number, revisionOf(p)]))) throw new Error('This booklet changed. Reopen the draft.');
    for (const field of ['paper_id', 'idempotency_key', 'date_taken']) {
      if (fresh[field] && incoming[field] && fresh[field] !== incoming[field]) throw new Error('This paper already has different saved details.');
      if (!fresh[field] && incoming[field]) fresh[field] = incoming[field];
    }
    if (incoming.paper_type && !fresh.submission_started) fresh.paper_type = incoming.paper_type;
    for (const page of fresh.pages) {
      const edit = incoming.pages.find(p => p.page_number === page.page_number && revisionOf(p) === revisionOf(page));
      for (const field of ['quality', 'meta', 'capture', 'fingerprint']) if (edit && field in edit) page[field] = edit[field];
    }
  });
  return draft;
}
const editable = draft => { if (draft.submission_started || draft.submission) throw new Error('This paper may already be submitted. Start a new draft to change its pages.'); };
export async function addPage(draft, page) {
  const captured = structuredClone(page);
  await mutateDraft(draft, fresh => {
    editable(fresh);
    fresh.pages.push({ ...captured, page_number: fresh.pages.length + 1, upload_revision: newRevision(), upload_assets: {}, uploaded: false });
  }); return draft;
}
export async function removePage(draft, number) {
  await mutateDraft(draft, fresh => { editable(fresh); fresh.pages = renumber(fresh.pages.filter(p => p.page_number !== number)); }); return draft;
}
export async function movePage(draft, from, to) {
  await mutateDraft(draft, fresh => {
    editable(fresh); const [page] = fresh.pages.splice(from - 1, 1);
    if (page) fresh.pages.splice(Math.max(0, Math.min(fresh.pages.length, to - 1)), 0, page);
    fresh.pages = renumber(fresh.pages);
  }); return draft;
}
export async function replacePage(draft, number, page) {
  const captured = structuredClone(page);
  await mutateDraft(draft, fresh => {
    // An accepted, reviewable paper may explicitly retake a page. An uncertain
    // submission remains frozen until its exact request has been resolved.
    if (fresh.submission) { delete fresh.submission; delete fresh.submission_started; }
    editable(fresh);
    if (!fresh.pages.some(p => p.page_number === number)) throw new Error('This page was removed.');
    fresh.pages = fresh.pages.map(p => p.page_number === number ? { ...captured, page_number: number,
      upload_revision: newRevision(), upload_assets: {}, uploaded: false } : p);
  }); return draft;
}
const LEASE_MS = 5 * 60 * 1000;
export const assertLease = (fresh, owner) => {
  if (fresh.upload_lease?.owner !== owner) throw new Error('Another tab is sending this booklet. Reopen the draft.');
};
export async function claimSendLease(draft, owner) {
  return mutateDraft(draft, fresh => {
    if (fresh.upload_lease && fresh.upload_lease.owner !== owner && fresh.upload_lease.expires_at > Date.now()) throw new Error('This booklet is already sending in another tab.');
    fresh.upload_lease = { owner, expires_at: Date.now() + LEASE_MS };
  });
}
export async function touchSendLease(draft, owner) {
  return mutateDraft(draft, fresh => { assertLease(fresh, owner); fresh.upload_lease.expires_at = Date.now() + LEASE_MS; });
}
export async function releaseSendLease(draft, owner) {
  return mutateDraft(draft, fresh => { if (fresh.upload_lease?.owner === owner) delete fresh.upload_lease; });
}
export const updateAssets = (draft, updates, owner) => mutateDraft(draft, fresh => {
  if (owner) { assertLease(fresh, owner); fresh.upload_lease.expires_at = Date.now() + LEASE_MS; }
  return applyAssetUpdates(fresh, updates);
});
export async function markUploaded(draft, number, extra = {}) {
  const page = draft.pages.find(p => p.page_number === number);
  const updates = Object.entries(ASSET_FIELDS).filter(([, field]) => extra[field]).map(([kind, field]) => ({
    descriptor: { id: revisionOf(page) + ':' + kind, page_number: number, revision: revisionOf(page), kind, bytes: page.blob?.size ?? 0 },
    state: { status: 'confirmed', key: extra[field], bucket: kind === 'raw' ? 'originals' : extra.r2_bucket || 'derived' },
  }));
  await updateAssets(draft, updates); return draft;
}
export const pendingPages = draft => draft.pages.filter(p => !processingReady(p));

export function startLeaseHeartbeat(draft, owner, onError) {
  let stopped = false, timer;
  const beat = async () => {
    if (stopped) return;
    try { await touchSendLease(draft, owner); }
    catch (error) { stopped = true; onError(error); return; }
    if (!stopped) timer = setTimeout(beat, 30000);
  };
  timer = setTimeout(beat, 30000);
  return () => { stopped = true; clearTimeout(timer); };
}
