// Draft metadata changes constantly while upload state advances. Large image
// bytes do not. Keep those two lifecycles separate so marking one object as
// confirmed never clones and rewrites an 80+ MB booklet.
export const DRAFT_BINARY_FIELDS = ['blob', 'mask', 'thumb', 'original', 'proxy'];
const revisionOf = page => page.upload_revision || 'legacy-' + page.page_number;
export const draftAssetKey = (draftId, revision, field) => `${draftId}:${revision}:${field}`;
export const assetKeysForRevision = (draftId, revision) => DRAFT_BINARY_FIELDS.map(field => draftAssetKey(draftId, revision, field));

/**
 * Convert one hydrated page into small draft metadata plus immutable binary
 * records. ArrayBuffers are used rather than native Blob values because some
 * WebKit IndexedDB implementations reject Blob persistence.
 */
export async function encodeCapturedPage(page, { draftId, studentId, revision, pageNumber }) {
  const stored = structuredClone(page);
  const assets = [];
  for (const field of DRAFT_BINARY_FIELDS) {
    const blob = stored[field];
    if (!(blob instanceof Blob)) continue;
    const key = draftAssetKey(draftId, revision, field);
    const data = await blob.arrayBuffer();
    stored[field] = { axon_asset: 1, key, type: blob.type, size: blob.size };
    assets.push({
      key,
      draft_id: draftId,
      student_id: studentId,
      revision,
      page_number: pageNumber,
      field,
      type: blob.type,
      size: blob.size,
      data,
    });
  }
  return { page: stored, assets };
}

function blobFromRecord(record, fallback) {
  if (!record) return null;
  if (record.data instanceof Blob) return record.data;
  if (record.data instanceof ArrayBuffer) return new Blob([record.data], { type: record.type || fallback?.type || '' });
  if (ArrayBuffer.isView(record.data)) return new Blob([record.data.buffer], { type: record.type || fallback?.type || '' });
  return null;
}

/** Restore a stored draft to the Blob interface consumed by scanner code. */
export function decodeDraft(draft, assets = [], { strict = false } = {}) {
  if (!draft?.pages) return draft;
  const byKey = new Map(assets.map(asset => [asset.key, asset]));
  for (const page of draft.pages) for (const field of DRAFT_BINARY_FIELDS) {
    const binary = page[field];
    if (binary?.axon_binary === 1 && binary.data instanceof ArrayBuffer) {
      page[field] = new Blob([binary.data], { type: binary.type });
      continue;
    }
    if (binary?.axon_asset !== 1) continue;
    const blob = blobFromRecord(byKey.get(binary.key), binary);
    if (!blob) {
      if (strict) throw new Error('This saved paper is missing local image data. Start a new scan or restore from the uploaded paper.');
      page[field] = null;
    } else page[field] = blob;
  }
  return draft;
}

/**
 * Apply a freshly committed metadata row back to the live hydrated draft
 * without re-reading any image bytes. Matching is by immutable capture
 * revision, so page moves/renumbering do not attach the wrong photo.
 */
export function mergeStoredDraft(target, stored, hydratedPages = []) {
  const sources = new Map();
  for (const page of [...(target.pages ?? []), ...hydratedPages]) sources.set(revisionOf(page), page);
  const merged = structuredClone(stored);
  for (const page of merged.pages ?? []) {
    const source = sources.get(revisionOf(page));
    for (const field of DRAFT_BINARY_FIELDS) {
      if (page[field]?.axon_asset !== 1 && page[field]?.axon_binary !== 1) continue;
      if (source?.[field] instanceof Blob) page[field] = source[field];
    }
  }
  for (const key of Object.keys(target)) if (!(key in merged)) delete target[key];
  Object.assign(target, merged);
  return target;
}
