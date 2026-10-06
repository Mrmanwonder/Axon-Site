import { CAPTURE } from './contract.js';
export const ASSET_FIELDS = { page: 'r2_key', mask: 'mask_key', thumb: 'thumb_key', raw: 'original_key' };
export const revisionOf = page => page.upload_revision || 'legacy-' + page.page_number;
export const newRevision = () => crypto.randomUUID();
export function assetState(page, kind) {
  const saved = page.upload_assets?.[kind];
  if (saved) return saved;
  const key = page[ASSET_FIELDS[kind]];
  // Legacy confirmations require both the success marker and an actual key.
  return page.uploaded && key ? { status: 'confirmed', key, bucket: kind === 'raw' ? 'originals' : page.r2_bucket || 'derived' } : { status: 'pending' };
}
export function buildUploadPlan(draft) {
  const numbers = new Set();
  return [...draft.pages].sort((a, b) => a.page_number - b.page_number).flatMap(page => {
    if (!Number.isInteger(page.page_number) || page.page_number < 1 || numbers.has(page.page_number)) throw new Error('This booklet has an invalid page order.');
    numbers.add(page.page_number);
    if (!page.blob && !assetState(page, 'page').key) throw new Error('A page is missing its local image. Reopen this draft.');
    const blobs = { page: page.blob, mask: page.mask, thumb: page.thumb, raw: page.original };
    return ['page', 'mask', 'thumb', 'raw'].flatMap(kind => {
      const state = assetState(page, kind), blob = blobs[kind];
      if (!blob && !state.key) return [];
      const content_type = kind === 'mask' ? 'image/png' : kind === 'thumb' ? 'image/jpeg'
        : kind === 'raw' ? page.original_type || blob?.type || 'image/jpeg' : blob?.type || 'image/jpeg';
      if (blob && !CAPTURE.UPLOAD_EXTENSIONS[content_type]) throw new Error('This original format cannot be backed up. Keep the original file and use a supported image format.');
      const revision = revisionOf(page);
      return [{ id: revision + ':' + kind, revision, page_number: page.page_number, kind,
        name: 'p' + page.page_number + (kind === 'page' ? '' : kind === 'raw' ? '-original' : '-' + kind),
        blob, content_type, bytes: blob?.size ?? state.bytes ?? 0, state, critical: kind !== 'raw' }];
    });
  });
}
export const pendingUploadPlan = draft => buildUploadPlan(draft).filter(o => o.state.status !== 'confirmed');
export function processingReady(page) {
  return ['page', 'mask', 'thumb'].every(kind => {
    const needed = kind === 'page' || Boolean(page[kind] || page.upload_assets?.[kind] || page[ASSET_FIELDS[kind]]);
    const state = assetState(page, kind);
    return !needed || state.status === 'confirmed' && Boolean(state.key);
  });
}
export function backupComplete(page) {
  const state = assetState(page, 'raw');
  return !page.original && !page.upload_assets?.raw && !page.original_key || state.status === 'confirmed' && Boolean(state.key) && (!page.original_requires_attachment || state.attached === true);
}
export function splitUploadPlanIntoWindows(objects, max = 32, maxBytes = 8 * 1024 * 1024) {
  if (!Number.isInteger(max) || max < 4 || max > 60) throw new RangeError('Upload windows must hold 4–60 objects.');
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new RangeError('Upload byte windows must be positive.');
  const result = []; let window = [], bytes = 0;
  for (const number of [...new Set(objects.map(o => o.page_number))]) {
    const page = objects.filter(o => o.page_number === number);
    if (page.length > max) throw new Error('A page has too many upload assets.');
    const pageBytes = page.reduce((n, o) => n + o.bytes, 0);
    if (window.length && (window.length + page.length > max || bytes + pageBytes > maxBytes)) { result.push(window); window = []; bytes = 0; }
    if (pageBytes > maxBytes) {
      for (const object of page) {
        if (window.length && (window.length === max || bytes + object.bytes > maxBytes)) { result.push(window); window = []; bytes = 0; }
        window.push(object); bytes += object.bytes;
      }
    } else { window.push(...page); bytes += pageBytes; }
  }
  if (window.length) result.push(window);
  return result;
}
export function assertUploadSnapshot(draft, snapshot) {
  const expected = snapshot.map(p => [p.page_number, revisionOf(p)]);
  const current = draft.pages.map(p => [p.page_number, revisionOf(p)]);
  if (JSON.stringify(expected) !== JSON.stringify(current)) throw new Error('This booklet changed while sending. Send the current draft again.');
}
