// Asking for the camera, and nothing else.
//
// This module exists to be small. The permission sheet has to come up the
// instant the Scan tab does, and the rest of the scanner is sixteen ES modules
// that take real time to fetch on a phone — the first build asked for the camera
// only after all of them had loaded and initialised, which put about ten seconds
// between the tap and the prompt. From the student's side that is an app that
// does not work.
//
// So the request lives here, on its own, with no imports. app.js can hold it on
// the critical path for the cost of one small file and fire it the moment the
// tab opens, while the pipeline loads behind it.

/**
 * Ask for as much sensor as the browser will give.
 *
 * A page fills perhaps two thirds of the frame's short axis, so a 1920x1440
 * request put roughly 1400 pixels across the page — nowhere near the 300 DPI
 * conditioning targets, and the reason every capture used to come back flagged.
 * The frames cost more to condition, which is the right trade: the pixels are
 * the handwriting.
 */
export const CAMERA_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 3264 },
    height: { ideal: 2448 },
  },
  audio: false,
};

export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia;

/**
 * Start the camera, and hand back the same promise to everyone who asks.
 *
 * Deliberately a promise rather than a stream: the caller that fires this is not
 * the caller that uses it, and the gap between them is the whole point. A second
 * request while the first is still pending would put two permission sheets up.
 */
let pending = null;

export function requestCamera() {
  if (!cameraSupported()) {
    return Promise.reject(Object.assign(new Error('no camera on this device'), { name: 'NotFoundError' }));
  }
  pending ??= navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
    .catch((error) => { pending = null; throw error; });
  return pending;
}

/** Forget a stream that has been stopped, so the next visit starts a fresh one. */
export function releaseCamera() {
  const held = pending;
  pending = null;
  held?.then((stream) => stream.getTracks().forEach((t) => t.stop())).catch(() => {});
}
