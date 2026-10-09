// Encode the unmodified video still off the UI thread where supported.
// The caller keeps its bitmap for geometry/conditioning; only a clone transfers.
import { withDeadline } from './deadline.js';

const ENCODE_TIMEOUT_MS = 20000;
let worker = null;
let nextId = 1;
const pending = new Map();

function disableWorker(error) {
  const failed = worker;
  worker = false;
  failed?.terminate?.();
  for (const settle of [...pending.values()]) settle({ ok: false, error });
  pending.clear();
}

function encoder() {
  if (worker !== null) return worker;
  if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function'
      || typeof OffscreenCanvas.prototype.convertToBlob !== 'function') {
    worker = false;
    return worker;
  }
  try {
    worker = new Worker(new URL('./still-encoder-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const settle = pending.get(data?.id);
      if (settle) { pending.delete(data.id); settle(data); }
    };
    worker.onerror = (event) => disableWorker(event?.message || 'The original encoder failed');
    worker.onmessageerror = () => disableWorker('The original encoder reply could not be read');
  } catch (error) {
    console.warn('[scan] original encoder unavailable; using canvas', error);
    worker = false;
  }
  return worker;
}

async function encodeInWorker(source, w) {
  const bitmap = await createImageBitmap(source);
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => disableWorker('Original encoding timed out'), ENCODE_TIMEOUT_MS);
    pending.set(id, (reply) => { clearTimeout(timer); resolve(reply); });
    try {
      w.postMessage({ id, bitmap }, [bitmap]);
    } catch (error) {
      bitmap.close?.(); // Transfer failed: ownership stayed here.
      disableWorker(String(error?.message ?? error));
    }
  });
}

async function encodeOnCanvas(source) {
  const canvas = document.createElement('canvas');
  try {
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The original photo could not be prepared');
    context.drawImage(source, 0, 0);
    return await withDeadline(() => new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob?.size
        ? resolve(blob) : reject(new Error('The original photo could not be encoded')), 'image/jpeg', 0.95);
    }), ENCODE_TIMEOUT_MS);
  } finally {
    canvas.width = canvas.height = 1;
  }
}

export async function encodeStill(source) {
  const w = encoder();
  if (w) {
    try {
      const reply = await encodeInWorker(source, w);
      if (reply.ok && reply.blob?.size) return reply.blob;
      console.warn('[scan] original encoder failed; using canvas', reply.error);
    } catch (error) {
      console.warn('[scan] original encoder could not prepare the frame; using canvas', error);
    }
  }
  return encodeOnCanvas(source);
}
