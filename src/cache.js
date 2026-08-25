// Offline read cache.
//
// The rule from CLAUDE.md: past papers and their analysis must be readable
// offline; scanning and extraction are online-only; cache read paths and queue
// nothing that needs the model. So this caches query *results* and never queues
// a write. An upload attempted offline fails and says so, rather than sitting in
// a queue the student cannot see.
//
// Consent deliberately does not come through here — it is always read live.

const DB_NAME = 'axon.cache.v1';
const STORE = 'reads';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // a missing cache degrades, it does not break
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let out = null;
    try {
      out = fn(store);
    } catch {
      return resolve(null);
    }
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => resolve(null);
    t.onabort = () => resolve(null);
  });
}

export async function putCached(key, value) {
  return tx('readwrite', (s) => s.put({ key, value, cachedAt: Date.now() }));
}

export async function getCached(key) {
  const row = await tx('readonly', (s) => s.get(key));
  return row ? row.value : null;
}

export async function clearCache() {
  return tx('readwrite', (s) => s.clear());
}

/**
 * Read through the cache: try the network, fall back to whatever was last seen.
 *
 * @param {string} key
 * @param {() => Promise<any>} fetcher
 * @returns {Promise<{data:any, stale:boolean, offline:boolean}>}
 */
export async function readThrough(key, fetcher) {
  try {
    const data = await fetcher();
    await putCached(key, data);
    return { data, stale: false, offline: false };
  } catch (err) {
    const cached = await getCached(key);
    if (cached !== null) return { data: cached, stale: true, offline: !navigator.onLine };
    throw err;
  }
}
