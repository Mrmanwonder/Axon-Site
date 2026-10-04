// Local drafts, so an interrupted booklet is never re-photographed.
//
// A full answer booklet is fifteen to twenty pages. Somewhere in the middle of
// that a call arrives, the battery dies, or the browser reclaims the tab, and
// the paper is back in a schoolbag by the time anyone notices. Abandonment at
// capture is the most expensive drop-off in the product, because the paper is
// physically present at that moment and will not be again.
//
// So pages are written to IndexedDB as they are taken, before anything is
// uploaded. Issued capabilities and confirmed files are stored independently;
// recovery confirms uncertain transfers before resending any bytes.

import { openDraftDatabase, closeLocalDatabase, localDataEpoch } from '../local-data.js';
const STORE = 'drafts';
export const DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const open = openDraftDatabase;
import { stampDraft as stamp } from './draft-mutations.js';

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    let transaction;
    let result;
    try {
      transaction = db.transaction(STORE, mode);
      result = fn(transaction.objectStore(STORE));
    } catch (error) {
      closeLocalDatabase(db);
      reject(error);
      return;
    }
    transaction.oncomplete = () => { closeLocalDatabase(db); resolve(result.result ?? result); };
    transaction.onerror = transaction.onabort = () => { closeLocalDatabase(db); reject(transaction.error); };

  });
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
  await tx(db, 'readwrite', (store) => store.add(draft));
  return stamp(draft);
}

export async function readDraft(id) {
  const db = await open();
  const draft = await tx(db, 'readonly', (store) => store.get(id));
  if (draft && Date.now() - draft.updated_at > DRAFT_RETENTION_MS) { await deleteDraft(id); return null; }
  return stamp(draft);
}

export async function listDrafts(studentId) {
  const db = await open();
  const all = await tx(db, 'readonly', (store) => store.getAll());
  for (const draft of all ?? []) if (Date.now() - draft.updated_at > DRAFT_RETENTION_MS) await deleteDraft(draft.id);
  return (all ?? [])
  .filter(draft => Date.now() - draft.updated_at <= DRAFT_RETENTION_MS)
  .filter((d) => d.student_id === studentId && d.pages.length)
  .sort((a, b) => b.updated_at - a.updated_at).map(stamp);
}

export { saveDraft, mutateDraft, addPage, removePage, movePage, replacePage, markUploaded, pendingPages,
  updateAssets, claimSendLease, touchSendLease, startLeaseHeartbeat, releaseSendLease, assertLease } from './draft-mutations.js';
export async function deleteDraft(id) {
  const db = await open(); await tx(db, 'readwrite', store => store.delete(id));
}
