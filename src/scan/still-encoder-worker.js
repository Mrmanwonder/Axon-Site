// Full-resolution originals use exactly the old JPEG quality, on a dedicated
// worker so neither live detection nor conditioning queues hold up the encode.
export async function encodeTransferredStill(bitmap) {
  let canvas;
  try {
    canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The original photo could not be prepared');
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
    if (!blob?.size) throw new Error('The original photo could not be encoded');
    return blob;
  } finally {
    bitmap?.close?.();
    if (canvas) canvas.width = canvas.height = 1;
  }
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = async ({ data: { id, bitmap } }) => {
    try {
      const blob = await encodeTransferredStill(bitmap);
      self.postMessage({ id, ok: true, blob });
    } catch (error) {
      self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
    }
  };
}
