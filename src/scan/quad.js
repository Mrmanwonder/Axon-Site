// Finding the page by its edges.
//
// The first detector thresholded on brightness and took the largest bright
// region. Against real frames from a real desk it failed on every one, and the
// reason is plain once you look: a desk is full of bright things. A white page
// on a pale floor beside a pale folder is one connected bright region, and the
// extreme corners of that region are the corners of the folder.
//
// Adding "and neutral in colour" helped a little and did not fix it, because a
// page and a manila folder are both neutral. Nothing about a *region* separates
// them, because to a region-growing algorithm they are not two things.
//
// What separates them is the boundary between them — and a page's boundary is
// four long straight lines, which is a much rarer thing on a desk than a bright
// patch. So: find the straight edges, take the four that bound a page-shaped
// quadrilateral, and check that the thing inside actually looks like paper.
//
// This is the classic document-scanner pipeline, minus a library. It runs on a
// 240-pixel proxy several times a second and costs a few milliseconds.

const THETA_BINS = 180;          // one degree
const RHO_STEP = 2;              // pixels per rho bin
const VOTE_SPREAD = 3;           // degrees either side of the gradient normal
const MAX_LINES_PER_FAMILY = 7;  // candidates kept for the pairing search
const AXIS_TOLERANCE = 40;       // degrees from an axis for a line to count as on it

const SIN = new Float32Array(THETA_BINS);
const COS = new Float32Array(THETA_BINS);
for (let t = 0; t < THETA_BINS; t++) {
  const a = (t * Math.PI) / THETA_BINS;
  SIN[t] = Math.sin(a);
  COS[t] = Math.cos(a);
}

// Scratch buffers, reused across frames. This runs a dozen times a second on a
// phone; allocating four typed arrays each time is a garbage collector pause
// exactly when the viewfinder needs to stay smooth.
const scratch = { size: 0, gray: null, blur: null, mag: null, dir: null };

function buffers(n) {
  if (scratch.size !== n) {
    scratch.size = n;
    scratch.gray = new Uint8ClampedArray(n);
    scratch.blur = new Uint8ClampedArray(n);
    scratch.mag = new Float32Array(n);
    scratch.dir = new Uint8Array(n);
  }
  return scratch;
}

/**
 * Sobel gradients, with the direction already quantised into theta bins.
 *
 * The direction is what makes the vote affordable: an edge pixel only votes for
 * lines roughly perpendicular to its own gradient, which is seven bins instead
 * of a hundred and eighty.
 */
function gradients(img) {
  const { data, width, height } = img;
  const n = width * height;
  const { gray, blur, mag, dir } = buffers(n);

  for (let p = 0, i = 0; p < n; p++, i += 4) {
    gray[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }

  // A 3x3 mean, because phone sensors are noisy at the ISO a room is shot at and
  // Sobel on raw noise produces edges everywhere and lines nowhere.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      blur[p] = (
        gray[p - width - 1] + gray[p - width] + gray[p - width + 1] +
        gray[p - 1] + gray[p] + gray[p + 1] +
        gray[p + width - 1] + gray[p + width] + gray[p + width + 1]
      ) / 9;
    }
  }

  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const gx =
        -blur[p - width - 1] + blur[p - width + 1] +
        -2 * blur[p - 1] + 2 * blur[p + 1] +
        -blur[p + width - 1] + blur[p + width + 1];
      const gy =
        -blur[p - width - 1] - 2 * blur[p - width] - blur[p - width + 1] +
        blur[p + width - 1] + 2 * blur[p + width] + blur[p + width + 1];

      const m = Math.abs(gx) + Math.abs(gy); // L1 is close enough and much cheaper
      mag[p] = m;
      sum += m; sumSq += m * m; count++;

      let angle = Math.atan2(gy, gx) * (THETA_BINS / Math.PI);
      angle %= THETA_BINS;
      if (angle < 0) angle += THETA_BINS;
      dir[p] = angle | 0;
    }
  }

  const mean = count ? sum / count : 0;
  const sd = count ? Math.sqrt(Math.max(0, sumSq / count - mean * mean)) : 0;
  return { mag, dir, threshold: Math.max(18, mean + 1.4 * sd) };
}

/** Vote for lines, then pull the peaks back out. */
function findLines(img) {
  const { width, height } = img;
  const { mag, dir, threshold } = gradients(img);

  const diag = Math.ceil(Math.hypot(width, height));
  const rhoBins = Math.ceil((2 * diag) / RHO_STEP) + 1;
  const rhoOffset = diag;
  const accumulator = new Int32Array(THETA_BINS * rhoBins);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (mag[p] < threshold) continue;
      const centre = dir[p];
      for (let d = -VOTE_SPREAD; d <= VOTE_SPREAD; d++) {
        let t = centre + d;
        if (t < 0) t += THETA_BINS;
        else if (t >= THETA_BINS) t -= THETA_BINS;
        const rho = x * COS[t] + y * SIN[t];
        const bin = ((rho + rhoOffset) / RHO_STEP) | 0;
        if (bin >= 0 && bin < rhoBins) accumulator[t * rhoBins + bin]++;
      }
    }
  }

  // Non-maximum suppression, so one strong edge yields one line rather than a
  // smear of near-identical ones.
  const peaks = [];
  const minVotes = Math.max(16, Math.round(Math.min(width, height) * 0.22));
  for (let t = 0; t < THETA_BINS; t++) {
    for (let r = 1; r < rhoBins - 1; r++) {
      const v = accumulator[t * rhoBins + r];
      if (v < minVotes) continue;
      let best = true;
      for (let dt = -4; dt <= 4 && best; dt++) {
        let tt = t + dt;
        if (tt < 0) tt += THETA_BINS; else if (tt >= THETA_BINS) tt -= THETA_BINS;
        for (let dr = -4; dr <= 4; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= rhoBins || (!dt && !dr)) continue;
          if (accumulator[tt * rhoBins + rr] > v) { best = false; break; }
        }
      }
      if (best) peaks.push({ theta: t, rho: r * RHO_STEP - rhoOffset, votes: v });
    }
  }

  peaks.sort((a, b) => b.votes - a.votes);
  return peaks;
}

