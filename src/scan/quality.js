// The per-page quality gate.
//
// Runs at capture, on accept, while the paper is still physically in front of
// the student. That placement is the whole point: a page flagged here costs one
// retake, and the same page flagged forty seconds later at review costs a trip
// back to the schoolbag, which in practice means the page is simply lost.
//
// Three independent measures — sharpness, glare and resolution — each with a
// warn and a fail threshold, because a soft page is worth a nudge and a blurred
// one is worth a refusal.

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
 * Variance of the Laplacian — the standard sharpness proxy, and the right one
 * here because it responds to exactly what we cannot afford to lose: thin,
 * high-contrast pen strokes. A page of soft grey handwriting scores low, which
 * is correct, because that is a page whose red ticks will not survive either.
 */
export function blurScore(gray, width, height) {
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return Math.min(1, variance / QUALITY.BLUR_NORMALISER);
}

/**
 * Share of the page lost to specular highlight.
 *
 * Glare is bright and colourless — a blown highlight has no hue left, which is
 * what separates it from genuinely white paper with ink on it. It is the single
 * most common cause of a lost mark on Indian classroom paper under tubelight,
 * and it is silently destructive: a washed-out red tick reads as no tick at all,
 * so the pipeline would not fail, it would quietly under-report.
 */
export function glareScore(img) {
  const { data, width, height } = img;
  const total = width * height;
  let hit = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b);
    if (max < QUALITY.GLARE_V * 255) continue;
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation <= QUALITY.GLARE_S) hit++;
  }
  return hit / total;
}

/**
 * Glare measured only inside the page, for the live capture gate.
 *
 * A bright window behind the desk is not a reason to block the shutter; a bright
 * patch on the answer is. Restricting the measure to the quad is what makes the
 * difference between a gate that helps and one people learn to fight.
 */
export function glareInQuad(img, quad) {
  const { data, width, height } = img;
  let inside = 0, hit = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!insidePolygon(x + 0.5, y + 0.5, quad)) continue;
      inside++;
      const i = (y * width + x) * 4;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      if (max < QUALITY.GLARE_V * 255) continue;
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      if ((max === 0 ? 0 : (max - min) / max) <= QUALITY.GLARE_S) hit++;
    }
  }
  return inside ? hit / inside : 0;
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
 * Share of pixels pinned at maximum in any one channel.
 *
 * Not the same thing as glare, and worth separating: a page can clip its red
 * channel while still looking merely bright, and a clipped red channel is the
 * teacher's ink flattened into the paper with nothing left to recover.
 */
export function clipping(img) {
  const { data } = img;
  let clipped = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 255 || data[i + 1] === 255 || data[i + 2] === 255) clipped++;
  }
  return clipped / (data.length / 4);
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
 * the image handed in. Sharpness and glare are measured on a downscaled proxy —
 * they do not need every pixel and it is far cheaper this way — but resolution
 * is a fact about the page itself. Scoring the proxy's own width against
 * thresholds meant for a full page is how every single capture came back
 * "worth retaking": the proxy is 1400px, the warn threshold is 1600px, so the
 * answer was always yes.
 *
 * Reasons are written for the student, not for a log. "Tilt the page away from
 * the light" is actionable while the paper is in shot; "glare 0.043" is not.
 */
export function scorePage(img, { longEdge = null } = {}) {
  const gray = toGray(img);
  const sharp = blurScore(gray, img.width, img.height);
  const smear = anisotropy(gray, img.width, img.height);
  const glare = glareScore(img);
  const clipped = clipping(img);
  const pageLongEdge = longEdge ?? resolutionScore(img.width, img.height);

  const reasons = [];
  const blurVerdict = sharp < QUALITY.BLUR_FAIL ? 'fail' : sharp < QUALITY.BLUR_WARN ? 'warn' : 'ok';
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

  const glareVerdict = glare > QUALITY.GLARE_FAIL ? 'fail' : glare > QUALITY.GLARE_WARN ? 'warn' : 'ok';
  if (glareVerdict === 'fail') reasons.push('Light is washing out part of the page. Tilt it away from the light and take it again.');
  else if (glareVerdict === 'warn') reasons.push('A little glare on the page. Tilt it slightly if a mark falls in the bright patch.');

  const clipVerdict = clipped > QUALITY.CLIP_WARN ? 'warn' : 'ok';
  if (clipVerdict === 'warn') {
    reasons.push('Parts of this page are over-exposed, which flattens red pen into the paper.');
  }

  // Below RESOLUTION_FAIL there is no honest route back to 300 DPI at all —
  // that is a fail, not advice. Between RESOLUTION_FAIL and RESOLUTION_WARN is
  // still only a warn: a student's hardware may not be able to clear the warn
  // line, and a gate that fires on everything teaches them to ignore it.
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
      sharpness: round(sharp),
      anisotropy: round(smear),
      glare: round(glare),
      clipping: round(clipped),
      long_edge: pageLongEdge,
    },
  };
}

const round = (n) => Math.round(n * 10000) / 10000;

/**
 * Reconcile a glare-only fail against what layer separation actually found.
 *
 * `glareScore` measures the *share of the page* that reads as bright and
 * colourless. On a well-exposed photo of mostly-blank paper that share is
 * routinely 0.85–0.95 — not because the marking is unreadable, but because most
 * of an exam page legitimately *is* bright, colourless paper background. The raw
 * metric cannot tell "the background is white" from "the ink is gone," which is
 * exactly the distinction that matters: two real submissions traced on
 * 2026-08-26 scored glare 0.94–0.94 (comfortably past GLARE_FAIL) and one of
 * them had already had 144 real teacher marks recovered by `separateLayers` on
 * the very same pixels — the pipeline's own downstream stage contradicting the
 * verdict this stage handed up.
 *
 * `separateLayers` runs on the identical `img` right next to `scorePage` in
 * `conditionPage` and answers the question `glareScore` cannot: is the red-ink
 * layer actually still there? If a meaningful number of teacher marks survived
 * layer separation, the marking was not, in fact, washed out — whatever the raw
 * page-coverage share says — so a glare-only fail is downgraded to a warn
 * instead of blocking a genuinely readable page.
 *
 * This does not touch the glare *metric* itself (that needs the golden-set
 * recalibration `scan-system-redesign-plan.md` §4.5 and §4.2 already call for,
 * not a guessed constant) — it corrects the *verdict* using a signal the
 * pipeline was already computing and already had, right beside it, and simply
 * wasn't consulting. A page can still fail for glare with zero marks
 * found — that is exactly the case this check is meant to still catch.
 */
export function reconcileWithInk(quality, teacherMarkCount) {
  const GLARE_FAIL_REASON = 'Light is washing out part of the page. Tilt it away from the light and take it again.';
  const glareWasTheOnlyFail = quality.reasons.includes(GLARE_FAIL_REASON)
    && quality.verdict === 'fail'
    && !quality.reasons.some((r) => r !== GLARE_FAIL_REASON
      && !r.startsWith('A little glare') // its own warn wording, not a fail from elsewhere
      && !r.startsWith('Slightly soft')
      && !r.startsWith('Parts of this page'));

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
