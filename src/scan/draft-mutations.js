import { openDraftDatabase, closeLocalDatabase, localDataEpoch } from '../local-data.js';
import { encodeCapturedPage, mergeStoredDraft, assetKeysForRevision } from './draft-codec.js';
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
// completion's recovery state. Binary page data lives in draft_assets and is
// never rewritten by these metadata updates.
export async function mutateDraft(draft, reduce, { putAssets = [], deleteAssetKeys = [], hydratedPages = [] } = {}) {
  const epoch = draft._epoch;
  if (epoch !== localDataEpoch()) throw new Error('This draft was cleared. Start a new scan.');
  const db = await openDraftDatabase(); let fresh, result, failure;
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['drafts', 'draft_assets'], 'readwrite');
      const store = transaction.objectStore('drafts');
      const assets = transaction.objectStore('draft_assets');
      const request = store.get(draft.id);
      request.onsuccess = () => {
        try {
          fresh = request.result;
          if (!fresh || epoch !== localDataEpoch() || fresh.student_id !== draft.student_id) throw new Error('This draft was cleared. Start a new scan.');
          result = reduce(fresh);
          fresh.updated_at = Date.now();
          store.put(fresh);
          for (const key of deleteAssetKeys) assets.delete(key);
          for (const asset of putAssets) assets.put(asset);
        } catch (error) { failure = error; transaction.abort(); }
      };
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = event => reject(failure ?? event.target?.error ?? transaction.error ?? new Error('Could not save this draft.'));
    });
  } finally { closeLocalDatabase(db); }
  if (epoch !== localDataEpoch()) throw new Error('This draft was cleared. Start a new scan.');
  mergeStoredDraft(draft, fresh, hydratedPages); stampDraft(draft); return result;
}

export async function saveDraft(draft) {
  // Snapshot metadata only. structuredClone(draft) used to duplicate every
  // full-resolution original in memory just to save quality/capture metadata.
  const incoming = {
    paper_id: draft.paper_id,
    idempotency_key: draft.idempotency_key,
    date_taken: draft.date_taken,
    paper_type: draft.paper_type,
    pages: draft.pages.map(page => ({
      page_number: page.page_number,
      upload_revision: page.upload_revision,
      quality: page.quality === undefined ? undefined : structuredClone(page.quality),
      meta: page.meta === undefined ? undefined : structuredClone(page.meta),
      capture: page.capture === undefined ? undefined : structuredClone(page.capture),
      fingerprint: page.fingerprint === undefined ? undefined : structuredClone(page.fingerprint),
    })),
  };
  const revisions = draft._revisions;
  await mutateDraft(draft, fresh => {
    if (JSON.stringify(revisions) !== JSON.stringify(fresh.pages.map(p => [p.page_number, revisionOf(p)]))) throw new Error('This booklet changed. Reopen the draft.');
    for (const field of ['paper_id', 'idempotency_key', 'date_taken']) {
      if (fresh[field] && incoming[field] && fresh[field] !== incoming[field]) throw new Error('This paper already has different saved details.');
      if (!fresh[field] && incoming[field]) fresh[field] = incoming[field];
    }
    if (incoming.paper_type && !fresh.submission_started) fresh.paper_type = incoming.paper_type;
    for (const page of fresh.pages) {
      const edit = incoming.pages.find(p => p.page_number === page.page_number && (p.upload_revision || 'legacy-' + p.page_number) === revisionOf(page));
      for (const field of ['quality', 'meta', 'capture', 'fingerprint']) if (edit && field in edit && edit[field] !== undefined) page[field] = edit[field];
    }
  });
  return draft;
}
const editable = draft => { if (draft.submission_started || draft.submission) throw new Error('This paper may already be submitted. Start a new draft to change its pages.'); };

