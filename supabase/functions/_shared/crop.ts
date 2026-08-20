// Cutting a question out of a page.
//
// Cropping is what makes the content pass affordable and accurate at the same
// time. Sending whole pages to a frontier model on a sixteen-page booklet costs
// roughly an order of magnitude more than sending crops, and it reads worse,
// because the model is holding a whole booklet in context while trying to make
// out one line of a child's handwriting. It also localises failure: a crop that
// goes wrong takes one question with it instead of poisoning a page.
//
// A little padding is added around each region. Question numbers sit just
// outside the answer area and marginal marks sit just outside that, so a box cut
// exactly to the region reliably slices off the two things worth most.

import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { base64 } from './http.ts';

export interface PixelBox { x: number; y: number; w: number; h: number }

const PAD = 0.04;          // share of the region's own size, added on each side
const MAX_LONG_EDGE = 1600; // beyond this a crop is paying for pixels it does not need

/**
 * Crop a region out of a page and return it as base64 JPEG.
 *
 * Returns null rather than throwing. A crop that cannot be made is a question
 * whose content pass has to fall back to the whole page — slower and dearer, but
 * visible in the run's metadata and not a lost question.
 */
export async function cropRegion(
  pageBytes: Uint8Array,
  box: PixelBox,
): Promise<{ data: string; media_type: string; width: number; height: number } | null> {
  try {
    const image = await Image.decode(pageBytes);
    const padX = box.w * PAD, padY = box.h * PAD;
    const x = Math.max(0, Math.floor(box.x - padX));
    const y = Math.max(0, Math.floor(box.y - padY));
    const w = Math.min(image.width - x, Math.ceil(box.w + padX * 2));
    const h = Math.min(image.height - y, Math.ceil(box.h + padY * 2));
    if (w < 8 || h < 8) return null;

    const cropped = image.crop(x, y, w, h);
    const longEdge = Math.max(cropped.width, cropped.height);
    if (longEdge > MAX_LONG_EDGE) {
      const scale = MAX_LONG_EDGE / longEdge;
      cropped.resize(Math.round(cropped.width * scale), Math.round(cropped.height * scale));
    }

    // Quality 88 rather than the usual 75: this crop is the one the review
    // screen shows the student against the field it produced, and a compression
    // artefact on a thin red stroke is exactly the detail that must survive.
    const encoded = await cropped.encodeJPEG(88);
    return {
      data: base64(encoded),
      media_type: 'image/jpeg',
      width: cropped.width,
      height: cropped.height,
    };
  } catch {
    return null;
  }
}

/** Where a crop's box sits back on the full page, so provenance survives the cut. */
export function cropToPage(cropBox: PixelBox, region: PixelBox): PixelBox {
  const padX = region.w * PAD, padY = region.h * PAD;
  return {
    x: Math.round(region.x - padX + cropBox.x),
    y: Math.round(region.y - padY + cropBox.y),
    w: Math.round(cropBox.w),
    h: Math.round(cropBox.h),
  };
}
