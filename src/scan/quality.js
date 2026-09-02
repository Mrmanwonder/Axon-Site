// The per-page quality gate.
//
// Runs at capture, on accept, while the paper is still physically in front of
// the student. That placement is the whole point: a page flagged here costs one
// retake, and the same page flagged forty seconds later at review costs a trip
// back to the schoolbag, which in practice means the page is simply lost.
//
// ── what changed, and why it had to ────────────────────────────────────────
//
// Rewritten 2026-09-01 (AXON_FIX_BRIEF.md §7.4). Three of the four measures
// here were computing the wrong quantity, and the way each was wrong is worth
// keeping written down, because each looks reasonable until it meets real data:
//
// · **Sharpness was scale-dependent, and inverted.** Variance of the Laplacian
//   rises as an image is downscaled, because downscaling concentrates
//   high-frequency energy. The same fixture measured 1.0000 at 240px wide and
//   0.1393 at 1400px. The live gate searches a 240px proxy and the final gate
//   scores a 2400px page, so the two ends of the same threshold were reading
//   opposite answers off the same paper: the live blur check could never fire,
//   and the final one warned on pages that were fine.
//
// · **Glare was an exposure detector.** It counted bright, colourless pixels
//   absolutely — which is a description of white paper. Live values were
//   bimodal: 0.94-0.998 for digital scans, 0.000-0.003 for phone photographs,
//   and uncorrelated with whether the teacher's ink survived. Production told a
//   student who had submitted a clean scan to "tilt it away from the light".
//
// · **Clipping had the identical defect**, for the identical reason: every
//   pixel of white paper has all three channels at 255.
//
// The replacements are all *page-relative*. Sharpness is measured at a fixed
// scale relative to the page, on patches that actually contain something. Glare
// is measured against the page's own illumination field. Clipping counts only
// pixels that still have colour in them, which is the case it was written for —
// a red stroke flattened into the paper — and not white paper being white.
//
// Every threshold is in contract.js with the measurement behind it.

import { QUALITY } from './contract.js';

/** Luma plane, Rec. 601. Cheap and good enough for gradient work. */
export function toGray(img) {
  const { data, width, height } = img;
  const g = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; p < g.length; p++, i += 4) {
    g[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return g;
}

/**
 * Resample a luma plane. Box-filter down, bilinear up.
 *
 * Pure, and deliberately not the browser's resampler: this runs on the main
 * thread, in the Web Worker and in Node under bench/ and harness/, and a
 * sharpness number that depended on which of the three was asking would defeat
 * the entire point of measuring at a canonical scale.
 *
 * The two directions need different filters and getting that wrong is not
 * subtle. Nearest-neighbour on the way up replicates edges blockily, which
 * reads as *more* sharp than the source — so an undersized page would score
 * better the further it was from the camera.
 */
export function resampleGray(gray, width, height, targetW, targetH) {
  const out = new Float64Array(targetW * targetH);

  if (targetW >= width || targetH >= height) {
    for (let ty = 0; ty < targetH; ty++) {
      const sy = Math.min(height - 1, Math.max(0, (ty + 0.5) * height / targetH - 0.5));
      const y0 = Math.floor(sy), y1 = Math.min(height - 1, y0 + 1), fy = sy - y0;
      for (let tx = 0; tx < targetW; tx++) {
        const sx = Math.min(width - 1, Math.max(0, (tx + 0.5) * width / targetW - 0.5));
        const x0 = Math.floor(sx), x1 = Math.min(width - 1, x0 + 1), fx = sx - x0;
        const a = gray[y0 * width + x0], b = gray[y0 * width + x1];
        const c = gray[y1 * width + x0], d = gray[y1 * width + x1];
        out[ty * targetW + tx] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      }
    }
    return out;
  }

  for (let ty = 0; ty < targetH; ty++) {
    const y0 = Math.floor(ty * height / targetH);
    const y1 = Math.max(y0 + 1, Math.floor((ty + 1) * height / targetH));
    for (let tx = 0; tx < targetW; tx++) {
      const x0 = Math.floor(tx * width / targetW);
      const x1 = Math.max(x0 + 1, Math.floor((tx + 1) * width / targetW));
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) { sum += gray[y * width + x]; n++; }
      }
      out[ty * targetW + tx] = sum / (n || 1);
    }
  }
  return out;
}

