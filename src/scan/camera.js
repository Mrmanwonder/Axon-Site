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

import { withDeadline } from './deadline.js';

export const CAMERA_CONTROL_TIMEOUT_MS = 1200;
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
    await withDeadline(() => track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }), CAMERA_CONTROL_TIMEOUT_MS);
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
    await withDeadline(() => track.applyConstraints({
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: 30, max: 30 },
    }), CAMERA_CONTROL_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

export const cameraSupported = () => !!navigator.mediaDevices?.getUserMedia;

let pending = null;

const MAIN_CAMERA_KEY = 'axon.scan.mainCamera';
const NOT_MAIN = /ultra|wide[\s-]?angle|0\.5|tele|zoom|macro|depth|tof|infra|\bir\b|dual|triple|desk ?view|virtual|obs\b/i;
const FRONT = /front|user|selfie|facetime/i;
const BACK = /back|rear|environment/i;

/**
 * The phone's main (1x, wide) rear camera, chosen from labelled devices.
 *
 * `facingMode: environment` lets the browser pick any rear lens. On phones with
 * three or four of them that has meant the ultra-wide (soft corners, barrel
 * distortion) or a telephoto (too close to fit a page). Labels exist only after
 * permission is granted. Pure, so it is tested in Node.
 *
 * iOS: "Back Camera" is the main lens; "Back Dual/Triple Camera" are virtual
 * devices that switch lenses on their own. Android Chrome: "camera2 N, facing
 * back", where the main sensor is the lowest-numbered back camera.
 *
 * @param {{kind:string, deviceId:string, label:string}[]} devices
 * @returns {string|null} deviceId, or null when nothing can be told apart
 */
export function pickMainCamera(devices) {
  const back = (devices ?? []).filter((d) => d.kind === 'videoinput' && d.label
    && !FRONT.test(d.label) && BACK.test(d.label));
  if (!back.length) return null;
  const score = (d) => {
    const label = d.label.trim();
    if (/^back camera$/i.test(label)) return -1000;
    const index = Number(/camera2?\s*(\d+)/i.exec(label)?.[1] ?? 50);
    return (NOT_MAIN.test(label) ? 500 : 0) + index;
  };
  const best = [...back].sort((a, b) => score(a) - score(b))[0];
  return NOT_MAIN.test(best.label) && back.length > 1 ? null : best.deviceId;
}

function rememberedCamera() {
  try { return globalThis.localStorage?.getItem(MAIN_CAMERA_KEY) || null; } catch { return null; }
}
function rememberCamera(id) {
  try { if (id) globalThis.localStorage?.setItem(MAIN_CAMERA_KEY, id); } catch { /* storage is a convenience */ }
}

function constraintsFor(deviceId) {
  if (!deviceId) return CAMERA_CONSTRAINTS;
  const { facingMode, ...video } = CAMERA_CONSTRAINTS.video;
  return { ...CAMERA_CONSTRAINTS, video: { ...video, deviceId: { exact: deviceId } } };
}

/** Open the rear camera, then move to the main lens if the browser picked another. */
async function openMainCamera() {
  const remembered = rememberedCamera();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraintsFor(remembered));
  } catch (error) {
    if (!remembered || error?.name === 'NotAllowedError') throw error;
    rememberCamera('');
    stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const main = pickMainCamera(devices);
    const current = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
    if (main && current && main !== current) {
      stream.getTracks().forEach((t) => t.stop());
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraintsFor(main));
      } catch {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      }
    }
    rememberCamera(stream.getVideoTracks()[0]?.getSettings?.().deviceId ?? main);
  } catch {
    // Choosing a lens is an improvement, never a reason to have no camera.
  }
  return stream;
}

/** Start the camera and hand the same promise to every caller. */
export function requestCamera() {
  if (!cameraSupported()) {
    return Promise.reject(Object.assign(new Error('no camera on this device'), { name: 'NotFoundError' }));
  }
  if (!pending) {
    const request = openMainCamera()
      .catch((error) => {
        // A released permission request can reject after a new visit starts.
        if (pending === request) pending = null;
        throw error;
      });
    pending = request;
  }
  return pending;
}

/** Forget a stream that has been stopped, so the next visit starts a fresh one. */
export function releaseCamera() {
  const held = pending;
  pending = null;
  held?.then((stream) => stream.getTracks().forEach((t) => t.stop())).catch(() => {});
}
