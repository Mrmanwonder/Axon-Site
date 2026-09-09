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

/**
 * Remove every local store that can hold a student's schoolwork.
 *
 * This is a shared-family-device product: a parent signs out, a sibling signs
 * in, and both use the same browser profile. The read cache holds papers and
 * their analysis; the scan draft database holds conditioned page images, masks
 * and thumbnails, and before upload the original frames. None of that should
 * outlive the session that created it just because nothing has overwritten it.
 *
 * Best-effort by design. Sign-out must complete even if a store refuses to
 * open — being unable to clear the cache is not a reason to keep someone
 * signed in — so failures are swallowed here and only here.
 */
export async function clearLocalData() {
  try { await clearCache(); } catch { /* best effort */ }

  // The scan drafts live in their own database (src/scan), so deleting it
  // wholesale is both simpler and more thorough than walking its stores.
  try {
    await new Promise((resolve) => {
      if (!('indexedDB' in window)) return resolve(null);
      const req = indexedDB.deleteDatabase('axon-scan');
      req.onsuccess = () => resolve(null);
      req.onerror = () => resolve(null);
      // A delete blocked by another open tab must not hang sign-out.
      req.onblocked = () => resolve(null);
      setTimeout(() => resolve(null), 1500);
    });
  } catch { /* best effort */ }
}