/** Laplacian variance and luma range over one patch of a plane. */
function patchStats(plane, width, x0, y0, size) {
  let sum = 0, sumSq = 0, n = 0, lo = 255, hi = 0;
  for (let y = y0 + 1; y < y0 + size - 1; y++) {
    for (let x = x0 + 1; x < x0 + size - 1; x++) {
      const i = y * width + x;
      const v = plane[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      const lap = 4 * v - plane[i - 1] - plane[i + 1] - plane[i - width] - plane[i + width];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  if (!n) return null;
  return { variance: sumSq / n - (sum / n) ** 2, range: hi - lo };
}

/**
 * How sharp this page is, at a scale that means the same thing everywhere.
 *
 * Two decisions carry this, and both were bugs before:
 *
 * **The page is resampled to MEASURE_LONG_EDGE first.** Sharpness is a property
 * of the paper, not of how many pixels happen to be pointed at it, so it has to
 * be read at a fixed page-relative scale or the number is meaningless across
 * the three places this runs. Measured on the two production-scale submitted
 * pages, the raw statistic is stable above the resolution floor — 4979 at
 * 2400px against 4693 at native 3301px — and falls off honestly below it, which
 * is correct: a 1200px page really does hold half the detail.
 *
 * **It is a high percentile over patches, not a whole-page number.** Variance
 * over the whole page averages written areas together with blank paper, so a
 * lightly-used page read as blurred for having little on it. A patch flatter
 * than MEASURE_MIN_RANGE carries no information about focus and is dropped
 * rather than counted as soft — blank paper is not evidence of anything.
 *
 * Returns the normalised score plus the raw statistic and how many patches
 * survived, because a page where nothing survived is a different fact from a
 * page that is soft, and a refusal has to be able to say which.
 */
export function sharpness(img, { scale = null } = {}) {
  const gray = toGray(img);
  // `scale` is for a caller that has already drawn its pixels at the canonical
  // scale — the live gate cuts a window out of the video at exactly that ratio,
  // so resampling it again here would measure the resampler. Everyone else
  // hands over a whole page and gets the ratio computed for them.
  const factor = scale ?? (QUALITY.MEASURE_LONG_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * factor));
  const h = Math.max(1, Math.round(img.height * factor));
  const plane = resampleGray(gray, img.width, img.height, w, h);

  const size = Math.min(QUALITY.MEASURE_PATCH, w, h);
  const cols = Math.max(1, Math.floor(w / size));
  const rows = Math.max(1, Math.floor(h / size));

  const kept = [];
  let considered = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const stats = patchStats(plane, w, c * size, r * size, size);
      if (!stats) continue;
      considered++;
      if (stats.range < QUALITY.MEASURE_MIN_RANGE) continue;
      kept.push(stats.variance);
    }
  }

  // Nothing on the page to focus on. Not "blurred" — blank. Reported as such
  // rather than scored zero, which would refuse an empty answer sheet for the
  // wrong reason.
  if (!kept.length) return { score: 0, raw: 0, patches: 0, considered, blank: true };

  kept.sort((a, b) => a - b);
  const raw = kept[Math.min(kept.length - 1, Math.floor(kept.length * QUALITY.MEASURE_QUANTILE))];
  return {
    score: Math.min(1, raw / QUALITY.BLUR_NORMALISER),
    raw: Math.round(raw),
    patches: kept.length,
    considered,
    blank: false,
  };
}

/** Backwards-compatible scalar. `sharpness()` is the one with the evidence in it. */
export function blurScore(gray, width, height) {
  // Rebuild the RGBA shape the patch measure works on. Callers that already
  // have an ImageData should call sharpness() directly and skip this.
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    data[i] = data[i + 1] = data[i + 2] = gray[p];
    data[i + 3] = 255;
  }
  return sharpness({ data, width, height }).score;
}

/**
 * Where to cut the focus window, and how big to draw it.
 *
 * Pure geometry, shared rather than reimplemented, because the two callers work
 * in different worlds and the *rectangle* is the only part that could silently
 * drift between them: capture.js hands it to `drawImage` on a live video
 * element, bench/ crops a decoded fixture with it. If those two ever disagreed
 * about which pixels the phone measures, the agreement report would be checking
 * the live gate against a slightly different live gate.
 *
 * `pageLongEdge` is the page's long edge in the frame's own pixels, so
 * `MEASURE_LONG_EDGE / pageLongEdge` is the ratio that takes frame pixels to
 * canonical page pixels. The window is `size` frame pixels square and is drawn
 * into `target` square, which is what puts it at the same scale the final gate
 * measures the submitted page at.
 *
 * Null when the frame cannot hold a whole window. A clipped window would only
 * add a second, wronger reason to a page the resolution check has already
 * blocked.
 */
