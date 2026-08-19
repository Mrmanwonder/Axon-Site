// The student's avatar.
//
// Ten ShaderGradient presets, rendered as layered CSS radial gradients rather
// than as the real thing. ShaderGradient is three.js: a WebGL context, a
// render loop and a framework, all three of which this project has decided
// against, and none of which survive the 60fps-on-mid-tier-Android floor for
// something that is decoration on a settings row. The colour values below are
// the presets' own, taken verbatim from the library's presets.ts.
//
// Static, too. Nothing animates. A face that breathes in the corner of Settings
// is motion during a task rather than after one, which the design language
// rules out — and it would run the compositor forever for no information.

/**
 * The presets, with their real colours.
 *
 * `type` is ShaderGradient's own geometry name, kept because it is what decides
 * how the three colours are arranged: a sphere reads as a lit orb, a plane as a
 * diagonal sweep, a waterPlane as soft overlapping pools.
 */
// `auto: false` marks a preset the app will never assign on its own.
//
// Red is reserved for signing out, and two of these presets are essentially
// made of it — Mandarin is three shades of one red-orange, and Halo leads with
// #ff5005. Derived onto a student who never asked for it, either would put a
// red disc at the top of Settings a few rows above the red Sign out row, which
// is the exact confusion the rule exists to prevent.
//
// They stay pickable. A student choosing red for themselves is not the
// interface spending it, and dropping presets the design brief asked for would
// be a bigger liberty than declining to hand one out unasked.
export const PRESETS = [
  { key: 'halo',            title: 'Halo',         type: 'plane',      auto: false, c: ['#ff5005', '#dbba95', '#d0bce1'] },
  { key: 'pensive',         title: 'Pensive',      type: 'sphere',     c: ['#809bd6', '#910aff', '#af38ff'] },
  { key: 'mint',            title: 'Mint',         type: 'waterPlane', c: ['#94ffd1', '#6bf5ff', '#ffffff'] },
  { key: 'interstella',     title: 'Interstella',  type: 'sphere',     c: ['#73bfc4', '#ff810a', '#8da0ce'] },
  { key: 'nightyNight',     title: 'Nighty night', type: 'waterPlane', c: ['#606080', '#8d7dca', '#212121'] },
  { key: 'violaOrientalis', title: 'Viola',        type: 'sphere',     c: ['#ffffff', '#ffbb00', '#0700ff'] },
  { key: 'universe',        title: 'Universe',     type: 'waterPlane', c: ['#5606ff', '#fe8989', '#000000'] },
  { key: 'sunset',          title: 'Sunset',       type: 'sphere',     c: ['#ff7a33', '#33a0ff', '#ffc53d'] },
  { key: 'mandarin',        title: 'Mandarin',     type: 'waterPlane', auto: false, c: ['#ff6a1a', '#c73c00', '#FD4912'] },
  { key: 'cottonCandy',     title: 'Cotton Candy', type: 'waterPlane', c: ['#ebedff', '#f3f2f8', '#dbf8ff'] },
];

/** The presets the app may hand out unasked. */
const AUTO = PRESETS.filter((p) => p.auto !== false);

const BY_KEY = new Map(PRESETS.map((p) => [p.key, p]));

/** FNV-1a. Small, stable across engines, and enough to spread ten ways. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Which preset this student wears.
 *
 * An explicit seed wins. Otherwise it is derived from the id, so the avatar is
 * stable from the first render — the same student always gets the same face,
 * on every device, with nothing stored. An unrecognised seed falls through to
 * the derived one rather than rendering nothing.
 */
export function presetFor({ id = '', avatar_seed = null } = {}) {
  if (avatar_seed && BY_KEY.has(avatar_seed)) return BY_KEY.get(avatar_seed);
  return AUTO[hash(String(id)) % AUTO.length];
}

/** Relative luminance, for deciding whether the initial sits light or dark. */
function luminance(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The gradient, as a `background` value.
 *
 * Three colours, arranged by the preset's geometry. Cotton Candy is the reason
 * the arrangement matters: three near-white tones need their stops far apart or
 * the disc reads as flat paint.
 */
export function backgroundFor(preset) {
  const [a, b, c] = preset.c;
  switch (preset.type) {
    case 'sphere':
      // Lit from upper-left, the way the real orb is.
      return `radial-gradient(circle at 30% 24%, ${a} 0%, transparent 58%),` +
             `radial-gradient(circle at 74% 76%, ${c} 0%, transparent 62%),` +
             `linear-gradient(150deg, ${b} 12%, ${c} 88%)`;
    case 'plane':
      return `radial-gradient(120% 100% at 12% 8%, ${a} 0%, transparent 55%),` +
             `linear-gradient(140deg, ${b} 0%, ${c} 100%)`;
    default: // waterPlane — soft overlapping pools
      return `radial-gradient(70% 60% at 22% 30%, ${a} 0%, transparent 70%),` +
             `radial-gradient(70% 60% at 78% 68%, ${b} 0%, transparent 70%),` +
             `linear-gradient(160deg, ${c} 0%, ${b} 100%)`;
  }
}

/** Light or dark, whichever the initial will actually be legible against. */
export function inkFor(preset) {
  const mean = preset.c.reduce((sum, hex) => sum + luminance(hex), 0) / preset.c.length;
  return mean > 0.45 ? 'rgba(12,12,16,.82)' : '#fff';
}

/**
 * Paint an element as this student's avatar.
 *
 * Writes inline styles rather than toggling a class per preset: ten presets
 * would be ten rules that exist only to hold three hex values each, and the
 * values already live in this file.
 */
export function paintAvatar(el, student, label) {
  if (!el) return;
  const preset = presetFor(student ?? {});
  el.style.background = backgroundFor(preset);
  el.style.color = inkFor(preset);
  el.textContent = (label ?? '?').trim()[0]?.toUpperCase() ?? '?';
  el.dataset.preset = preset.key;
  return preset;
}
