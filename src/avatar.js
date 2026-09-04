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
//
// No image is involved at any point. There is no avatar bucket, no upload path
// and no column that could hold a photograph of a child — see the comment on
// `student.avatar_seed`. What is stored is at most a preset name.

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
 * `avatar_seed` holds one of two shapes, and which one it is IS the answer to
 * "did they choose this?":
 *
 * · A preset key — they picked it. It wins outright.
 * · A random hex string — nobody has picked anything. It is what the column
 *   was created with, one distinct value per student, and it is what the
 *   derived preset is drawn from. Deriving from the seed rather than from the
 *   row id matters: the id is a real identifier and this value is deliberately
 *   not, so a face derived from it stays a face and not a fingerprint.
 *
 * An unrecognised value falls through to the derived preset rather than
 * rendering nothing — bad data degrades to a default, never to a blank.
 */
export function presetFor({ id = '', avatar_seed = null } = {}) {
  if (avatar_seed && BY_KEY.has(avatar_seed)) return BY_KEY.get(avatar_seed);
  return AUTO[hash(String(avatar_seed || id)) % AUTO.length];
}

/** True when this student has actually chosen their look, rather than being
    handed the one derived from their seed. The picker uses it to decide what
    to show as selected. */
export function isChosen(student) {
  return !!student?.avatar_seed && BY_KEY.has(student.avatar_seed);
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
      return `radial-gradient(circle at 30% 24%, ${a} 0%, transparent 58%),`
           + `radial-gradient(circle at 74% 76%, ${c} 0%, transparent 62%),`
           + `linear-gradient(150deg, ${b} 12%, ${c} 88%)`;
    case 'plane':
      return `radial-gradient(120% 100% at 12% 8%, ${a} 0%, transparent 55%),`
           + `linear-gradient(140deg, ${b} 0%, ${c} 100%)`;
    default: // waterPlane — soft overlapping pools
      return `radial-gradient(70% 60% at 22% 30%, ${a} 0%, transparent 70%),`
           + `radial-gradient(70% 60% at 78% 68%, ${b} 0%, transparent 70%),`
           + `linear-gradient(160deg, ${c} 0%, ${b} 100%)`;
  }
}

/** Light or dark, whichever the initial will actually be legible against. */
export function inkFor(preset) {
  const mean = preset.c.reduce((sum, hex) => sum + luminance(hex), 0) / preset.c.length;
  return mean > 0.45 ? 'rgba(12,12,16,.82)' : '#fff';
}

/**
 * Everything a surface needs to draw this student, as inline style values.
 *
 * Inline rather than a class per preset: ten presets would be ten CSS rules
 * that exist only to hold three hex values each, and the values already live
 * in this file. This is also the single source both the Settings disc and the
 * nav swatch read, which is the point — they drifted before, and the nav one
 * was a hardcoded letter M.
 */
export function avatarStyleFor(student) {
  const preset = presetFor(student ?? {});
  return { background: backgroundFor(preset), color: inkFor(preset), preset: preset.key };
}

/** The one character the disc carries. Never more: two initials would be a
    surname, and the app does not collect one. */
export function initialFor(label) {
  return (label ?? '').trim()[0]?.toUpperCase() ?? '?';
}