export function focusWindowRect(quad, frameWidth, frameHeight, pageLongEdge, target) {
  if (!pageLongEdge || !target) return null;
  const size = Math.round(target * pageLongEdge / QUALITY.MEASURE_LONG_EDGE);
  if (size < 2 || size > frameWidth || size > frameHeight) return null;

  let sumX = 0, sumY = 0;
  for (const p of quad) { sumX += p.x; sumY += p.y; }
  const cx = sumX / quad.length, cy = sumY / quad.length;

  return {
    size,
    target,
    sx: Math.max(0, Math.min(frameWidth - size, Math.round(cx - size / 2))),
    sy: Math.max(0, Math.min(frameHeight - size, Math.round(cy - size / 2))),
  };
}

/**
 * The page's own illumination field: mean luma and mean saturation per cell.
 *
 * This is what makes glare measurable at all. Glare is not "bright" — most of
 * an exam page is legitimately bright — it is *brighter than the rest of this
 * same page*. A field of cell means gives the comparison something to be
 * relative to, and taking the median cell as the base makes it robust to the
 * blown patch itself and to a page that is half writing.
 *
 * @param {{data:Uint8ClampedArray,width:number,height:number}} img
 * @param {(x:number,y:number)=>boolean} [inside] Restrict to part of the frame.
 */
export function illuminationField(img, inside = null) {
  const { data, width, height } = img;
  const cols = Math.max(1, Math.round(width / QUALITY.GLARE_CELL));
  const rows = Math.max(1, Math.round(height / QUALITY.GLARE_CELL));
  const luma = new Float64Array(cols * rows);
  const sat = new Float64Array(cols * rows);
  const n = new Float64Array(cols * rows);

  for (let y = 0; y < height; y++) {
    const cy = Math.min(rows - 1, Math.floor(y * rows / height));
    for (let x = 0; x < width; x++) {
      if (inside && !inside(x + 0.5, y + 0.5)) continue;
      const cx = Math.min(cols - 1, Math.floor(x * cols / width));
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const c = cy * cols + cx;
      luma[c] += (r * 299 + g * 587 + b * 114) / 1000;
      sat[c] += max === 0 ? 0 : (max - min) / max;
      n[c] += 1;
    }
  }

  // A cell the mask never reached is not a dark cell, it is not a cell.
  const cells = [];
  for (let c = 0; c < luma.length; c++) {
    if (!n[c]) continue;
    cells.push({ luma: luma[c] / n[c], sat: sat[c] / n[c] });
  }
  return cells;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Share of the page lost to specular highlight.
 *
 * A cell counts as blown when it is both markedly brighter than the page's own
 * base level and bright in absolute terms, with no colour left in it. Both
 * conditions are load-bearing: the lift alone would fire on the bright half of
 * an unevenly lit but perfectly readable page, and the floor alone is the old
 * measure, which called every white scan glare.
 *
 * Returns the share plus the base level and the headroom above it, because a
 * page with no headroom — uniformly blown — has no bright patch to find and
 * this measure will correctly say 0 while the page is still over-exposed. That
 * case belongs to `clipping`, and a refusal needs both numbers to explain
 * itself honestly rather than reporting "no glare" on a page that is ruined.
 */
export function glareScore(img, inside = null) {
  const cells = illuminationField(img, inside);
  if (!cells.length) return { score: 0, base: 0, headroom: 0, cells: 0 };
  const base = median(cells.map((c) => c.luma));
  const bar = Math.max(base + QUALITY.GLARE_LIFT, QUALITY.GLARE_FLOOR);
  let hit = 0;
  for (const cell of cells) {
    if (cell.luma >= bar && cell.sat <= QUALITY.GLARE_S) hit++;
  }
  return {
    score: hit / cells.length,
    base: Math.round(base),
    headroom: Math.round(255 - base),
    cells: cells.length,
  };
}

/**
 * Glare and over-exposure inside the page, in one pass.
 *
 * Two things at once because the expensive part is neither measurement — it is
 * the point-in-polygon test, and running the frame twice to ask two questions
 * about the same pixels doubles the cost of the one thing in the search loop
 * that scales with frame size. The live gate runs about twelve times a second
 * on phones where the search already sets the frame rate.
 *
 * Restricted to the quad for the reason the old `glareInQuad` gave and which
 * still holds: a bright window behind the desk is not a reason to block the
 * shutter; a bright patch on the answer is. That distinction is the difference
 * between a gate that helps and one people learn to fight.
 */
export function measureQuad(img, quad) {
  const { data, width, height } = img;
  const cols = Math.max(1, Math.round(width / QUALITY.GLARE_CELL));
  const rows = Math.max(1, Math.round(height / QUALITY.GLARE_CELL));
  const luma = new Float64Array(cols * rows);
  const sat = new Float64Array(cols * rows);
  const n = new Float64Array(cols * rows);
  let inside = 0, clipped = 0;

  for (let y = 0; y < height; y++) {
    const cy = Math.min(rows - 1, Math.floor(y * rows / height));
    for (let x = 0; x < width; x++) {
      if (!insidePolygon(x + 0.5, y + 0.5, quad)) continue;
      inside++;
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max === 255 && max - min >= QUALITY.CLIP_CHROMA) clipped++;
      const c = cy * cols + cx(x, cols, width);
      luma[c] += (r * 299 + g * 587 + b * 114) / 1000;
      sat[c] += max === 0 ? 0 : (max - min) / max;
      n[c] += 1;
    }
  }
  if (!inside) return { glare: 0, clipping: 0, base: 0, headroom: 0, cells: 0 };

  const cells = [];
  for (let c = 0; c < luma.length; c++) {
    if (!n[c]) continue;
    cells.push({ luma: luma[c] / n[c], sat: sat[c] / n[c] });
  }
  const base = median(cells.map((c) => c.luma));
  const bar = Math.max(base + QUALITY.GLARE_LIFT, QUALITY.GLARE_FLOOR);
  let hit = 0;
  for (const cell of cells) if (cell.luma >= bar && cell.sat <= QUALITY.GLARE_S) hit++;

  return {
    glare: cells.length ? hit / cells.length : 0,
    clipping: clipped / inside,
    base: Math.round(base),
    headroom: Math.round(255 - base),
    cells: cells.length,
  };
}

