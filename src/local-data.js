// One owner for retained schoolwork, database handles and cross-tab cleanup.
const DATABASES = { cache: 'axon.cache.v1', drafts: 'axon-scan' };
const DATABASE_VERSIONS = { cache: 1, drafts: 2 };
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

const DRAFT_BINARY_FIELDS = ['blob', 'mask', 'thumb', 'original', 'proxy'];
const storedRevision = page => page.upload_revision || 'legacy-' + page.page_number;
const draftAssetKey = (draftId, revision, field) => `${draftId}:${revision}:${field}`;

function migrateInlineDraftAssets(transaction) {
  if (!transaction?.objectStoreNames.contains('drafts') || !transaction.objectStoreNames.contains('draft_assets')) return;
  const drafts = transaction.objectStore('drafts');
  const assets = transaction.objectStore('draft_assets');
  const cursorRequest = drafts.openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    const draft = cursor.value;
    let changed = false;
    for (const page of draft.pages ?? []) {
      const revision = storedRevision(page);
      for (const field of DRAFT_BINARY_FIELDS) {
        const binary = page[field];
        // v1 stored ArrayBuffers in the draft row. Move those bytes into their
        // own records synchronously inside the schema-upgrade transaction. Old
        // native-Blob drafts are left inline: converting a Blob requires async
        // work, which IndexedDB upgrade transactions cannot safely await.
        if (!binary || binary.axon_asset === 1 || binary.axon_binary !== 1 || !(binary.data instanceof ArrayBuffer)) continue;
        const key = draftAssetKey(draft.id, revision, field);
        assets.put({
          key,
          draft_id: draft.id,
          student_id: draft.student_id,
          revision,
          page_number: page.page_number,
          field,
          type: binary.type || 'application/octet-stream',
          size: binary.size ?? binary.data.byteLength,
          data: binary.data,
        });
        page[field] = { axon_asset: 1, key, type: binary.type || '', size: binary.size ?? binary.data.byteLength };
        changed = true;
      }
    }
    if (changed) cursor.update(draft);
    cursor.continue();
  };
}

function open(kind, upgrade) {
  if (suspended) return Promise.reject(new Error('Local data is being cleared.'));
  const openedAt = epoch;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASES[kind], DATABASE_VERSIONS[kind]);
    request.onupgradeneeded = event => upgrade(request.result, request.transaction, event.oldVersion);
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
export const openCacheDatabase = () => open('cache', db => {
  if (!db.objectStoreNames.contains('reads')) db.createObjectStore('reads', { keyPath: 'key' });
});
export const openDraftDatabase = () => open('drafts', (db, transaction, oldVersion) => {
  if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' }).createIndex('student', 'student_id');
  if (!db.objectStoreNames.contains('draft_assets')) {
    const assets = db.createObjectStore('draft_assets', { keyPath: 'key' });
    assets.createIndex('draft', 'draft_id');
    assets.createIndex('student', 'student_id');
  }
  if (oldVersion < 2) migrateInlineDraftAssets(transaction);
});
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
function deleteIndexMatches(index, value) {
  const request = index.openCursor(IDBKeyRange.only(value));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
}
async function discardDraft(id) {
  const db = await openDraftDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['drafts', 'draft_assets'], 'readwrite');
      tx.objectStore('drafts').delete(id);
      deleteIndexMatches(tx.objectStore('draft_assets').index('draft'), id);
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Local draft cleanup failed.'));
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
    const db = await openDraftDatabase();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['drafts', 'draft_assets'], 'readwrite');
        deleteIndexMatches(tx.objectStore('drafts').index('student'), studentId);
        deleteIndexMatches(tx.objectStore('draft_assets').index('student'), studentId);
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Local student cleanup failed.'));
      });
    } finally { closeLocalDatabase(db); }
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
  discardDraft,
};
