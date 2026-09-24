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

const FACE_GRID_SIZE = 36;

const FACE_PALETTES = [
  { skin: '#D99A73', skinLight: '#F4BE98', skinShadow: '#B97758', hair: '#2A1E1D', feature: '#241A1B', lip: '#8E4C52', shirt: '#DCE8FF', shirtShadow: '#8DA7DD' },
  { skin: '#8F5A43', skinLight: '#B9795D', skinShadow: '#704333', hair: '#171619', feature: '#171416', lip: '#713B43', shirt: '#A9D2FF', shirtShadow: '#5B82C2' },
  { skin: '#F0B58F', skinLight: '#FFD0AE', skinShadow: '#CD8C69', hair: '#5A3327', feature: '#30201E', lip: '#A6535B', shirt: '#A9E6C7', shirtShadow: '#5BA681' },
  { skin: '#6F4536', skinLight: '#95634D', skinShadow: '#533127', hair: '#191719', feature: '#151315', lip: '#7C414A', shirt: '#FFB59F', shirtShadow: '#C66F60' },
  { skin: '#E2A47D', skinLight: '#F6C3A0', skinShadow: '#BC795B', hair: '#714731', feature: '#2A1E1A', lip: '#98505A', shirt: '#EFE39A', shirtShadow: '#B4A64E' },
  { skin: '#5D3A2F', skinLight: '#805545', skinShadow: '#432820', hair: '#211A19', feature: '#141214', lip: '#70414B', shirt: '#B2A9FF', shirtShadow: '#6C63C7' },
  { skin: '#C98564', skinLight: '#E8AA87', skinShadow: '#A7654B', hair: '#3A2421', feature: '#25191A', lip: '#8C4650', shirt: '#B8E5FF', shirtShadow: '#6A9EC0' },
  { skin: '#F2C4A4', skinLight: '#FFE0C6', skinShadow: '#D59A78', hair: '#8B5A3C', feature: '#35231E', lip: '#A55A64', shirt: '#F1B6D1', shirtShadow: '#B96E91' },
];

