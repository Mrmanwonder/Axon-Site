// One owner for retained schoolwork, database handles and cross-tab cleanup.
const DATABASES = { cache: 'axon.cache.v1', drafts: 'axon-scan' };
const handles = new Set();
let epoch = 0;
let suspended = false;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('axon.local-data') : null;
export const localDataEpoch = () => epoch;
const notify = detail => globalThis.dispatchEvent?.(new CustomEvent('axon:local-data', { detail }));
function begin(message) {
  ++epoch; suspended = true;
  for (const db of handles) db.close();
  handles.clear();
  notify(message);
}
channel?.addEventListener('message', ({ data }) => {
  if (data?.action === 'purge') begin(data);
  if (data?.action === 'complete') { suspended = false; notify(data); }
});

function open(kind, upgrade) {
  if (suspended) return Promise.reject(new Error('Local data is being cleared.'));
  const openedAt = epoch;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASES[kind], 1);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (openedAt !== epoch || suspended) { db.close(); reject(new Error('Local data was cleared.')); return; }
      handles.add(db);
      db.onversionchange = () => { db.close(); handles.delete(db); };
      resolve(db);
    };
  });
}
export const openCacheDatabase = () => open('cache', db => { if (!db.objectStoreNames.contains('reads')) db.createObjectStore('reads', { keyPath: 'key' }); });
export const openDraftDatabase = () => open('drafts', db => { if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' }).createIndex('student', 'student_id'); });
export function closeLocalDatabase(db) { db.close(); handles.delete(db); }

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Another tab is holding local schoolwork open. Close Axon tabs and retry cleanup.')), 5000);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => { clearTimeout(timer); resolve(); };
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    // onblocked is not success. Existing handles receive versionchange above.
  });
}
async function clearAll() {
  const message = { action: 'purge', studentId: null };
  begin(message); channel?.postMessage(message);
  try { await Promise.all(Object.values(DATABASES).map(deleteDatabase)); }
  finally {
    suspended = false;
    channel?.postMessage({ action: 'complete', studentId: null });
  }
}
async function withStore(kind, mode, action) {
  const db = await (kind === 'cache' ? openCacheDatabase() : openDraftDatabase());
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(kind === 'cache' ? 'reads' : 'drafts', mode);
      const request = action(tx.objectStore(kind === 'cache' ? 'reads' : 'drafts'));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Local cleanup failed.'));
    });
  } finally { closeLocalDatabase(db); }
}
async function clearStudent(studentId) {
  // Cache keys include paper-only identities, so invalidate the read cache in
  // full rather than leave a paper-detail result whose student is ambiguous.
  const message = { action: 'purge', studentId };
  begin(message); channel?.postMessage(message);
  suspended = false;
  try {
    await withStore('cache', 'readwrite', store => store.clear());
    const drafts = await withStore('drafts', 'readonly', store => store.getAll());
    for (const draft of drafts ?? []) if (draft.student_id === studentId) await withStore('drafts', 'readwrite', store => store.delete(draft.id));
    const retained = await withStore('drafts', 'readonly', store => store.getAll());
    if (retained.some(draft => draft.student_id === studentId)) throw new Error('Some local drafts could not be removed.');
  } finally {
    const complete = { action: 'complete', studentId };
    channel?.postMessage(complete); notify(complete);
  }
}
export const LocalDataService = {
  clearAll, clearStudent,
  invalidatePapers: () => withStore('cache', 'readwrite', store => store.clear()),
  invalidateAnalytics: () => withStore('cache', 'readwrite', store => store.clear()),
  listDrafts: async studentId => (await withStore('drafts', 'readonly', store => store.getAll())).filter(draft => draft.student_id === studentId),
  discardDraft: id => withStore('drafts', 'readwrite', store => store.delete(id)),
};
