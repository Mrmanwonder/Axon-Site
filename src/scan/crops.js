// Showing a field against the pixels it was read from.
//
// This is the payoff for the provenance rule, and the reason it is worth the
// trouble upstream: because every extracted value carries the box it came from,
// the review screen can put the number next to the crop and let the student
// decide in a glance rather than take our word for it.
//
// Crops are cut in the browser from the page image rather than stored
// separately. A page is already on the device or a signed URL away, cutting is
// free, and storing a second copy of every region would multiply what we hold of
// a child's handwriting for no gain — the retention rule wants less, not more.

import { pageUrl } from '../papers.js';

const pages = new Map();  // storage path → Promise<ImageBitmap>
const crops = new Map();  // cache key → object URL

async function pageBitmap(storagePath) {
  if (!pages.has(storagePath)) {
    pages.set(storagePath, (async () => {
      const url = await pageUrl(storagePath, 600);
      const response = await fetch(url);
      if (!response.ok) throw new Error('that page could not be fetched');
      return createImageBitmap(await response.blob());
    })());
  }
  return pages.get(storagePath);
}

/**
 * An object URL for one region of one page.
 *
 * Padded a little, because a box cut exactly to the region loses the question
 * number on one side and the marginal mark on the other — the two things the
 * student most needs to see to judge whether we read it right.
 */
export async function cropUrl(storagePath, box, { pad = 0.05, maxWidth = 900 } = {}) {
  const key = `${storagePath}:${box.x},${box.y},${box.w},${box.h}`;
  if (crops.has(key)) return crops.get(key);

  let bitmap;
  try { bitmap = await pageBitmap(storagePath); }
  catch { return null; }

  const padX = box.w * pad, padY = box.h * pad;
  const x = Math.max(0, Math.round(box.x - padX));
  const y = Math.max(0, Math.round(box.y - padY));
  const w = Math.min(bitmap.width - x, Math.round(box.w + padX * 2));
  const h = Math.min(bitmap.height - y, Math.round(box.h + padY * 2));
  if (w < 4 || h < 4) return null;

  const scale = Math.min(1, maxWidth / w);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d').drawImage(bitmap, x, y, w, h, 0, 0, canvas.width, canvas.height);

  const url = await new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/jpeg', 0.9));
  if (url) crops.set(key, url);
  return url;
}

/** Let go of the object URLs when a paper's review closes. */
export function releaseCrops() {
  for (const url of crops.values()) URL.revokeObjectURL(url);
  crops.clear();
  for (const promise of pages.values()) promise.then((b) => b.close?.()).catch(() => {});
  pages.clear();
}
