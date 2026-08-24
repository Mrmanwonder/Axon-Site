/* ═══════════════════════════════════════════════════════════════════════════
   DISPLACEMENT LENS

   Ported verbatim from reference/prototype.html.

   The tab bar's highlight is a real feDisplacementMap: this builds the
   displacement map itself as a canvas, encoding a rounded-rect bevel into the
   red and green channels. AGENTS.md is explicit that this must not be swapped
   for backdrop-filter — the refraction is the point of the design, and a blur
   is not a refraction.

   The map is a pure function of size, so it is cached. A resize storm or a
   rapid re-pick would otherwise rebuild an identical canvas every frame, and
   toDataURL is not cheap on a budget Android.
   ═══════════════════════════════════════════════════════════════════════════ */

export type LensOptions = {
  w: number;
  h: number;
  radius: number;
  depth?: number;
  curvature?: number;
};

export function generateLensMap({ w, h, radius, depth = 12, curvature = 2.3 }: LensOptions): string {
  const cv = document.createElement("canvas");
  cv.width = Math.round(w);
  cv.height = Math.round(h);

  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(cv.width, cv.height);
  const D = img.data;
  const W = cv.width;
  const H = cv.height;
  const hw = W / 2;
  const hh = H / 2;
  const r = Math.min(radius, hw, hh);

  const put = (x: number, y: number, dx: number, dy: number) => {
    const i = (y * W + x) * 4;
    D[i] = 128 + dx * 127;
    D[i + 1] = 128 + dy * 127;
    D[i + 2] = 128;
    D[i + 3] = 255;
  };

  // Only the top-left quadrant is computed; the other three are mirrored, with
  // the displacement vector's sign flipped per axis.
  for (let y = 0; y < Math.ceil(hh); y++) {
    for (let x = 0; x < Math.ceil(hw); x++) {
      const px = x + .5 - hw;
      const py = y + .5 - hh;
      const qx = Math.abs(px) - (hw - r);
      const qy = Math.abs(py) - (hh - r);
      const mx = Math.max(qx, 0);
      const my = Math.max(qy, 0);
      const inward = -(Math.hypot(mx, my) + Math.min(Math.max(qx, qy), 0) - r);

      let dx = 0;
      let dy = 0;

      if (inward >= 0 && inward < depth) {
        const mag = Math.pow(1 - inward / depth, curvature);
        let nx: number;
        let ny: number;
        if (qx > 0 || qy > 0) {
          const l = Math.hypot(mx, my) || 1;
          nx = mx / l * Math.sign(px);
          ny = my / l * Math.sign(py);
        } else if (qx > qy) {
          nx = Math.sign(px);
          ny = 0;
        } else {
          nx = 0;
          ny = Math.sign(py);
        }
        dx = -nx * mag;
        dy = -ny * mag;
      }

      const xr = W - 1 - x;
      const yb = H - 1 - y;
      put(x, y, dx, dy);
      if (xr !== x) put(xr, y, -dx, dy);
      if (yb !== y) put(x, yb, dx, -dy);
      if (xr !== x && yb !== y) put(xr, yb, -dx, -dy);
    }
  }

  ctx.putImageData(img, 0, 0);
  return cv.toDataURL();
}

const lensCache = new Map<string, string>();

/** Cached by rounded pixel size. Cheap to call freely, which matters because
    the map must be regenerated on every breakpoint crossing. */
export function lensMapFor(w: number, h: number, radius: number): string {
  const k = `${Math.round(w)}x${Math.round(h)}r${radius}`;
  let v = lensCache.get(k);
  if (!v) {
    v = generateLensMap({ w, h, radius });
    lensCache.set(k, v);
  }
  return v;
}

export const PILL_R = 26;
