// Student avatars are generated locally from a tiny preset key. No photograph,
// upload bucket or remotely fetched image is involved.

const GRADIENTS = [
  { kind: 'gradient', key: 'halo', title: 'Halo', type: 'plane', auto: false, c: ['#ff5005', '#dbba95', '#d0bce1'] },
  { kind: 'gradient', key: 'pensive', title: 'Pensive', type: 'sphere', c: ['#809bd6', '#910aff', '#af38ff'] },
  { kind: 'gradient', key: 'mint', title: 'Mint', type: 'waterPlane', c: ['#94ffd1', '#6bf5ff', '#ffffff'] },
  { kind: 'gradient', key: 'interstella', title: 'Interstella', type: 'sphere', c: ['#73bfc4', '#ff810a', '#8da0ce'] },
  { kind: 'gradient', key: 'nightyNight', title: 'Nighty night', type: 'waterPlane', c: ['#606080', '#8d7dca', '#212121'] },
  { kind: 'gradient', key: 'violaOrientalis', title: 'Viola', type: 'sphere', c: ['#ffffff', '#ffbb00', '#0700ff'] },
  { kind: 'gradient', key: 'universe', title: 'Universe', type: 'waterPlane', c: ['#5606ff', '#fe8989', '#000000'] },
  { kind: 'gradient', key: 'sunset', title: 'Sunset', type: 'sphere', c: ['#ff7a33', '#33a0ff', '#ffc53d'] },
  { kind: 'gradient', key: 'mandarin', title: 'Mandarin', type: 'waterPlane', auto: false, c: ['#ff6a1a', '#c73c00', '#FD4912'] },
  { kind: 'gradient', key: 'cottonCandy', title: 'Cotton Candy', type: 'waterPlane', c: ['#ebedff', '#f3f2f8', '#dbf8ff'] },

  // Seven original soft-volumetric families requested for the expanded picker.
  { kind: 'gradient', key: 'dreamBloom', title: 'Dream bloom', type: 'volumetric', c: ['#f5e8ff', '#7f67ff', '#2d1c68', '#8ff3df'] },
  { kind: 'gradient', key: 'aquaViolet', title: 'Aqua violet', type: 'volumetric', c: ['#85f3ec', '#7c69ff', '#24185f', '#d7fbff'] },
  { kind: 'gradient', key: 'midnightLime', title: 'Midnight lime', type: 'volumetric', c: ['#d8ff72', '#52d89b', '#171a43', '#88a7ff'] },
  { kind: 'gradient', key: 'emberViolet', title: 'Ember violet', type: 'volumetric', c: ['#ffad7a', '#a453ff', '#351952', '#ffd9bb'] },
  { kind: 'gradient', key: 'citrusMint', title: 'Citrus mint', type: 'volumetric', c: ['#eaff78', '#76f1c2', '#246b6c', '#fff4b2'] },
  { kind: 'gradient', key: 'frostCobalt', title: 'Frost cobalt', type: 'volumetric', c: ['#eaf7ff', '#6e9cff', '#173676', '#9fe9ff'] },
  { kind: 'gradient', key: 'copperRose', title: 'Copper rose', type: 'volumetric', c: ['#ffc6b0', '#bd6e86', '#4c263b', '#ffe4ca'] },
];

const FACE_PALETTES = [
  { skin: '#f3c8a8', hair: '#34251f', feature: '#17171b', shirt: '#f6f1e8' },
  { skin: '#dca27d', hair: '#1f1c1d', feature: '#151519', shirt: '#b9d7ff' },
  { skin: '#b97855', hair: '#2b1d19', feature: '#151519', shirt: '#ffd8a8' },
  { skin: '#7f503b', hair: '#171719', feature: '#0d0d10', shirt: '#d8c6ff' },
  { skin: '#edbb96', hair: '#6a3827', feature: '#17171b', shirt: '#c7f0dd' },
  { skin: '#c98c68', hair: '#252025', feature: '#111116', shirt: '#ffe1ef' },
  { skin: '#9f6548', hair: '#18181c', feature: '#0d0d10', shirt: '#d9f0ff' },
  { skin: '#f0c3a0', hair: '#4a2d24', feature: '#151519', shirt: '#fff0b8' },
];

