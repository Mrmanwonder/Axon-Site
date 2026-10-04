import { ASSET_FIELDS, assetState, processingReady, backupComplete, revisionOf, newRevision } from './upload-plan.js';
export function renumberPages(pages) {
  return pages.map((page, i) => {
    if (page.page_number === i + 1) return page;
    return { ...page, page_number: i + 1, upload_revision: newRevision(),
      // Canonical asset names and server-issued bindings include page number.
      // Retain all bytes but remint assets whose page position changed.
      upload_assets: {}, uploaded: false,
      r2_key: null, mask_key: null, thumb_key: null, original_key: null };
  });
}
export function applyAssetUpdates(fresh, updates) {
  const accepted = [], stale = [];
  for (const { descriptor: d, state } of updates) {
    const page = fresh.pages.find(p => p.page_number === d.page_number && revisionOf(p) === d.revision);
    if (!page) { stale.push(d.id); continue; }
    const before = assetState(page, d.kind);
    if (before.status === 'confirmed') {
      if (state.key && before.key !== state.key) stale.push(d.id);
      else accepted.push(d.id);
      continue;
    }
    if (before.key && state.key && before.key !== state.key && state.status !== 'uploading') { stale.push(d.id); continue; }
    if (state.status === 'confirmed' && (!state.key || !['derived', 'originals'].includes(state.bucket))) throw new Error('Server confirmation is incomplete.');
    page.upload_revision = d.revision; page.upload_assets ??= {};
    page.upload_assets[d.kind] = { ...state, bytes: d.bytes };
    if (state.status === 'confirmed') {
      page[ASSET_FIELDS[d.kind]] = state.key;
      if (d.kind === 'page') { page.r2_bucket = state.bucket; page.bytes = d.bytes; }
    }
    // Preserve blobs until submit/attachment is durable, including originals.
    page.uploaded = processingReady(page) && backupComplete(page); accepted.push(d.id);
  }
  return { accepted, stale };
}
