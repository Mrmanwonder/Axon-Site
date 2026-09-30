// Cheap document-level visual similarity for duplicate capture detection.
//
// This intentionally works on the already-conditioned page pixels: perspective
// and broad illumination have been normalized by then, while the student's
// actual writing/marks are still intact. No OCR or content leaves the device.

export const DUPLICATE_HASH_GRID = 16;
export const DUPLICATE_HASH_BITS = 496;
// 40/496 differing bits is deliberately conservative. The prompt is
// non-destructive, but false duplicate prompts on repetitive exam templates are
// still distracting. Tune only against real multi-page papers.
export const DUPLICATE_MAX_DISTANCE = 40;

function luma(data, index) {
  return data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
}

function cellMean(img, cellX, cellY) {
  const { data, width, height } = img;
  let sum = 0;
  let count = 0;
  // Nine samples per block are enough to capture text density without a full
  // second pass across every page pixel.
  for (let sy = 0; sy < 3; sy++) {
    const y = Math.min(
      height - 1,
      Math.max(0, Math.floor(((cellY + (sy + 0.5) / 3) / DUPLICATE_HASH_GRID) * height)),
    );
    for (let sx = 0; sx < 3; sx++) {
      const x = Math.min(
        width - 1,
        Math.max(0, Math.floor(((cellX + (sx + 0.5) / 3) / DUPLICATE_HASH_GRID) * width)),
      );
      sum += luma(data, (y * width + x) * 4);
      count++;
    }
  }
  return count ? sum / count : 0;
}

function bitsToHex(bits) {
  let out = '';
  for (let i = 0; i < bits.length; i += 4) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit++) nibble = (nibble << 1) | (bits[i + bit] ? 1 : 0);
    out += nibble.toString(16);
  }
  return out;
}

/**
 * 496-bit page fingerprint:
 *  - 256 block-density bits (brightness-normalized);
 *  - 240 horizontal gradient bits (local structure).
 */
export function perceptualPageHash(img) {
  if (!img?.data || !(img.width > 0) || !(img.height > 0)) return null;
  const cells = new Float64Array(DUPLICATE_HASH_GRID * DUPLICATE_HASH_GRID);
  let mean = 0;
  for (let y = 0; y < DUPLICATE_HASH_GRID; y++) {
    for (let x = 0; x < DUPLICATE_HASH_GRID; x++) {
      const value = cellMean(img, x, y);
      cells[y * DUPLICATE_HASH_GRID + x] = value;
      mean += value;
    }
  }
  mean /= cells.length;

  const bits = [];
  for (const value of cells) bits.push(value < mean);
  for (let y = 0; y < DUPLICATE_HASH_GRID; y++) {
    for (let x = 0; x < DUPLICATE_HASH_GRID - 1; x++) {
      const at = y * DUPLICATE_HASH_GRID + x;
      bits.push(cells[at] > cells[at + 1]);
    }
  }
  return bitsToHex(bits);
}

const POPCOUNT = Object.freeze([0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]);

export function hashDistance(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return Infinity;
  }
  let distance = 0;
  for (let i = 0; i < left.length; i++) {
    const a = Number.parseInt(left[i], 16);
    const b = Number.parseInt(right[i], 16);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
    distance += POPCOUNT[a ^ b];
  }
  return distance;
}

export function closestDuplicatePage(pages, fingerprint, {
  excludePageNumber = null,
  maxDistance = DUPLICATE_MAX_DISTANCE,
} = {}) {
  if (!fingerprint) return null;
  let best = null;
  for (const page of pages ?? []) {
    if (page?.page_number === excludePageNumber) continue;
    const candidate = page?.fingerprint ?? page?.meta?.page_fingerprint;
    const distance = hashDistance(fingerprint, candidate);
    if (!Number.isFinite(distance) || distance > maxDistance) continue;
    if (!best || distance < best.distance) {
      best = {
        pageNumber: page.page_number,
        distance,
        similarity: 1 - distance / DUPLICATE_HASH_BITS,
      };
    }
  }
  return best;
}
