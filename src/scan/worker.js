// Conditioning and layer separation, off the main thread.
//
// The performance floor is 60fps on a mid-tier Android, and conditioning an
// eight-megapixel page is several hundred milliseconds of tight loops. Run on
// the main thread that is a visibly dropped frame every time a page is accepted,
// during the one part of the flow where the student is holding a phone over a
// piece of paper and needs the viewfinder to stay alive.
//
// The modules it calls are pure and know nothing about workers, so the same code
// runs here, on the main thread when a worker cannot be constructed, and in the
// accuracy harness under Node.

import { conditionPage } from './conditioning.js';

self.onmessage = async (event) => {
  const { id, source, quad, pageNumber, capturePath, liveGate, sourceKind } = event.data;
  try {
    const conditioned = await conditionPage(source, { quad, pageNumber, capturePath, liveGate, sourceKind });
    // No content layer. It is a full extra pass over the page to build a
  // red-suppressed copy, and nothing downstream reads it: what gets uploaded
  // is the conditioned page, and the server crops its regions from that. It
  // was costing about two seconds a page to produce and discard.
  // conditionPage has already run stage 2 and encoded the mask it produced.
  // Running it a second time here would recompute the whole thing and then throw
  // the answer away — and the mask that travels has to be the one the blob was
  // encoded from, or the boxes will not line up with the image.
  const layers = conditioned.layers;

    self.postMessage({
      id,
      ok: true,
      blob: conditioned.blob,
      mask: conditioned.maskBlob,
      thumb: conditioned.thumbBlob,
      width: conditioned.width,
      height: conditioned.height,
      quality: conditioned.quality,
      meta: conditioned.meta,
      teacher_marks: layers.teacher.components.map((c) => ({
        box: c.box, shape: c.shape, metrics: c.metrics,
      })),
      margin_band: layers.teacher.margin_band,
      layer_fallback: layers.fallback,
      coverage: layers.coverage,
    });
  } catch (error) {
    // The page is never silently lost. The caller keeps it in the tray, flagged,
    // and the student can retake it while the paper is still in front of them.
    self.postMessage({ id, ok: false, error: error.message });
  }
};
