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
//
// Two sources for that signed URL, depending on when the page was uploaded.
// storage_path is the old Supabase Storage path, kept working for papers
// ingested before the Cloudflare cutover; r2_key is workers/README.md's
// pipeline, and the URL for it comes from mastery-api's /page-asset-urls
// rather than from Supabase directly, since the signing secret is a Worker
// secret the client never holds.

import { pageUrl } from '../papers.js';
import { pageAssetUrls } from '../mastery.js';

const pages = new Map();  // cache key → Promise<ImageBitmap>
const crops = new Map();  // cache key → object URL

/**
 * @param {{page_number:number, storage_path?:string|null, paper_id?:string}} page
 */
async function pageBitmap(page) {
  const key = page.storage_path ?? `r2:${page.paper_id}:${page.page_number}`;
  if (!pages.has(key)) {
    pages.set(key, (async () => {
      const url = page.storage_path
        ? await pageUrl(page.storage_path, 600)
        : await r2PageUrl(page.paper_id, page.page_number);
      if (!url) throw new Error('no URL for that page');
      const response = await fetch(url);
      if (!response.ok) throw new Error('that page could not be fetched');
      return createImageBitmap(await response.blob());
    })());
  }
  return pages.get(key);
}

// One request per paper covers every question on it. review.js knows every
// page number a run touches before it asks for a single crop, so it primes
// this once per paper rather than leaving cropUrl to fetch one page number
// at a time.
const r2UrlBatches = new Map(); // paper_id → Promise<{[page_number]: {url, mask_url}}>

/** Called once by review.js's loadReview, before any cropUrl for this paper. */
export function primeR2Urls(paperId, pageNumbers) {
  if (!pageNumbers.length) return;
  r2UrlBatches.set(paperId, pageAssetUrls({ paperId, pageNumbers }).then((r) => r.urls));
}

async function r2PageUrl(paperId, pageNumber) {
  const batch = r2UrlBatches.get(paperId) ?? pageAssetUrls({ paperId, pageNumbers: [pageNumber] }).then((r) => r.urls);
  const urls = await batch;
  return urls[pageNumber]?.url ?? null;
}

/**
 * An object URL for one region of one page.
 *
 * Padded a little, because a box cut exactly to the region loses the question
 * number on one side and the marginal mark on the other — the two things the
 * student most needs to see to judge whether we read it right.
 *
 * @param {{page_number:number, storage_path?:string|null, paper_id?:string}} page
 */
export async function cropUrl(page, box, { pad = 0.05, maxWidth = 900 } = {}) {
  const pageKey = page.storage_path ?? `r2:${page.paper_id}:${page.page_number}`;
  const key = `${pageKey}:${box.x},${box.y},${box.w},${box.h}`;
  if (crops.has(key)) return crops.get(key);

  let bitmap;
  try { bitmap = await pageBitmap(page); }
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
  r2UrlBatches.clear();
}
