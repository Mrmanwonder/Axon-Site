// Persist binary bytes rather than Blob handles. Some WebKit installations
// reject IndexedDB Blob writes; ArrayBuffers preserve the same bytes and MIME.
// Encoding happens before opening a write transaction, never during a fresh-row
// reducer. Reads restore the scanner's Blob interface without schema changes.
const FIELDS = ['blob', 'mask', 'thumb', 'original', 'proxy'];
export async function encodeCapturedPage(page) {
  const encoded = structuredClone(page);
  for (const field of FIELDS) {
    const blob = encoded[field];
    if (blob instanceof Blob) encoded[field] = {
      axon_binary: 1, type: blob.type, size: blob.size, data: await blob.arrayBuffer(),
    };
  }
  return encoded;
}
export function decodeDraft(draft) {
  if (!draft?.pages) return draft;
  for (const page of draft.pages) for (const field of FIELDS) {
    const binary = page[field];
    if (binary?.axon_binary === 1 && binary.data instanceof ArrayBuffer) page[field] = new Blob([binary.data], { type: binary.type });
  }
  return draft;
}
