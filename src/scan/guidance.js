// What the guidance strip says, and why.
//
// One reason at a time, in a fixed priority, each tied to a measurement the
// scanner actually took. A reason is never stated because it is plausible: if the
// signal that would justify it was not measured, the strip stays neutral. This is
// the rule that stops the app telling a student "too dark" about a well-lit desk.
//
// Pure function. The numbers below are FIRST GUESSES: nothing has been measured
// on real phone footage yet, so they are named, exported and tested for
// *behaviour* (each reason fires only under its own condition) and not for being
// right (glare and blur excepted, see below). When the R-13 corpus exists they are replaced with measured values and
// the corpus version that justified them (AXO-148, after the AXO-145 corpus).

import { QUALITY } from './contract.js';

export const GUIDE = Object.freeze({
  /** Luminance (0–255) below which edges are hard to see: median, and 95th percentile. */
  DARK_MEDIAN: 55,
  DARK_P95: 120,
  /** A page covering less than this share of the view is "small". */
  SMALL_FILL: 0.35,
  /** The same, when the still is a sensor photo. Measured on the owner's phone
      (3000x4000 stills, 3 Oct 2026): fill 0.26 gave a 2020 px page and fill
      0.33 a 2290 px page, both under the 2400 px target, so each was upscaled
      and sharpened ("Page sharpened for readability"). 0.22 made that worse;
      the page needs about a third of the view to arrive at full size. */
  SMALL_FILL_NATIVE: 0.34,
  /** Mean luminance step across the quad's edges (0–255) that counts as a real page
      edge. Without one, a small quad may sit inside a page that overfills the frame. */
  EDGE_CONTRAST: 10,
  /** A corner this close to the frame edge (share of that side) counts as touching it. */
  EDGE_MARGIN: 0.012,
  /** Mean per-pixel change between frames (0–255, 24×24 thumbnail) that reads as movement. */
  SHAKY_MOTION: 9,
  /** Glare and blur reuse the thresholds already measured and documented in
      contract.js (QUALITY): they were calibrated on real submitted pages, so
      they are not first guesses the way the rest of this block is. */
  GLARE: QUALITY.GLARE_WARN,
  BLURRY: QUALITY.BLUR_FAIL,
  /** Nothing page-like for this long: say so and point to the shutter. */
  NOTHING_MS: 6000,
  /** A quad whose inside is this much darker (median luma, 0-255) than its
      surroundings, and also below PAPER_LIGHT, is not followed as a page. */
  PAPER_DARKER_BY: 20,
  PAPER_LIGHT: 120,
});

/**
 * @typedef {Object} Signals
 * @property {'searching'|'candidate'|'locked'} phase
 * @property {{ status: 'loading'|'ready'|'degraded'|'unavailable' }} engine
 * @property {{ median: number, p95: number }|null} luma     null = not measured yet
 * @property {number|null} motion                            null = no previous frame
 * @property {number} fill                                   page share of the view, 0 when none
 * @property {number|null} edgeContrast                        step across the quad's edges; null = not measured
 * @property {boolean} touchesEdge                           a page corner sits on the frame edge
 * @property {number|null} sharpness                         null = not measured
 * @property {number|null} glare                             null = not measured
 * @property {number} searchingMs                            how long no page-like shape was seen
 * @property {{ supported: boolean }} torch
 * @property {boolean} auto
 * @property {boolean} [nativeStill]                       the still is a sensor photo, not a video frame
 */

/**
 * @param {Signals} s
 * @returns {{ reason: string|null, text: string, tone: 'neutral'|'locked'|'attention', action: 'torch'|null }}
 */
export function chooseGuidance(s) {
  const neutral = (text, reason = null) => ({ reason, text, tone: 'neutral', action: null });
  const attention = (reason, text, action = null) => ({ reason, text, tone: 'attention', action });

  if (s.engine.status === 'unavailable') {
    return attention('engine',
      "The page finder didn't start. Take the photo and drag the corners to the page.");
  }
  if (s.engine.status === 'loading' && s.phase === 'searching') {
    return neutral('Getting the page finder ready', 'engine-loading');
  }

  if (s.phase !== 'locked') {
    const dark = s.luma && s.luma.median < GUIDE.DARK_MEDIAN && s.luma.p95 < GUIDE.DARK_P95;
    if (dark) {
      return attention('dark', 'Too dark to see the page edges',
        s.torch.supported ? 'torch' : null);
    }
  }

  if (s.phase === 'searching') {
    if (s.searchingMs >= GUIDE.NOTHING_MS) {
      return attention('nothing',
        "Can't find the page edges. Take the photo and drag the corners to the page.");
    }
    return neutral('Looking for the page');
  }

  // A page is in view (candidate or locked).
  if (s.touchesEdge) return attention('cutoff', 'Move back so the whole page fits');
  // "Small" is only said when a real edge was measured under the quad. A quad
  // inside a page that overfills the frame is not a small page.
  const smallFill = s.nativeStill ? GUIDE.SMALL_FILL_NATIVE : GUIDE.SMALL_FILL;
  if (s.fill < smallFill && s.edgeContrast !== null && s.edgeContrast >= GUIDE.EDGE_CONTRAST) {
    return attention('small', 'Move closer, the page is small');
  }
  if (s.motion !== null && s.motion > GUIDE.SHAKY_MOTION) return attention('shaky', 'Hold still');
  if (s.sharpness !== null && s.sharpness < GUIDE.BLURRY) {
    return attention('blurry', 'Hold still, the page is blurry');
  }
  if (s.glare !== null && s.glare > GUIDE.GLARE) {
    return attention('glare', 'Tilt the page to avoid glare');
  }

  if (s.phase === 'locked') {
    return { reason: null, tone: 'locked', action: null,
      text: s.auto ? 'Page found. Hold still to capture' : 'Page found' };
  }
  return neutral('Looking for the page');
}

/** A corner within `margin` of the frame edge on either axis (normalised quad). */
/**
 * Could this quad be paper? False only on evidence: the inside is clearly
 * darker than what surrounds it AND not light in its own right. Unknown (null)
 * is not evidence and passes.
 */
export function looksLikePaper(interior) {
  if (!interior) return true;
  const darker = interior.inside < interior.outside - GUIDE.PAPER_DARKER_BY;
  return !(darker && interior.inside < GUIDE.PAPER_LIGHT);
}

export function quadTouchesEdge(quad, margin = GUIDE.EDGE_MARGIN) {
  return quad.some((p) => p.x <= margin || p.x >= 1 - margin || p.y <= margin || p.y >= 1 - margin);
}

/** Median and 95th percentile luminance from a 256-bin histogram. */
export function lumaFromHistogram(hist) {
  let total = 0;
  for (let i = 0; i < 256; i++) total += hist[i];
  if (!total) return null;
  const at = (q) => {
    const target = total * q;
    let run = 0;
    for (let i = 0; i < 256; i++) {
      run += hist[i];
      if (run >= target) return i;
    }
    return 255;
  };
  return { median: at(0.5), p95: at(0.95) };
}
