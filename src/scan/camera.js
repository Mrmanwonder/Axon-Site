// Asking for the camera, and nothing else.
//
// This module intentionally stays tiny. The permission sheet has to appear the
// instant the Scan tab opens, while the rest of the scanner loads behind it.
//
// The scanner now uses two resolutions:
//   1. a light 720p live stream for preview/tracking on browsers that can take a
//      separate sensor-resolution still through ImageCapture;
//   2. a higher-resolution live stream only on browsers (notably iOS Safari)
//      where the video frame itself is the best still the web platform exposes.
//
// Keeping those paths separate is important. Decoding a 12MP stream just to run
// a detector wastes battery and main-thread bandwidth, but forcing every browser
// to 720p makes the Safari fallback permanently incapable of producing a useful
// page. The capture layer selects the second profile only when it has proved the
// native-still route is unavailable.

export const TRACKING_WIDTH = 1280;
export const TRACKING_HEIGHT = 720;
export const FALLBACK_CAPTURE_WIDTH = 2560;
export const FALLBACK_CAPTURE_HEIGHT = 1440;

/** Fast live stream. ImageCapture-capable browsers take the real photograph
    separately at the sensor's maximum supported still resolution. */
export const CAMERA_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: TRACKING_WIDTH },
    height: { ideal: TRACKING_HEIGHT },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: false,
};

/**
 * Ask the track to keep focusing continuously, where the platform exposes it.
 * Best-effort: unsupported camera controls must never stop the stream.
 */
export async function requestContinuousFocus(track) {
  try {
    const caps = track?.getCapabilities?.();
    if (!caps?.focusMode?.includes('continuous')) return false;
    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safari/iOS does not expose ImageCapture.takePhoto(). In that case the video
 * frame is the capture source, so promote the stream after feature probing.
 * `ideal` deliberately down-negotiates instead of failing on weaker cameras.
 */
export async function requestFallbackCaptureResolution(track) {
  if (!track?.applyConstraints) return false;
  try {
    await track.applyConstraints({
      width: { ideal: FALLBACK_CAPTURE_WIDTH },
      height: { ideal: FALLBACK_CAPTURE_HEIGHT },
      frameRate: { ideal: 30, max: 30 },
    });
    return true;
  } catch {
    return false;
  }
}

export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia;

/** Start the camera and hand the same promise to every caller. */
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