const cx = (x, cols, width) => Math.min(cols - 1, Math.floor(x * cols / width));

/** Glare alone, inside the quad. `measureQuad` is the one the live gate calls. */
export function glareInQuad(img, quad) {
  return measureQuad(img, quad).glare;
}

/** Chromatic clipping alone, inside the quad. */
export function clippingInQuad(img, quad) {
  return measureQuad(img, quad).clipping;
}

function insidePolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) &&
        x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * How lopsided the page's *sharpness* is between the two axes.
 *
 * IMAGE_PIPELINE.md §7 asks for motion blur as a gate of its own, measured by
 * directional gradient anisotropy. Measured, that does not work, and the way it
 * fails is instructive enough to keep the code and drop the gate.
 *
 * First-order gradients measure which way the *content* runs, not which way it
 * was smeared. An exam page is ruled, so it is lopsided before anyone shakes
 * anything — and blurring it vertically removes horizontal edges, which makes it
 * read as *more* balanced than a clean page. The gate fired on every ruled page
 * and scored vertical shake as better than no shake at all.
 *
 * Second derivatives are closer: curvature dies along the axis that was smeared
 * and ruled lines keep theirs. But diagonal shake degrades both axes equally and
 * so is invisible to any two-axis ratio.
 *
 * What settles it is that plain variance-of-Laplacian already catches every
 * direction — sideways, vertical and diagonal all land under the blur threshold
 * while a clean ruled page sits comfortably above it (bench/anisotropy.html). So
 * this is kept as a recorded signal and as a way to word the advice, and it
 * decides nothing on its own.
 */
export function anisotropy(gray, width, height) {
  let lx = 0, ly = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      lx += Math.abs(gray[i - 1] - 2 * gray[i] + gray[i + 1]);
      ly += Math.abs(gray[i - width] - 2 * gray[i] + gray[i + width]);
    }
  }
  const total = lx + ly;
  return total ? Math.abs(lx - ly) / total : 0;
}

