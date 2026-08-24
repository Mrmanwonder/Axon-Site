// Small raster helpers shared by conditioning and layer separation.
//
// Both stages need the same thing from different angles: an estimate of what the
// page looks like underneath — underneath the lighting gradient in stage 1, and
// underneath the teacher's ink in stage 2. Both get it by averaging down to a
// coarse plane while ignoring the pixels they want to remove, then smoothly
// scaling that plane back up.
//
// Deliberately kept to typed arrays and integer arithmetic. This runs on a
// mid-tier Android phone against an eight-megapixel page.

/**
 * Average an image down to `outW`×`outH`, skipping any pixel `exclude` marks.
 *
 * Cells with nothing left after exclusion are filled from their neighbours in a
 * second pass rather than left at zero — a zero cell is black, and black is ink,
 * which is the opposite of what an excluded region should read as.
 *
 * @param {{data:Uint8ClampedArray,width:number,height:number}} img
 * @param {Uint8Array|null} exclude 1 = leave this pixel out of the estimate
 */
export function coarsePlane(img, outW, outH, exclude = null) {
  const { data, width, height } = img;
  const n = outW * outH;
  const sum = new Float32Array(n * 3);
  const count = new Uint32Array(n);

  for (let y = 0; y < height; y++) {
    const oy = Math.min(outH - 1, (y * outH / height) | 0);
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (exclude && exclude[p]) continue;
      const ox = Math.min(outW - 1, (x * outW / width) | 0);
      const o = oy * outW + ox;
      const i = p * 4;
      sum[o * 3] += data[i];
      sum[o * 3 + 1] += data[i + 1];
      sum[o * 3 + 2] += data[i + 2];
      count[o]++;
    }
  }

  const plane = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    if (count[i]) {
      plane[i * 3] = sum[i * 3] / count[i];
      plane[i * 3 + 1] = sum[i * 3 + 1] / count[i];
      plane[i * 3 + 2] = sum[i * 3 + 2] / count[i];
    }
  }
  fillEmpty(plane, count, outW, outH);
  return plane;
}

/** Grow known cells outward until every empty cell has a value. */
function fillEmpty(plane, count, w, h) {
  const known = Uint8Array.from(count, (c) => (c ? 1 : 0));
  let remaining = 0;
  for (let i = 0; i < known.length; i++) if (!known[i]) remaining++;
  if (remaining === known.length) { plane.fill(235); return; } // nothing known: page white
  const offs = [-1, 1, -w, w];

  let guard = w + h;
  while (remaining > 0 && guard-- > 0) {
    const next = known.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const off of offs) {
          const j = i + off;
          if (j < 0 || j >= known.length) continue;
          if (off === -1 && x === 0) continue;
          if (off === 1 && x === w - 1) continue;
          if (!known[j]) continue;
          r += plane[j * 3]; g += plane[j * 3 + 1]; b += plane[j * 3 + 2]; n++;
        }
        if (!n) continue;
        plane[i * 3] = r / n; plane[i * 3 + 1] = g / n; plane[i * 3 + 2] = b / n;
        next[i] = 1; remaining--;
      }
    }
    known.set(next);
  }
}

/** Bilinear sample of a coarse RGB plane at full-image coordinates. */
export function samplePlane(plane, planeW, planeH, x, y, width, height, out) {
  const fx = Math.min(planeW - 1, Math.max(0, (x + 0.5) * planeW / width - 0.5));
  const fy = Math.min(planeH - 1, Math.max(0, (y + 0.5) * planeH / height - 0.5));
  const x0 = fx | 0, y0 = fy | 0;
  const x1 = Math.min(x0 + 1, planeW - 1), y1 = Math.min(y0 + 1, planeH - 1);
  const tx = fx - x0, ty = fy - y0;
  const i00 = (y0 * planeW + x0) * 3, i10 = (y0 * planeW + x1) * 3;
  const i01 = (y1 * planeW + x0) * 3, i11 = (y1 * planeW + x1) * 3;
  for (let c = 0; c < 3; c++) {
    const top = plane[i00 + c] * (1 - tx) + plane[i10 + c] * tx;
    const bot = plane[i01 + c] * (1 - tx) + plane[i11 + c] * tx;
    out[c] = top * (1 - ty) + bot * ty;
  }
  return out;
}

/** Dilate a binary mask by one pixel, 4-connected. Catches anti-aliased fringes. */
export function dilate(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) { out[i] = 1; continue; }
      if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) ||
          (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) out[i] = 1;
    }
  }
  return out;
}
