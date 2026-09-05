// Showing a field against the pixels it was read from.
//
// This is the payoff for the provenance rule, and the reason it is worth the
// trouble upstream: because every extracted value carries the box it came from,
// the review screen can put the number next to the crop and let the student
// decide in a glance rather than take our word for it.
//
// Crops are cut in the browser from the page image rather than stored
// separately. The image itself lives in R2 behind a short-lived signed URL —
// `pageImageUrl` asks mastery-api for one — and cutting a crop from it here is
// free, so storing a second copy of every region would multiply what we hold of
// a child's handwriting for no gain — the retention rule wants less, not more.
//
// The cut is made with CSS, not with a canvas, and that is deliberate. The
// canvas version had to `fetch` the bytes to build an ImageBitmap, which makes
// it a cross-origin read: it needs `Access-Control-Allow-Origin` on the asset
// response, and for a long time it did not get one, so every crop in the app
// failed at once and said "we could not show this part of the page" — which
// reads like a scan problem rather than the header problem it was. The worker
// sends the header now, but an `<img>` never needed it: displaying a
// cross-origin image is not a read of it. Positioning that `<img>` inside an
// overflow-hidden box gets the same crop with no fetch, no canvas, no object
// URL to leak, and no second decode of a page we are already showing.

import { pageAssetUrl } from '../papers.js';

// Signed asset URLs last ten minutes (GET_TTL_SECONDS in the backend's r2.ts).
// A student can sit on a review screen far longer than that, so the cached URL
// is retired well before the signature is, and `<Crop>` re-asks on an error.
const URL_TTL_MS = 8 * 60 * 1000;

const urls = new Map(); // "paperId:pageNumber" → { at, promise }

/**
 * A signed URL for one page's stored image, or null if it has none yet.
 *
 * Cached per page so a twenty-question review asks once per page rather than
 * once per question, and re-signed before the signature expires under a student
 * who has been reading for a while.
 */
export function pageImageUrl(paperId, pageNumber, { force = false } = {}) {
  const key = `${paperId}:${pageNumber}`;
  const hit = urls.get(key);
  if (!force && hit && Date.now() - hit.at < URL_TTL_MS) return hit.promise;

  const promise = pageAssetUrl(paperId, pageNumber)
    .then(({ url }) => url ?? null)
    .catch(() => null);
  urls.set(key, { at: Date.now(), promise });
  return promise;
}

/**
 * The box to show, padded a little.
 *
 * Padded because a box cut exactly to the region loses the question number on
 * one side and the marginal mark on the other — the two things the student most
 * needs to see to judge whether we read it right. Clamped to the page, so a
 * region against an edge pads inward instead of off the paper.
 *
 * `naturalWidth`/`naturalHeight` come from the loaded `<img>`, which is the only
 * place the page's real pixel size is known on the client.
 */
export function paddedBox(box, naturalWidth, naturalHeight, pad = 0.05) {
  const padX = box.w * pad, padY = box.h * pad;
  const x = Math.max(0, box.x - padX);
  const y = Math.max(0, box.y - padY);
  const w = Math.min(naturalWidth - x, box.w + padX * 2);
  const h = Math.min(naturalHeight - y, box.h + padY * 2);
  if (!(w > 0) || !(h > 0)) return null;
  return { x, y, w, h };
}

/**
 * The CSS that puts `box` of a `naturalWidth × naturalHeight` page inside a
 * container, with no canvas and no fetch.
 *
 * The container takes the crop's aspect ratio; the image is blown up so the
 * crop fills the container's width, then translated so the crop's top-left
 * lands at the container's. Both translations are percentages of the image's
 * own rendered size, which is what makes this hold at any container width
 * without measuring anything — it survives a resize, a rotate and a rail-to-tab
 * layout change with no JS at all.
 */
export function cropStyles(box, naturalWidth, naturalHeight, pad = 0.05) {
  const b = paddedBox(box, naturalWidth, naturalHeight, pad);
  if (!b) return null;
  return {
    frame: { aspectRatio: `${b.w} / ${b.h}` },
    image: {
      width: `${(naturalWidth / b.w) * 100}%`,
      transform: `translate(${(-b.x / naturalWidth) * 100}%, ${(-b.y / naturalHeight) * 100}%)`,
    },
  };
}

/** Let go of the cached URLs when a paper's review closes. */
export function releaseCrops() {
  urls.clear();
}
