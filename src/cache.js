// Offline read cache.
//
// The rule from CLAUDE.md: past papers and their analysis must be readable
// offline; scanning and extraction are online-only; cache read paths and queue
// nothing that needs the model. So this caches query *results* and never queues
// a write. An upload attempted offline fails and says so, rather than sitting in
// a queue the student cannot see.
//
// Consent deliberately does not come through here — it is always read live.

import { openCacheDatabase, closeLocalDatabase, LocalDataService, localDataEpoch } from './local-data.js';
const STORE = 'reads';
const open = () => openCacheDatabase().catch(() => null);

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
      closeLocalDatabase(db);
      return resolve(null);
    }
    t.oncomplete = () => { closeLocalDatabase(db); resolve(out && 'result' in out ? out.result : out); };
    t.onerror = () => { closeLocalDatabase(db); resolve(null); };
    t.onabort = () => { closeLocalDatabase(db); resolve(null); };
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
  const epoch = localDataEpoch();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const cached = await getCached(key);
    if (cached !== null) return { data: cached, stale: true, offline: true };
    throw new Error('This information is not available offline yet.');
  }
  try {
    const data = await fetcher();
    if (epoch !== localDataEpoch()) throw new Error("Local data changed while loading.");
    await putCached(key, data);
    return { data, stale: false, offline: false };
  } catch (err) {
    if (epoch !== localDataEpoch()) throw err;
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
export async function clearLocalData() { await LocalDataService.clearAll(); }

/**
 * Purge the outgoing student's drafts and the shared read cache before a
 * sibling switch is committed to UI state.
 */
export async function clearStudentLocalData(studentId) {
  if (!studentId) return;
  await LocalDataService.clearStudent(studentId);
}
