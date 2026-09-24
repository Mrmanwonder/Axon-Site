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

const FACE_GRID_SIZE = 28;

function buildDotFace(index) {
  const points = new Map();
  const add = (x, y, tone = 2) => {
    if (x < 0 || x >= FACE_GRID_SIZE || y < 0 || y >= FACE_GRID_SIZE) return;
    const key = x + ':' + y;
    const previous = points.get(key);
    if (!previous || tone > previous.tone) points.set(key, { x, y, tone });
  };
  const hair = (x, y) => add(x, y, 2);

  // The reference language is a tiny pixel portrait: the gradient itself is
  // the "skin", while a fine dot matrix draws the silhouette and expression.
  // That keeps the face light and graphic instead of becoming a dense mask.
  for (let y = 5; y <= 23; y += 1) {
    const dy = (y - 14) / 9.5;
    const radius = Math.round(7.4 * Math.sqrt(Math.max(0, 1 - dy * dy)));
    add(14 - radius, y, 1);
    add(14 + radius, y, 1);
    if (y === 5 || y === 23) {
      for (let x = 14 - radius; x <= 14 + radius; x += 1) add(x, y, 1);
    }
  }

  // Ears and a slightly stronger jaw keep the head readable at nav-avatar size.
  [
    [6,12],[5,13],[5,14],[5,15],[6,16],
    [22,12],[23,13],[23,14],[23,15],[22,16],
    [8,20],[9,21],[10,22],[11,23],
    [17,23],[18,22],[19,21],[20,20],
  ].forEach(([x, y]) => add(x, y, 1));

  // Eight distinct, friendly silhouettes inspired by classic low-resolution
  // character portraits. Hair is the only dense region; the face stays open.
  if (index === 0) {
    for (let y = 4; y <= 10; y += 1) {
      for (let x = 7; x <= 21; x += 1) {
        if (((x - 14) / 8) ** 2 + ((y - 9) / 5.5) ** 2 <= 1.12
          && (y <= 7 + (x - 7) * .2 || x <= 9)) hair(x, y);
      }
    }
    for (let y = 8; y <= 13; y += 1) hair(7, y);
  } else if (index === 1) {
    for (let y = 4; y <= 9; y += 1) {
      for (let x = 7; x <= 21; x += 1) {
        if (((x - 14) / 8) ** 2 + ((y - 9) / 5.5) ** 2 <= 1.15) hair(x, y);
      }
    }
    for (let y = 8; y <= 18; y += 1) {
      hair(7, y); hair(8, y); hair(20, y); hair(21, y);
    }
    for (let x = 8; x <= 11; x += 1) hair(x, 10);
  } else if (index === 2) {
    for (let y = 5; y <= 9; y += 1) {
      for (let x = 7; x <= 21; x += 1) {
        if (((x - 14) / 8) ** 2 + ((y - 9) / 5.5) ** 2 <= 1.2) hair(x, y);
      }
    }
    [[9,5],[10,4],[11,3],[12,4],[13,2],[14,3],[15,4],[17,4],[18,3],[19,4],[20,5]]
      .forEach(([x, y]) => hair(x, y));
    for (let y = 8; y <= 12; y += 1) { hair(7, y); hair(21, y); }
  } else if (index === 3) {
    for (let y = 4; y <= 9; y += 1) {
      for (let x = 7; x <= 21; x += 1) {
        if (((x - 14) / 8) ** 2 + ((y - 9) / 5.5) ** 2 <= 1.15) hair(x, y);
      }
    }
    [[8,10],[9,10],[10,10],[11,10],[12,9],[13,9],[14,8],[15,8],[16,7],[17,7],[18,6]]
      .forEach(([x, y]) => hair(x, y));
    for (let y = 8; y <= 18; y += 1) hair(7, y);
  } else if (index === 4) {
    for (let y = 5; y <= 8; y += 1) {
      for (let x = 8; x <= 20; x += 1) hair(x, y);
    }
    for (let x = 8; x <= 20; x += 2) hair(x, 9);
  } else if (index === 5) {
    for (let y = 4; y <= 9; y += 1) {
      for (let x = 7; x <= 21; x += 1) {
        if (((x - 14) / 8) ** 2 + ((y - 9) / 5.5) ** 2 <= 1.15) hair(x, y);
      }
    }
    for (let y = 8; y <= 22; y += 1) {
      hair(6, y); hair(7, y); hair(21, y); hair(22, y);
    }
    for (let x = 8; x <= 11; x += 1) hair(x, 10);
  } else if (index === 6) {
    [[8,7],[10,5],[13,4],[16,4],[19,5],[21,7],[7,10],[21,10]].forEach(([cx, cy]) => {
      for (let y = cy - 1; y <= cy + 1; y += 1) {
        for (let x = cx - 1; x <= cx + 1; x += 1) {
          if (Math.abs(x - cx) + Math.abs(y - cy) <= 2) hair(x, y);
        }
      }
    });
    for (let y = 7; y <= 10; y += 1) {
      for (let x = 8; x <= 20; x += 1) if ((x + y) % 2 === 0) hair(x, y);
    }
  } else {
    for (let y = 5; y <= 9; y += 1) {
      for (let x = 8; x <= 20; x += 1) hair(x, y);
    }
    for (let y = 17; y <= 21; y += 1) {
      const radius = Math.max(3, 6 - (y - 17));
      hair(14 - radius, y); hair(14 + radius, y);
    }
    for (let x = 11; x <= 17; x += 1) hair(x, 22);
  }

  // Brows and eyes use only a handful of dots so expressions stay soft.
  if (index === 2 || index === 6) {
    [[9,12],[10,11],[11,12],[17,12],[18,11],[19,12]]
      .forEach(([x, y]) => add(x, y));
  } else {
    [9,10,11,17,18,19].forEach((x) => add(x, 12));
  }
  add(10, 14);
  add(18, 14);

  // A low-opacity three-dot nose is enough to imply form without making the
  // portrait look uncanny.
  add(14, 15, 0);
  add(13, 16, 0);
  add(14, 16, 0);

  const smiles = [
    [[11,18],[12,19],[13,19],[14,19],[15,19],[16,19],[17,18]],
    [[12,18],[13,19],[14,19],[15,19],[16,18]],
    [[12,19],[13,19],[14,19],[15,19],[16,19]],
    [[11,18],[12,18],[13,19],[14,19],[15,19],[16,18],[17,18]],
    [[12,18],[13,18],[14,18],[15,18],[16,18]],
    [[12,19],[13,19],[14,19],[15,19],[16,19]],
    [[11,18],[12,19],[13,19],[14,19],[15,19],[16,19],[17,18]],
    [[12,18],[13,19],[14,19],[15,19],[16,18]],
  ];
  smiles[index].forEach(([x, y]) => add(x, y));

  // One glasses portrait and one freckled portrait add personality without
  // changing the underlying friendly face grammar.
  if (index === 4) {
    for (let x = 8; x <= 12; x += 1) add(x, 13);
    for (let x = 16; x <= 20; x += 1) add(x, 13);
    [14,15].forEach((y) => {
      add(8, y); add(12, y); add(16, y); add(20, y);
    });
    add(13, 14); add(14, 14); add(15, 14);
  }
  if (index === 3) {
    [[8,16],[10,16],[18,16],[20,16]].forEach(([x, y]) => add(x, y, 0));
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