/** Where two lines cross, or null if they are near-parallel. */
function intersect(a, b) {
  const d = COS[a.theta] * SIN[b.theta] - COS[b.theta] * SIN[a.theta];
  if (Math.abs(d) < 0.2) return null;
  return {
    x: (a.rho * SIN[b.theta] - b.rho * SIN[a.theta]) / d,
    y: (COS[a.theta] * b.rho - COS[b.theta] * a.rho) / d,
  };
}

/** Distance from an angle bin to an axis, in degrees, wrapping at 180. */
function offAxis(theta, axis) {
  let d = Math.abs(theta - axis) % THETA_BINS;
  if (d > THETA_BINS / 2) d = THETA_BINS - d;
  return d;
}

/**
 * How much of the quad's inside looks like paper, and how much the tone steps
 * across its edges.
 *
 * This is what stops the search settling on the folder, and on the floor. Four
 * long straight lines bounding a convex quadrilateral is a real but not rare
 * thing on a desk; four long straight lines with paper inside them and something
 * else immediately outside is the page.
 *
 * Measured against the real capture fixtures, `paper` is the signal that works:
 * every genuine page scored 0.96 or better, and the quad the search settles on
 * over a desk and a folder scored 0.68.
 *
 * Two other ideas were tried on the same frames and are recorded here so nobody
 * spends the afternoon re-deriving them. A tone step across the edge fails: a
 * photograph of a floor scores 0.84 on it, higher than a real page held close
 * enough to fill the frame. Ink coverage inside the quad fails too, and for the
 * same reason in reverse — a floor with a dark desk and a bag in shot scores
 * 0.149 against 0.06 for an actual written page.
 *
 * Which is the real lesson: whether a photograph is of a graded exam paper is
 * not a question three cheap heuristics can answer, and it is not capture's
 * question. SCANNING_SYSTEM.md puts it at the structure pass, where a model
 * looks at the page and can refuse it politely. Capture's job is to find a page
 * shape and to be slow to fire the shutter on its own.
 */
function paperScore(img, quad) {
  const { data, width, height } = img;
  const at = (x, y) => {
    const px = Math.min(width - 1, Math.max(0, x | 0));
    const py = Math.min(height - 1, Math.max(0, y | 0));
    const i = (py * width + px) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    return { v: max, s: max === 0 ? 0 : (max - min) / max };
  };

  // Inside, on a small grid in barycentric-ish coordinates over the quad.
  let paper = 0, samples = 0, insideValue = 0;
  for (let u = 1; u <= 5; u++) {
    for (let w = 1; w <= 5; w++) {
      const fu = u / 6, fw = w / 6;
      const top = { x: quad[0].x + (quad[1].x - quad[0].x) * fu, y: quad[0].y + (quad[1].y - quad[0].y) * fu };
      const bottom = { x: quad[3].x + (quad[2].x - quad[3].x) * fu, y: quad[3].y + (quad[2].y - quad[3].y) * fu };
      const { v, s } = at(top.x + (bottom.x - top.x) * fw, top.y + (bottom.y - top.y) * fw);
      insideValue += v;
      if (v > 120 && s < 0.34) paper++;
      samples++;
    }
  }
  if (!samples) return 0;
  const paperShare = paper / samples;
  const meanInside = insideValue / samples;

  // Just outside each edge, stepped along its length. A page sits on something,
  // and that something is darker or more colourful than the page.
  let outside = 0, outsideSamples = 0;
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
  for (let e = 0; e < 4; e++) {
    const a = quad[e], b = quad[(e + 1) % 4];
    for (let k = 1; k <= 4; k++) {
      const f = k / 5;
      const mx = a.x + (b.x - a.x) * f, my = a.y + (b.y - a.y) * f;
      const dx = mx - cx, dy = my - cy;
      const len = Math.hypot(dx, dy) || 1;
      const { v } = at(mx + (dx / len) * 6, my + (dy / len) * 6);
      outside += v;
      outsideSamples++;
    }
  }
  const meanOutside = outsideSamples ? outside / outsideSamples : meanInside;
  const step = Math.max(0, Math.min(1, (meanInside - meanOutside) / 60));

  return { paper: paperShare, step, score: paperShare * 0.75 + step * 0.25 };
}

export { findLines, intersect, offAxis, paperScore, MAX_LINES_PER_FAMILY, AXIS_TOLERANCE };
