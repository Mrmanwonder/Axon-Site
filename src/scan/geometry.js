// Quad geometry and perspective correction.
//
// Stage 1 warps a photographed page back to a rectangle. Everything downstream
// depends on that being right: a box read off a warped page cannot be shown back
// to the student as a crop that matches what they see, and the provenance rule
// is the whole defence against a vision model producing plausible fiction.
//
// Pure functions over plain arrays and ImageData, so the same code runs on the
// main thread, in a worker, and in the harness under Node.

import { makeImageData } from './imagedata.js';

/** @typedef {{x:number,y:number}} Point */
/** @typedef {[Point,Point,Point,Point]} Quad ordered tl, tr, br, bl */

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Put four unordered corners into tl, tr, br, bl.
 *
 * Sorting by angle around the centroid rather than by coordinate sums: the sum
 * trick fails on a page photographed at a steep angle, where the top-right
 * corner can genuinely have the smallest x + y.
 */
export function orderQuad(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const byAngle = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  // atan2 starts at -π, which is due left, so the first point is somewhere on
  // the left edge going clockwise in screen coordinates. Rotate until the
  // top-left — the one closest to the origin among the two leftmost — leads.
  let best = 0, bestScore = Infinity;
  for (let i = 0; i < 4; i++) {
    const p = byAngle[i];
    const score = p.x + p.y;
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return [0, 1, 2, 3].map((i) => byAngle[(best + i) % 4]);
}

/** Output size for a warped quad: the longest opposing edge on each axis. */
export function quadSize(quad) {
  const [tl, tr, br, bl] = quad;
  return {
    width: Math.round(Math.max(dist(tl, tr), dist(bl, br))),
    height: Math.round(Math.max(dist(tl, bl), dist(tr, br))),
  };
}

/** Share of a w×h frame the quad covers, by the shoelace formula. */
export function quadFill(quad, w, h) {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2) / (w * h);
}

/** Largest corner travel between two quads, as a share of the frame's short edge. */
export function quadDrift(a, b, w, h) {
  if (!a || !b) return Infinity;
  const short = Math.min(w, h) || 1;
  let worst = 0;
  for (let i = 0; i < 4; i++) worst = Math.max(worst, dist(a[i], b[i]));
  return worst / short;
}

/**
 * Solve the 3×3 homography taking `src` to `dst`, as a length-9 array.
 *
 * Eight unknowns, eight equations, one straight Gaussian elimination with
 * partial pivoting. No iteration and no library: this runs per captured page,
 * not per frame, and the closed form is exact.
 */
export function solveHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    b.push(Y);
  }

  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    if (Math.abs(A[pivot][col]) < 1e-10) return null; // degenerate quad
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      if (!f) continue;
      for (let c = col; c < 8; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }

  const h = b.map((v, i) => v / A[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Apply a homography to a point. */
export function project(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

/**
 * Warp `src` so that `quad` fills a `width`×`height` rectangle.
 *
 * Inverse mapping with bilinear sampling — walking the destination and pulling
 * from the source, so there are no holes. Pixels that fall outside the source
 * become page white rather than transparent black: a black border would read as
 * ink to the layer separator and as a huge dark component to the mark finder.
 */
export function warpPerspective(src, quad, width, height) {
  const dstQuad = [
    { x: 0, y: 0 }, { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 },
  ];
  const Hinv = solveHomography(dstQuad, quad);
  if (!Hinv) return null;

  const out = makeImageData(width, height);
  const s = src.data, d = out.data, sw = src.width, sh = src.height;

  // How many source pixels each destination pixel is standing in for. Bilinear
  // sampling reads four neighbours regardless, so on a real downscale it skips
  // most of the source — and what it skips is high-frequency detail, which is
  // exactly what a thin pen stroke is. IMAGE_PIPELINE.md §5.1 is blunt about the
  // symptom: a stroke aliases into a dashed line, and that reads as a quirk of
  // the student's handwriting rather than as an artefact we introduced.
  //
  // So the box is prefiltered: average over the footprint before interpolating.
  // The scale is measured at the quad's own size rather than assumed, because a
  // keystoned page is compressed at one end and not the other.
  const size = quadSize(quad);
  const scale = Math.max(size.width / width, size.height / height);
  const k = Math.max(1, Math.min(4, Math.round(scale)));
  const half = (k - 1) / 2;
  const norm = 1 / (k * k);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = Hinv[6] * x + Hinv[7] * y + Hinv[8];
      const sx = (Hinv[0] * x + Hinv[1] * y + Hinv[2]) / w;
      const sy = (Hinv[3] * x + Hinv[4] * y + Hinv[5]) / w;
      const o = (y * width + x) * 4;

      // Outside the source is page white, never transparent black — a black
      // border reads as ink to the mask and as one enormous dark component to
      // the mark finder.
      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
        d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = 255;
        continue;
      }

      if (k === 1) {
        sampleBilinear(s, sw, sh, sx, sy, d, o);
      } else {
        let r = 0, g = 0, b = 0;
        for (let j = 0; j < k; j++) {
          for (let i = 0; i < k; i++) {
            const px = Math.min(sw - 1, Math.max(0, Math.round(sx - half + i)));
            const py = Math.min(sh - 1, Math.max(0, Math.round(sy - half + j)));
            const q = (py * sw + px) * 4;
            r += s[q]; g += s[q + 1]; b += s[q + 2];
          }
        }
        d[o] = r * norm; d[o + 1] = g * norm; d[o + 2] = b * norm;
      }
      d[o + 3] = 255;
    }
  }
  return out;
}

function sampleBilinear(s, sw, sh, sx, sy, d, o) {
  const x0 = sx | 0, y0 = sy | 0;
  const x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
  const fx = sx - x0, fy = sy - y0;
  const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
  const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
  for (let c = 0; c < 3; c++) {
    const top = s[i00 + c] * (1 - fx) + s[i10 + c] * fx;
    const bot = s[i01 + c] * (1 - fx) + s[i11 + c] * fx;
    d[o + c] = top * (1 - fy) + bot * fy;
  }
}

/** Map a box measured on the warped page back to the original photograph. */
export function boxToSource(box, quad, width, height) {
  const dstQuad = [
    { x: 0, y: 0 }, { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 },
  ];
  const H = solveHomography(dstQuad, quad);
  if (!H) return null;
  const corners = [
    project(H, box.x, box.y), project(H, box.x + box.w, box.y),
    project(H, box.x + box.w, box.y + box.h), project(H, box.x, box.y + box.h),
  ];
  const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