export async function addPage(draft, page) {
  const pageNumber = draft.pages.length + 1;
  const revision = newRevision();
  const hydrated = { ...page, page_number: pageNumber, upload_revision: revision, upload_assets: {}, uploaded: false };
  const captured = await encodeCapturedPage(hydrated, { draftId: draft.id, studentId: draft.student_id, revision, pageNumber });
  await mutateDraft(draft, fresh => {
    editable(fresh);
    fresh.pages.push(captured.page);
  }, { putAssets: captured.assets, hydratedPages: [hydrated] });
  return draft;
}
export async function removePage(draft, number) {
  const existing = draft.pages.find(p => p.page_number === number);
  const deleteAssetKeys = existing ? assetKeysForRevision(draft.id, revisionOf(existing)) : [];
  await mutateDraft(draft, fresh => { editable(fresh); fresh.pages = renumber(fresh.pages.filter(p => p.page_number !== number)); }, { deleteAssetKeys });
  return draft;
}
export async function movePage(draft, from, to) {
  await mutateDraft(draft, fresh => {
    editable(fresh); const [page] = fresh.pages.splice(from - 1, 1);
    if (page) fresh.pages.splice(Math.max(0, Math.min(fresh.pages.length, to - 1)), 0, page);
    fresh.pages = renumber(fresh.pages);
  }); return draft;
}
export async function replacePage(draft, number, page) {
  const revision = newRevision();
  const hydrated = { ...page, page_number: number, upload_revision: revision, upload_assets: {}, uploaded: false };
  const captured = await encodeCapturedPage(hydrated, { draftId: draft.id, studentId: draft.student_id, revision, pageNumber: number });
  const old = draft.pages.find(p => p.page_number === number);
  const deleteAssetKeys = old ? assetKeysForRevision(draft.id, revisionOf(old)) : [];
  await mutateDraft(draft, fresh => {
    // An accepted, reviewable paper may explicitly retake a page. An uncertain
    // submission remains frozen until its exact request has been resolved.
    if (fresh.submission) { delete fresh.submission; delete fresh.submission_started; }
    editable(fresh);
    if (!fresh.pages.some(p => p.page_number === number)) throw new Error('This page was removed.');
    fresh.pages = fresh.pages.map(p => p.page_number === number ? captured.page : p);
  }, { putAssets: captured.assets, deleteAssetKeys, hydratedPages: [hydrated] });
  return draft;
}
// A send lease says which tab is sending a booklet. It must never strand a
// paper: a tab that closed, crashed or was discarded mid-send leaves its lease
// behind, and the next tab (or the same tab after a reload) takes it over at
// once. Liveness comes from the Web Locks API, which the browser releases the
// moment a tab goes away; the expiry is only the fallback for browsers without
// it. (Owner, 6 Oct 2026: "That did not finish… already sending in another
// tab" must never appear.)
const LEASE_MS = 90 * 1000;
const HEARTBEAT_MS = 20 * 1000;
const LOCK_PREFIX = 'axon-send:';
const heldLocks = new Map();

/** Thrown only while another live tab really is sending this booklet. */
export class SendBusy extends Error {
  constructor(owner) { super('This booklet is being sent from another tab.'); this.name = 'SendBusy'; this.busy = true; this.owner = owner; }
}

const locks = () => globalThis.navigator?.locks ?? null;

async function holdOwnerLock(owner) {
  const api = locks();
  if (!api?.request || heldLocks.has(owner)) return;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await new Promise(resolve => {
    api.request(LOCK_PREFIX + owner, { mode: 'exclusive' }, () => { resolve(); return held; }).catch(resolve);
  });
  heldLocks.set(owner, release);
}
function dropOwnerLock(owner) {
  heldLocks.get(owner)?.();
  heldLocks.delete(owner);
}
/** true: that sender is alive. false: it is gone. null: cannot tell here. */
export async function senderAlive(owner) {
  if (heldLocks.has(owner)) return true;
  const api = locks();
  if (!api?.query) return null;
  try {
    const { held = [] } = await api.query();
    return held.some(lock => lock.name === LOCK_PREFIX + owner);
  } catch { return null; }
}

export const assertLease = (fresh, owner) => {
  if (fresh.upload_lease?.owner !== owner) throw new SendBusy(fresh.upload_lease?.owner ?? null);
};
export async function claimSendLease(draft, owner) {
  await holdOwnerLock(owner);
  const take = takeover => mutateDraft(draft, fresh => {
    const lease = fresh.upload_lease;
    if (lease && lease.owner !== owner && lease.expires_at > Date.now() && lease.owner !== takeover) throw new SendBusy(lease.owner);
    fresh.upload_lease = { owner, expires_at: Date.now() + LEASE_MS };
  });
  try {
    return await take(null);
  } catch (error) {
    if (!error?.busy) { dropOwnerLock(owner); throw error; }
    // The holder left without releasing (closed tab, crash, reload): take over.
    if (error.owner && await senderAlive(error.owner) === false) {
      try { return await take(error.owner); } catch (again) { dropOwnerLock(owner); throw again; }
    }
    dropOwnerLock(owner);
    throw error;
  }
}
export async function touchSendLease(draft, owner) {
  return mutateDraft(draft, fresh => { assertLease(fresh, owner); fresh.upload_lease.expires_at = Date.now() + LEASE_MS; });
}
export async function releaseSendLease(draft, owner) {
  try {
    return await mutateDraft(draft, fresh => { if (fresh.upload_lease?.owner === owner) delete fresh.upload_lease; });
  } finally { dropOwnerLock(owner); }
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
/** The student pressed Read. Kept with the draft so a send that a closed tab,
    a dead battery or a lost connection interrupted resumes on its own. */
export async function requestSend(draft, paperType) {
  return mutateDraft(draft, fresh => {
    fresh.send_requested ??= { at: Date.now() };
    if (paperType && !fresh.submission_started) fresh.paper_type = paperType;
  });
}
export const pendingPages = draft => draft.pages.filter(p => !processingReady(p));

export function startLeaseHeartbeat(draft, owner, onError) {
  let stopped = false, timer;
  const beat = async () => {
    if (stopped) return;
    try { await touchSendLease(draft, owner); }
    catch (error) { stopped = true; onError(error); return; }
    if (!stopped) timer = setTimeout(beat, HEARTBEAT_MS);
  };
  timer = setTimeout(beat, HEARTBEAT_MS);
  return () => { stopped = true; clearTimeout(timer); };
}