/**
 * Share of pixels where a channel is pinned at maximum *and the pixel still has
 * colour in it*.
 *
 * The qualifier is the whole measure. Counting any pixel with a channel at 255
 * counts white paper, and an exam page is mostly white paper — which is how the
 * two real submitted scans in bench/fixtures/ scored 0.92 on a metric meant to
 * find destroyed ink. What this is actually for is stated in its own original
 * comment: "a page can clip its red channel while still looking merely bright,
 * and a clipped red channel is the teacher's ink flattened into the paper with
 * nothing left to recover." A pixel that is neutral at 255 is paper. A pixel
 * that is at 255 in one channel and CLIP_CHROMA below it in another is a
 * coloured stroke that has lost its top end.
 *
 * The same two scans now measure 0.0001 and 0.0002; real photographs of marked
 * pages measure 0.0115-0.0375; lifting exposure on one of those photographs to
 * x1.15 takes it to 0.1146.
 */
export function clipping(img, inside = null) {
  const { data, width, height } = img;
  let hit = 0, total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inside && !inside(x + 0.5, y + 0.5)) continue;
      total++;
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b);
      if (max < 255) continue;
      if (max - Math.min(r, g, b) >= QUALITY.CLIP_CHROMA) hit++;
    }
  }
  return total ? hit / total : 0;
}

/** Greatest departure from square, in degrees, across a quad's four corners. */
export function skewDegrees(quad) {
  let worstAngle = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[(i + 3) % 4], b = quad[i], c = quad[(i + 1) % 4];
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (!mag) continue;
    const deg = Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / mag))) * 180 / Math.PI;
    worstAngle = Math.max(worstAngle, Math.abs(deg - 90));
  }
  return worstAngle;
}

/** Long edge in pixels. Below the floor there is no honest route back to 300 DPI. */
export function resolutionScore(width, height) {
  return Math.max(width, height);
}

const worst = (...verdicts) =>
  verdicts.includes('fail') ? 'fail' : verdicts.includes('warn') ? 'warn' : 'ok';

/**
 * Score one page and say plainly what is wrong with it.
 *
 * `longEdge` is the page's real long edge, which is not always the long edge of
 * the image handed in. Sharpness, glare and clipping are all page-relative now
 * and so read the same at any input size — but resolution is a fact about the
 * page itself, and scoring a proxy's own width against thresholds meant for a
 * full page is how every single capture once came back "worth retaking".
 *
 * Reasons are written for the student, not for a log. "Tilt the page away from
 * the light" is actionable while the paper is in shot; "glare 0.043" is not.
 */
