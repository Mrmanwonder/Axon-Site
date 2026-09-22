// Asking for the camera, and nothing else.
//
// This module intentionally stays tiny. The permission sheet has to appear the
// instant the Scan tab opens, while the rest of the scanner loads behind it.
//
// The scanner uses two resolutions:
//   1. a light 1280x720 live stream for preview/tracking on browsers that can
//      take a separate sensor-resolution still through ImageCapture;
//   2. a high-resolution live stream only on browsers (notably iOS Safari)
//      where the video frame itself is the best still the web platform exposes.

export const TRACKING_WIDTH = 1280;
export const TRACKING_HEIGHT = 720;
// Practical 12MP ceiling from the architecture. Some phones advertise far
// larger binned sensor modes; asking a web video track for 48MP is a memory trap,
// not a quality win for document OCR.
export const FALLBACK_CAPTURE_WIDTH = 4032;
export const FALLBACK_CAPTURE_HEIGHT = 3024;

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

/** Best-effort continuous focus. Unsupported controls never stop the stream. */
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
 * Use the device-reported maximum when lower than the practical 12MP ceiling.
 */
export async function requestFallbackCaptureResolution(track) {
  if (!track?.applyConstraints) return false;
  try {
    const caps = track.getCapabilities?.();
    const width = Math.max(
      TRACKING_WIDTH,
      Math.min(FALLBACK_CAPTURE_WIDTH, Number(caps?.width?.max ?? FALLBACK_CAPTURE_WIDTH)),
    );
    const height = Math.max(
      TRACKING_HEIGHT,
      Math.min(FALLBACK_CAPTURE_HEIGHT, Number(caps?.height?.max ?? FALLBACK_CAPTURE_HEIGHT)),
    );
    await track.applyConstraints({
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: 30, max: 30 },
    });
    return true;
  } catch {
    return false;
  }
}

export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia;

let pending = null;

/** Start the camera and hand the same promise to every caller. */
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
