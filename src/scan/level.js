// Apple-style camera horizon level math.
//
// This module stays DOM-free so the scanner UI can use the same projection
// without coupling it to capture, tracking, or React state.

export const LEVEL_VISIBLE_DEG = 10;
export const LEVEL_ALIGNED_DEG = 0.45;
const FLAT_PROJECTION_FLOOR = 0.12;

export function normalizeLevelAngle(degrees) {
  if (!Number.isFinite(degrees)) return 0;
  let value = ((degrees + 180) % 360 + 360) % 360 - 180;
  if (value > 90) value -= 180;
  if (value < -90) value += 180;
  return value;
}

/**
 * Convert DeviceOrientation beta/gamma into the screen-relative horizon roll.
 *
 * DeviceOrientation becomes singular when the phone is close to face-up/down.
 * In that pose a horizontal horizon line is not meaningful, so return null
 * instead of letting sensor noise make the indicator jump.
 */
export function horizonLevelAngle(beta, gamma, screenAngle = 0) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;

  const b = beta * Math.PI / 180;
  const g = gamma * Math.PI / 180;

  // Earth gravity projected into the device's screen plane. Alpha/yaw is
  // irrelevant to gravity, so it deliberately does not participate.
  const gx = -Math.cos(b) * Math.sin(g);
  const gy = Math.sin(b);
  if (Math.hypot(gx, gy) < FLAT_PROJECTION_FLOOR) return null;

  const gravityRoll = Math.atan2(gx, gy) * 180 / Math.PI;
  const displayAngle = screenAngle > 180 ? screenAngle - 360 : screenAngle;
  return normalizeLevelAngle(gravityRoll - displayAngle);
}

export function cameraLevelFrame(angle) {
  if (!Number.isFinite(angle)) {
    return { visible: false, aligned: false, rotationDeg: 0, opacity: 0 };
  }

  const normalized = normalizeLevelAngle(angle);
  const distance = Math.abs(normalized);
  if (distance > LEVEL_VISIBLE_DEG) {
    return { visible: false, aligned: false, rotationDeg: -normalized, opacity: 0 };
  }

  const aligned = distance <= LEVEL_ALIGNED_DEG;
  return {
    visible: true,
    aligned,
    // Apple's center segment counters the phone roll while the two short outer
    // guides stay horizontal. Keep the white state at a stable translucency;
    // proximity should change geometry, not make the guide "breathe".
    rotationDeg: aligned ? 0 : -normalized,
    opacity: aligned ? 0.86 : 0.62,
  };
}
