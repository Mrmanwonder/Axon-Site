// Local drafts, so an interrupted booklet is never re-photographed.
//
// A full answer booklet is fifteen to twenty pages. Somewhere in the middle of
// that a call arrives, the battery dies, or the browser reclaims the tab, and
// the paper is back in a schoolbag by the time anyone notices. Abandonment at
// capture is the most expensive drop-off in the product, because the paper is
// physically present at that moment and will not be again.
//
// Draft metadata and binary assets are stored separately. This keeps upload
// state writes tiny while preserving the same durable local recovery contract.

import { openDraftDatabase, closeLocalDatabase } from '../local-data.js';
const STORE = 'drafts';
const ASSET_STORE = 'draft_assets';
export const DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const open = openDraftDatabase;
import { decodeDraft } from './draft-codec.js';
import { stampDraft as stamp } from './draft-mutations.js';

function tx(db, stores, mode, fn) {
  return new Promise((resolve, reject) => {
    let transaction;
    let result;
    try {
      transaction = db.transaction(stores, mode);
      result = fn(transaction);
    } catch (error) {
      closeLocalDatabase(db);
      reject(error);
      return;
    }
    transaction.oncomplete = () => { closeLocalDatabase(db); resolve(typeof result === 'function' ? result() : result?.result ?? result); };
    transaction.onerror = transaction.onabort = () => { closeLocalDatabase(db); reject(transaction.error); };
  });
}

function requestAllByIndex(store, indexName, value) {
  return store.index(indexName).getAll(IDBKeyRange.only(value));
}

/** Start a draft. The id is the paper id once there is one, or a local id until then. */
export async function createDraft({ id, studentId, paperType }) {
  const db = await open();
  const draft = {
    id,
    student_id: studentId,
    paper_type: paperType ?? null,
    paper_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    pages: [],
  };
  await tx(db, STORE, 'readwrite', transaction => transaction.objectStore(STORE).add(draft));
  return stamp(draft);
}

export async function readDraft(id) {
  const db = await open();
  let draftRequest, assetsRequest;
  const result = await tx(db, [STORE, ASSET_STORE], 'readonly', transaction => {
    draftRequest = transaction.objectStore(STORE).get(id);
    assetsRequest = requestAllByIndex(transaction.objectStore(ASSET_STORE), 'draft', id);
    return () => ({ draft: draftRequest.result, assets: assetsRequest.result ?? [] });
  });
  const draft = result?.draft;
  if (draft && Date.now() - draft.updated_at > DRAFT_RETENTION_MS) { await deleteDraft(id); return null; }
  return draft ? stamp(decodeDraft(draft, result.assets, { strict: true })) : null;
}

async function loadDraftAssets(drafts) {
  const ids = drafts.map(draft => draft.id);
  if (!ids.length) return [];
  const db = await open();
  const requests = [];
  return tx(db, ASSET_STORE, 'readonly', transaction => {
    const index = transaction.objectStore(ASSET_STORE).index('draft');
    for (const id of ids) requests.push(index.getAll(IDBKeyRange.only(id)));
    return () => requests.flatMap(request => request.result ?? []);
  });
}

export async function listDrafts(studentId) {
  const db = await open();
  const all = await tx(db, STORE, 'readonly', transaction => transaction.objectStore(STORE).getAll());
  const expired = (all ?? []).filter(draft => Date.now() - draft.updated_at > DRAFT_RETENTION_MS);
  for (const draft of expired) await deleteDraft(draft.id);
  const kept = (all ?? [])
    .filter(draft => Date.now() - draft.updated_at <= DRAFT_RETENTION_MS)
    .filter(draft => draft.student_id === studentId && draft.pages.length)
    .sort((a, b) => b.updated_at - a.updated_at);
  // listDrafts is also the source for startup/online original-backup recovery,
  // not merely UI cards. It therefore must faithfully hydrate every retained
  // asset. Returning preview-only rows can turn an unhydrated original marker
  // into `null`, making backupComplete() incorrectly conclude that no original
  // ever existed and silently skip the deferred backup.
  const assets = await loadDraftAssets(kept);
  return kept.map(draft => stamp(decodeDraft(structuredClone(draft), assets, { strict: true })));
}

export { saveDraft, mutateDraft, addPage, removePage, movePage, replacePage, markUploaded, pendingPages,
  updateAssets, claimSendLease, touchSendLease, startLeaseHeartbeat, releaseSendLease, assertLease } from './draft-mutations.js';
export async function deleteDraft(id) {
  const db = await open();
  await tx(db, [STORE, ASSET_STORE], 'readwrite', transaction => {
    transaction.objectStore(STORE).delete(id);
    const request = transaction.objectStore(ASSET_STORE).index('draft').openCursor(IDBKeyRange.only(id));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  });
}