function buildDotFace(index) {
  const palette = FACE_PALETTES[index];
  const points = new Map();
  const put = (x, y, fill, tone = 2) => {
    if (x < 0 || x >= FACE_GRID_SIZE || y < 0 || y >= FACE_GRID_SIZE) return;
    points.set(`${x}:${y}`, { x, y, tone, fill });
  };
  const ellipse = (cx, cy, rx, ry, fill, tone = 2, predicate = null) => {
    const minX = Math.floor(cx - rx);
    const maxX = Math.ceil(cx + rx);
    const minY = Math.floor(cy - ry);
    const maxY = Math.ceil(cy + ry);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
        if (inside && (!predicate || predicate(x, y))) put(x, y, fill, tone);
      }
    }
  };
  const rect = (x1, y1, x2, y2, fill, tone = 2, predicate = null) => {
    for (let y = y1; y <= y2; y += 1) {
      for (let x = x1; x <= x2; x += 1) {
        if (!predicate || predicate(x, y)) put(x, y, fill, tone);
      }
    }
  };

  // Build a complete portrait from back to front. The face itself is a filled
  // halftone surface, rather than an outline drawn over the gradient. This is
  // what makes the portrait read immediately as a person at 44–64 px.
  ellipse(18, 36.5, 15.5, 9.2, palette.shirtShadow, 1);
  ellipse(18, 35.2, 14.2, 7.6, palette.shirt, 2);
  rect(14, 25, 22, 31, palette.skinShadow, 1);
  rect(15, 24, 21, 30, palette.skin, 2);

  ellipse(7.7, 19, 2.2, 4.5, palette.skinShadow, 1);
  ellipse(28.3, 19, 2.2, 4.5, palette.skinShadow, 1);
  ellipse(18, 18.2, index === 5 ? 10.2 : 10.8, index === 4 ? 12.0 : 12.8, palette.skin, 2);

  // Soft directional lighting gives the tiny portrait volume without using a
  // photographic texture. Highlights and shadows remain individual dots.
  ellipse(14.1, 15.6, 5.2, 8.6, palette.skinLight, 1, (x, y) => x <= 16 && y <= 23);
  ellipse(23.2, 19.6, 4.4, 7.5, palette.skinShadow, 1, (x) => x >= 22);

  const hair = palette.hair;
  if (index === 0) {
    ellipse(17.2, 8.8, 11.0, 6.7, hair, 2, (x, y) => y <= 11.6 + (x - 8) * .18);
    rect(7, 9, 10, 17, hair, 2, (x, y) => y <= 18 - (x - 7));
    rect(24, 8, 28, 12, hair, 2, (x, y) => y <= 14 - (28 - x));
  } else if (index === 1) {
    ellipse(18, 9.4, 11.2, 6.9, hair, 2);
    rect(7, 9, 10, 25, hair, 2);
    rect(26, 9, 29, 25, hair, 2);
    ellipse(9.5, 23, 2.5, 5.5, hair, 2);
    ellipse(26.5, 23, 2.5, 5.5, hair, 2);
  } else if (index === 2) {
    const curls = [[9,8],[12,5],[16,5],[20,5],[24,7],[27,10],[8,12],[11,10],[15,9],[19,9],[23,10]];
    curls.forEach(([cx, cy]) => ellipse(cx, cy, 3.0, 2.8, hair, 2));
    rect(7, 11, 10, 17, hair, 2);
    rect(26, 11, 29, 17, hair, 2);
  } else if (index === 3) {
    ellipse(17, 8.7, 11.2, 6.6, hair, 2);
    rect(7, 9, 10, 20, hair, 2);
    for (let y = 7; y <= 15; y += 1) {
      for (let x = 10; x <= 27; x += 1) {
        if (y <= 15 - (x - 10) * .38) put(x, y, hair, 2);
      }
    }
  } else if (index === 4) {
    ellipse(18, 7.6, 10.3, 4.7, hair, 2, (_x, y) => y <= 9);
    rect(8, 8, 28, 10, hair, 2, (x, y) => (x + y) % 2 === 0 || y < 10);
  } else if (index === 5) {
    ellipse(18, 9.0, 11.5, 6.8, hair, 2);
    rect(6, 10, 10, 28, hair, 2);
    rect(26, 10, 30, 28, hair, 2);
    ellipse(8.5, 25, 3.2, 6.0, hair, 2);
    ellipse(27.5, 25, 3.2, 6.0, hair, 2);
  } else if (index === 6) {
    ellipse(11, 7, 5.2, 5.0, hair, 2);
    ellipse(25, 7, 5.2, 5.0, hair, 2);
    ellipse(18, 10.3, 10.5, 5.8, hair, 2);
    rect(7, 11, 10, 18, hair, 2);
    rect(26, 11, 29, 18, hair, 2);
  } else {
    ellipse(18, 8.4, 10.7, 5.8, hair, 2);
    for (let x = 9; x <= 27; x += 1) {
      const fringe = 10 + Math.round(2 * Math.sin((x - 9) * .72));
      for (let y = 8; y <= fringe; y += 1) put(x, y, hair, 2);
    }
    rect(8, 10, 10, 16, hair, 2);
  }

  // Brows sit above clearly separated eyes. Keeping a full dot between the two
  // prevents the expression from collapsing into a horizontal stripe.
  const browY = index === 3 ? 14 : 13;
  [[11, browY],[12, browY - 1],[13, browY - 1],[14, browY],
   [22, browY],[23, browY - 1],[24, browY - 1],[25, browY]]
    .forEach(([x, y]) => put(x, y, hair, 2));

  [[12,16],[13,16],[14,16],[22,16],[23,16],[24,16]]
    .forEach(([x, y]) => put(x, y, palette.feature, 2));
  put(13, 16, '#101014', 2);
  put(23, 16, '#101014', 2);
  put(12, 15, palette.skinLight, 1);
  put(22, 15, palette.skinLight, 1);

  // A short shaded nose has enough structure to read without becoming a dark
  // vertical line, which was one of the old portraits' uncanny artifacts.
  put(18, 18, palette.skinShadow, 1);
  put(18, 19, palette.skinShadow, 1);
  put(17, 20, palette.skinShadow, 1);
  put(18, 20, palette.skinShadow, 1);
  put(19, 20, palette.skinShadow, 1);

  const mouths = [
    [[14,23],[15,24],[16,24],[17,25],[18,25],[19,25],[20,24],[21,24],[22,23]],
    [[15,24],[16,24],[17,25],[18,25],[19,25],[20,24],[21,24]],
    [[15,24],[16,25],[17,25],[18,25],[19,25],[20,25],[21,24]],
    [[14,23],[15,24],[16,25],[17,25],[18,25],[19,25],[20,25],[21,24],[22,23]],
    [[15,24],[16,24],[17,24],[18,24],[19,24],[20,24],[21,24]],
    [[15,24],[16,25],[17,25],[18,25],[19,25],[20,25],[21,24]],
    [[14,23],[15,24],[16,24],[17,25],[18,25],[19,25],[20,24],[21,24],[22,23]],
    [[15,23],[16,24],[17,25],[18,25],[19,25],[20,24],[21,23]],
  ];
  mouths[index].forEach(([x, y]) => put(x, y, palette.lip, 2));

  // Small individual traits keep the set from feeling like recolors.
  if (index === 3) {
    [[11,20],[13,21],[23,21],[25,20]].forEach(([x, y]) => put(x, y, palette.skinShadow, 1));
  }
  if (index === 4) {
    const glass = '#302B31';
    for (let x = 10; x <= 15; x += 1) { put(x, 15, glass, 2); put(x, 18, glass, 2); }
    for (let x = 21; x <= 26; x += 1) { put(x, 15, glass, 2); put(x, 18, glass, 2); }
    [16,17].forEach((y) => {
      put(10, y, glass, 2); put(15, y, glass, 2);
      put(21, y, glass, 2); put(26, y, glass, 2);
    });
    [16,17,18,19,20].forEach((x) => put(x, 16, glass, 2));
  }

  return [...points.values()];
}

const FACE_BACKGROUNDS = [
  'dreamBloom', 'aquaViolet', 'midnightLime', 'emberViolet',
  'citrusMint', 'frostCobalt', 'copperRose', 'pensive',
];

const DOT_FACES = Array.from({ length: 8 }, (_, index) => ({
  kind: 'dot-face',
  key: 'dotFace' + String(index + 1).padStart(2, '0'),
  title: 'Dot portrait ' + (index + 1),
  backgroundPreset: FACE_BACKGROUNDS[index],
  glyph: { size: FACE_GRID_SIZE, points: buildDotFace(index) },
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

function colorPresetFor(preset) {
  if (!preset) return GRADIENTS[0];
  if (preset.kind === 'dot-face') return BY_KEY.get(preset.backgroundPreset) ?? GRADIENTS[0];
  return preset;
}

export function paletteFor(preset) {
  const source = colorPresetFor(preset);
  const [a, b, c, d] = source.c;
  return [a, b, c, d ?? b];
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
    palette: paletteFor(preset),
    color: inkFor(preset),
    glyph: preset.kind === 'dot-face' ? preset.glyph : null,
  };
}

// Compatibility name used by existing nav/settings call sites.
export const avatarStyleFor = avatarRenderFor;

export function initialFor(label) {
  return (label ?? '').trim()[0]?.toUpperCase() ?? '?';
}
