// Local drafts, so an interrupted booklet is never re-photographed.
//
// A full answer booklet is fifteen to twenty pages. Somewhere in the middle of
// that a call arrives, the battery dies, or the browser reclaims the tab, and
// the paper is back in a schoolbag by the time anyone notices. Abandonment at
// capture is the most expensive drop-off in the product, because the paper is
// physically present at that moment and will not be again.
//
// So pages are written to IndexedDB as they are taken, before anything is
// uploaded, and each page records whether it has reached storage yet. Resuming
// picks up at the first page that has not — per page, with no re-capture and no
// re-upload of what already landed.

const DB_NAME = 'mastery-scan';
const DB_VERSION = 1;
const STORE = 'drafts';

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('student', 'student_id');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const result = fn(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(result.result ?? result);
    transaction.onerror = () => reject(transaction.error);
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
  await tx(db, 'readwrite', (store) => store.put(draft));
  return draft;
}

export async function readDraft(id) {
  const db = await open();
  return tx(db, 'readonly', (store) => store.get(id));
}

export async function listDrafts(studentId) {
  const db = await open();
  const all = await tx(db, 'readonly', (store) => store.getAll());
  return (all ?? [])
    .filter((d) => d.student_id === studentId && d.pages.length)
    .sort((a, b) => b.updated_at - a.updated_at);
}

export async function saveDraft(draft) {
  const db = await open();
  draft.updated_at = Date.now();
  await tx(db, 'readwrite', (store) => store.put(draft));
  return draft;
}

export async function deleteDraft(id) {
  const db = await open();
  await tx(db, 'readwrite', (store) => store.delete(id));
}

/**
 * Add a page to a draft.
 *
 * The conditioned bytes are stored, not the raw frame: conditioning is the
 * expensive part and it has already happened, and storing the original as well
 * would double a booklet's footprint on a phone that may not have the room.
 */
export async function addPage(draft, page) {
  draft.pages.push({
    page_number: draft.pages.length + 1,
    blob: page.blob,
    mask: page.mask ?? null,
    proxy: page.proxy ?? null,
    width: page.width,
    height: page.height,
    quality: page.quality,
    meta: page.meta,
    teacher_marks: page.teacher_marks ?? [],
    margin_band: page.margin_band ?? null,
    layer_fallback: page.layer_fallback ?? null,
    uploaded: false,
  });
  return saveDraft(draft);
}

export async function removePage(draft, pageNumber) {
  draft.pages = renumber(draft.pages.filter((p) => p.page_number !== pageNumber));
  return saveDraft(draft);
}

/** Move a page within the booklet. Order is the student's to decide, not ours. */
export async function movePage(draft, from, to) {
  const pages = [...draft.pages];
  const [moved] = pages.splice(from - 1, 1);
  if (!moved) return draft;
  pages.splice(Math.max(0, Math.min(pages.length, to - 1)), 0, moved);
  draft.pages = renumber(pages);
  return saveDraft(draft);
}

/**
 * Give pages their positions, and un-send anything whose position changed.
 *
 * Storage is keyed by page number, so a page that has already been uploaded as
 * page 3 and is now page 4 is not uploaded — the bytes sitting at page 4 are
 * somebody else's. Carrying the `uploaded` flag through a renumber left the
 * booklet silently out of order after a reorder that followed a failed upload,
 * and nothing would ever have re-sent it.
 */
function renumber(pages) {
  return pages.map((p, i) => {
    const page_number = i + 1;
    return page_number === p.page_number ? p : { ...p, page_number, uploaded: false };
  });
}

/** Replace one page in place — a retake, keeping its position in the booklet. */
export async function replacePage(draft, pageNumber, page) {
  draft.pages = draft.pages.map((p) => (p.page_number === pageNumber
    ? { ...p, ...page, page_number: pageNumber, uploaded: false }
    : p));
  return saveDraft(draft);
}

export async function markUploaded(draft, pageNumber) {
  draft.pages = draft.pages.map((p) =>
    (p.page_number === pageNumber ? { ...p, uploaded: true } : p));
  return saveDraft(draft);
}

/** What a resume has left to do. */
export function pendingPages(draft) {
  return draft.pages.filter((p) => !p.uploaded);
}