function buildDotFace(index) {
  const palette = FACE_PALETTES[index];
  const points = new Map();
  const add = (x, y, role = 'skin', tone = role === 'skin' || role === 'shirt' ? 1 : 2) => {
    if (x < 0 || x >= 20 || y < 0 || y >= 20) return;
    points.set(\`\${x}:\${y}\`, { x, y, tone, fill: palette[role] });
  };

  // Shoulders make these read as tiny portraits rather than floating blobs.
  for (let y = 16; y <= 19; y += 1) {
    const radius = y === 16 ? 3 : y === 17 ? 5 : 6;
    for (let x = 10 - radius; x <= 10 + radius; x += 1) add(x, y, 'shirt');
  }
  add(9, 16, 'skin'); add(10, 16, 'skin'); add(11, 16, 'skin');

  // A compact face with visible ears. The coloured skin field is intentionally
  // solid enough that eyes and mouth remain legible at the 44px nav size.
  for (let y = 5; y <= 15; y += 1) {
    const dy = (y - 10) / 5.6;
    const radius = Math.max(2, Math.floor(4.6 * Math.sqrt(Math.max(0, 1 - dy * dy))));
    for (let x = 10 - radius; x <= 10 + radius; x += 1) add(x, y, 'skin');
  }
  add(5, 10, 'skin'); add(5, 11, 'skin');
  add(15, 10, 'skin'); add(15, 11, 'skin');

  // Eight genuinely different hair silhouettes. They are broad shapes, not a
  // single dotted arc, so the portraits stay recognisable when shrunk.
  const hair = [
    [[6,7],[6,6],[7,5],[8,4],[9,4],[10,4],[11,4],[12,4],[13,5],[14,6],[14,7],[7,6],[8,5],[9,5],[10,5],[11,5],[12,5],[13,6]],
    [[5,8],[6,6],[7,5],[8,4],[9,5],[10,4],[11,5],[12,4],[13,5],[14,6],[15,8],[6,7],[8,6],[10,6],[12,6],[14,7]],
    [[5,9],[5,8],[6,7],[6,6],[7,5],[8,5],[9,4],[10,4],[11,4],[12,5],[13,5],[14,6],[15,7],[15,8],[15,9],[7,6],[8,6],[9,5],[10,5],[11,5],[12,6],[13,6]],
    [[6,7],[6,6],[7,5],[8,4],[9,4],[10,4],[11,4],[12,4],[13,4],[14,5],[14,6],[14,7],[7,6],[8,5],[9,5],[10,5],[11,5],[12,5],[13,5]],
    [[5,8],[6,6],[7,5],[8,4],[9,4],[10,4],[11,4],[12,5],[13,6],[14,7],[15,9],[6,7],[7,6],[8,5],[9,5],[10,5],[11,5],[12,6],[13,7],[14,8]],
    [[5,7],[6,6],[7,5],[8,5],[9,4],[10,5],[11,4],[12,5],[13,5],[14,6],[15,7],[6,8],[14,8],[7,6],[9,6],[11,6],[13,6]],
    [[5,9],[5,8],[6,6],[7,5],[8,4],[9,4],[10,4],[11,4],[12,4],[13,5],[14,6],[15,8],[15,9],[6,7],[7,6],[8,5],[9,5],[10,5],[11,5],[12,5],[13,6],[14,7]],
    [[5,8],[6,6],[7,5],[8,4],[9,4],[10,4],[11,4],[12,4],[13,5],[14,6],[15,8],[6,7],[7,6],[8,5],[9,5],[10,5],[11,5],[12,5],[13,6],[14,7]],
  ];
  hair[index].forEach(([x, y]) => add(x, y, 'hair'));

  // Brows, eyes, nose and mouth are deliberately high-contrast. Some portraits
  // add glasses or freckles, but every one keeps the same clear facial grammar.
  add(8, 9, 'hair'); add(12, 9, 'hair');
  add(8, 10, 'feature'); add(12, 10, 'feature');
  add(10, 12, 'feature', 0);

  if (index === 1 || index === 5) {
    [[7,9],[9,9],[11,9],[13,9],[7,10],[9,10],[11,10],[13,10],[10,10]]
      .forEach(([x, y]) => add(x, y, 'feature'));
  }
  if (index === 2 || index === 6) {
    add(7, 12, 'feature', 0); add(13, 12, 'feature', 0);
  }

  const mouths = [
    [[9,14],[10,15],[11,14]],
    [[9,14],[10,14],[11,14]],
    [[9,15],[10,14],[11,15]],
    [[9,14],[10,14],[11,14],[10,15]],
    [[9,15],[10,15],[11,15]],
    [[9,14],[10,15],[11,14]],
    [[9,14],[10,14],[11,14]],
    [[9,15],[10,14],[11,15]],
  ];
  mouths[index].forEach(([x, y]) => add(x, y, 'feature'));

  return [...points.values()];
}

const FACE_BACKGROUNDS = [
  'dreamBloom', 'aquaViolet', 'midnightLime', 'emberViolet',
  'citrusMint', 'frostCobalt', 'copperRose', 'pensive',
];

const DOT_FACES = Array.from({ length: 8 }, (_, index) => ({
  kind: 'dot-face',
  key: \`dotFace\${String(index + 1).padStart(2, '0')}\`,
  title: \`Dot portrait \${index + 1}\`,
  backgroundPreset: FACE_BACKGROUNDS[index],
  glyph: { size: 20, points: buildDotFace(index) },
}));

export const PRESETS = [...GRADIENTS, ...DOT_FACES];
const BY_KEY = new Map(PRESETS.map((preset) => [preset.key, preset]));
const AUTO = GRADIENTS.filter((preset) => preset.auto !== false);

function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function presetFor({ id = '', avatar_seed = null } = {}) {
  if (avatar_seed && BY_KEY.has(avatar_seed)) return BY_KEY.get(avatar_seed);
  return AUTO[hash(String(avatar_seed || id)) % AUTO.length];
}

export function isChosen(student) {
  return !!student?.avatar_seed && BY_KEY.has(student.avatar_seed);
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function backgroundFor(preset) {
  if (!preset) return 'var(--surface-sunk)';
  if (preset.kind === 'dot-face') return backgroundFor(BY_KEY.get(preset.backgroundPreset));
  const [a, b, c, d] = preset.c;
  switch (preset.type) {
    case 'sphere':
      return `radial-gradient(circle at 30% 24%, ${a} 0%, transparent 58%),radial-gradient(circle at 74% 76%, ${c} 0%, transparent 62%),linear-gradient(150deg, ${b} 12%, ${c} 88%)`;
    case 'plane':
      return `radial-gradient(120% 100% at 12% 8%, ${a} 0%, transparent 55%),linear-gradient(140deg, ${b} 0%, ${c} 100%)`;
    case 'volumetric':
      return `radial-gradient(80% 72% at 28% 22%, ${a} 0%, transparent 58%),radial-gradient(78% 70% at 76% 30%, ${b} 0%, transparent 62%),radial-gradient(90% 80% at 68% 86%, ${d} 0%, transparent 58%),radial-gradient(95% 90% at 22% 82%, ${c} 0%, transparent 70%),linear-gradient(145deg, ${c} 0%, ${b} 100%)`;
    default:
      return `radial-gradient(70% 60% at 22% 30%, ${a} 0%, transparent 70%),radial-gradient(70% 60% at 78% 68%, ${b} 0%, transparent 70%),linear-gradient(160deg, ${c} 0%, ${b} 100%)`;
  }
}

export function inkFor(preset) {
  if (preset?.kind === 'dot-face') return 'rgba(15,16,22,.82)';
  const mean = preset.c.slice(0, 3).reduce((sum, hex) => sum + luminance(hex), 0) / 3;
  return mean > 0.45 ? 'rgba(12,12,16,.82)' : '#fff';
}

export function avatarRenderFor(student) {
  const preset = presetFor(student ?? {});
  return {
    kind: preset.kind,
    preset: preset.key,
    background: backgroundFor(preset),
    color: inkFor(preset),
    glyph: preset.kind === 'dot-face' ? preset.glyph : null,
  };
}

// Compatibility name used by existing nav/settings call sites.
export const avatarStyleFor = avatarRenderFor;

export function initialFor(label) {
  return (label ?? '').trim()[0]?.toUpperCase() ?? '?';
}
