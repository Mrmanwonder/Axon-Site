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

/** Long edge in pixels. Below the floor there is no honest route back to 300 DPI. */
export function resolutionScore(width, height) {
  return Math.max(width, height);
}

const worst = (...verdicts) =>
  verdicts.includes('fail') ? 'fail' : verdicts.includes('warn') ? 'warn' : 'ok';

/**
 * Score one page and say plainly what is wrong with it.
 *
 * Reasons are written for the student, not for a log. "Tilt the page away from
 * the light" is actionable while the paper is in shot; "glare 0.043" is not.
 */
export function scorePage(img) {
  const gray = toGray(img);
  const sharp = blurScore(gray, img.width, img.height);
  const glare = glareScore(img);
  const longEdge = resolutionScore(img.width, img.height);

  const reasons = [];
  const blurVerdict = sharp < QUALITY.BLUR_FAIL ? 'fail' : sharp < QUALITY.BLUR_WARN ? 'warn' : 'ok';
  if (blurVerdict === 'fail') reasons.push('This page is too blurred to read the marking. Hold still and take it again.');
  else if (blurVerdict === 'warn') reasons.push('Slightly soft — worth retaking if the red pen looks faint.');

  const glareVerdict = glare > QUALITY.GLARE_FAIL ? 'fail' : glare > QUALITY.GLARE_WARN ? 'warn' : 'ok';
  if (glareVerdict === 'fail') reasons.push('Light is washing out part of the page. Tilt it away from the light and take it again.');
  else if (glareVerdict === 'warn') reasons.push('A little glare on the page. Tilt it slightly if a mark falls in the bright patch.');

  const resVerdict = longEdge < QUALITY.RESOLUTION_FAIL ? 'fail'
    : longEdge < QUALITY.RESOLUTION_WARN ? 'warn' : 'ok';
  if (resVerdict === 'fail') reasons.push('Too far away to read. Fill more of the frame with the page.');
  else if (resVerdict === 'warn') reasons.push('Move a little closer so the page fills the frame.');

  return {
    verdict: worst(blurVerdict, glareVerdict, resVerdict),
    reasons,
    signals: { sharpness: round(sharp), glare: round(glare), long_edge: longEdge },
  };
}

const round = (n) => Math.round(n * 10000) / 10000;