export function scorePage(img, { longEdge = null } = {}) {
  const gray = toGray(img);
  const focus = sharpness(img);
  const smear = anisotropy(gray, img.width, img.height);
  const glare = glareScore(img);
  const clipped = clipping(img);
  const pageLongEdge = longEdge ?? resolutionScore(img.width, img.height);

  const reasons = [];

  // A page with nothing on it to focus on is not blurred, and refusing it for
  // blur would be a refusal for the wrong reason. Say what is actually true.
  const blurVerdict = focus.blank ? 'ok'
    : focus.score < QUALITY.BLUR_FAIL ? 'fail'
    : focus.score < QUALITY.BLUR_WARN ? 'warn' : 'ok';
  // The anisotropy only picks the wording. A page that is soft in one direction
  // was moved; a page that is soft in both was too far away or out of focus.
  const moved = smear > QUALITY.ANISOTROPY_HINT;
  if (blurVerdict === 'fail') {
    reasons.push(moved
      ? 'The phone moved while this was taken. Hold still and take it again.'
      : 'This page is too blurred to read the marking. Take it again.');
  } else if (blurVerdict === 'warn') {
    reasons.push('Slightly soft — worth retaking if the red pen looks faint.');
  }

  const glareVerdict = glare.score > QUALITY.GLARE_FAIL ? 'fail' : glare.score > QUALITY.GLARE_WARN ? 'warn' : 'ok';
  if (glareVerdict === 'fail') reasons.push('Light is washing out part of the page. Tilt it away from the light and take it again.');
  else if (glareVerdict === 'warn') reasons.push('A little glare on the page. Tilt it slightly if a mark falls in the bright patch.');

  // Over-exposure, which is a different failure from a bright patch and needs
  // different advice — there is nowhere to tilt a uniformly blown page to.
  const clipVerdict = clipped > QUALITY.CLIP_WARN ? 'warn' : 'ok';
  if (clipVerdict === 'warn') {
    reasons.push(glare.headroom <= QUALITY.HEADROOM_LOW
      ? 'This page came out very bright all over, which flattens red pen into the paper. More shade, or turn a lamp away from it.'
      : 'Parts of this page are over-exposed, which flattens red pen into the paper.');
  }

  // Below RESOLUTION_FAIL there is nothing honest left to say about the page:
  // that is the scale sharpness is defined at, so under it the focus number is
  // being read off an upsample. Between the two lines is a warn — the capture
  // floor already refuses genuinely small pages, so anything landing here
  // arrived some other way and a refusal at this stage would be a second
  // rejection of a page nobody can retake any better.
  const resVerdict = pageLongEdge < QUALITY.RESOLUTION_FAIL ? 'fail'
    : pageLongEdge < QUALITY.RESOLUTION_WARN ? 'warn' : 'ok';
  if (resVerdict === 'fail') {
    reasons.push('This photo is too small to read the marking. Move closer and take it again.');
  } else if (resVerdict === 'warn') {
    reasons.push('Smaller than we would like — closer next time means we read the marking better.');
  }

  return {
    verdict: worst(blurVerdict, glareVerdict, clipVerdict, resVerdict),
    reasons,
    signals: {
      sharpness: round(focus.score),
      // The raw statistic and the patch counts travel too: a threshold can only
      // be re-derived later from production data if production data records
      // what the threshold was applied to. §7.6.5 — measure and store
      // everything, so a refusal can always explain itself.
      sharpness_raw: focus.raw,
      sharpness_patches: focus.patches,
      sharpness_considered: focus.considered,
      page_blank: focus.blank,
      anisotropy: round(smear),
      glare: round(glare.score),
      glare_base: glare.base,
      exposure_headroom: glare.headroom,
      clipping: round(clipped),
      long_edge: pageLongEdge,
    },
  };
}

const round = (n) => Math.round(n * 10000) / 10000;

/**
 * Reconcile a glare-only fail against what layer separation actually found.
 *
 * Kept, narrowed, and no longer load-bearing.
 *
 * It was written on 2026-08-26 to stop the old glare metric refusing readable
 * pages: that metric measured the *share of the page* reading as bright and
 * colourless, which on mostly-blank paper is routinely 0.85-0.95, and two real
 * submissions scored 0.94 while one of them had 144 teacher marks already
 * recovered by `separateLayers` from the very same pixels. This function was
 * the correction — the pipeline's own downstream stage overruling a verdict the
 * gate had no business handing up.
 *
 * The metric itself is now fixed (see `glareScore` above): both of those pages
 * measure 0.0000 and never reach a glare fail at all. So this no longer
 * rescues anything in the corpus we have. It stays because the underlying
 * argument is still sound and still cheap — if the red-ink layer survived, the
 * marking was not washed out, whatever any page-level statistic says — and
 * because a metric that has been wrong once is a metric worth keeping a second
 * opinion on. It is a backstop now, not a patch.
 *
 * A page can still fail for glare with no marks found. That is exactly the case
 * this is meant to leave alone.
 */
export function reconcileWithInk(quality, teacherMarkCount) {
  const GLARE_FAIL_REASON = 'Light is washing out part of the page. Tilt it away from the light and take it again.';
  const glareWasTheOnlyFail = quality.reasons.includes(GLARE_FAIL_REASON)
    && quality.verdict === 'fail'
    && !quality.reasons.some((r) => r !== GLARE_FAIL_REASON
      && !r.startsWith('A little glare') // its own warn wording, not a fail from elsewhere
      && !r.startsWith('Slightly soft')
      && !r.startsWith('Parts of this page')
      && !r.startsWith('This page came out very bright')
      && !r.startsWith('Smaller than we would like'));

  // A handful of stray marks proves nothing (margin noise, a torn edge); a real
  // page of teacher marking does not survive layer separation by accident.
  const MEANINGFUL_MARK_COUNT = 3;
  if (!glareWasTheOnlyFail || teacherMarkCount < MEANINGFUL_MARK_COUNT) return quality;

  return {
    ...quality,
    verdict: 'warn',
    reasons: quality.reasons.map((r) => (r === GLARE_FAIL_REASON
      ? 'Bright lighting on this page, but the marking still came through — worth a second look if anything looks faint.'
      : r)),
  };
}
