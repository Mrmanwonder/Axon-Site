import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, avatarRenderFor, backgroundFor, isChosen,
} from '../src/avatar.js';

test('avatar preset keys are unique and include the new Axon families', () => {
  const keys = PRESETS.map(preset => preset.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of [
    'dreamBloom','aquaViolet','midnightLime','emberViolet',
    'citrusMint','frostCobalt','copperRose',
  ]) assert.ok(keys.includes(key), `missing ${key}`);
  for (let i = 1; i <= 8; i += 1) {
    assert.ok(keys.includes(`dotFace${String(i).padStart(2, '0')}`));
  }
});

test('dot-face presets are local circle-grid definitions, never image URLs', () => {
  const faces = PRESETS.filter(preset => preset.kind === 'dot-face');
  assert.equal(faces.length, 8);
  for (const face of faces) {
    assert.equal(face.glyph.size, 20);
    assert.ok(face.glyph.points.length > 20);
    assert.ok(face.glyph.points.every(point =>
      Number.isInteger(point.x) && Number.isInteger(point.y)
      && point.x >= 0 && point.x < 20 && point.y >= 0 && point.y < 20
    ));
    assert.equal('src' in face, false);
    assert.equal('url' in face, false);
  }
});

test('new volumetric gradients stay static CSS and contain no fetched assets', () => {
  for (const preset of PRESETS.filter(preset => preset.type === 'volumetric')) {
    const background = backgroundFor(preset);
    assert.match(background, /radial-gradient/);
    assert.match(background, /linear-gradient/);
    assert.doesNotMatch(background, /url\(/);
  }
});

test('a chosen dot-face renders as a glyph and remains a stored preset key', () => {
  const student = { id: 'student', avatar_seed: 'dotFace03' };
  assert.equal(isChosen(student), true);
  const render = avatarRenderFor(student);
  assert.equal(render.kind, 'dot-face');
  assert.equal(render.preset, 'dotFace03');
  assert.ok(render.glyph?.points.length);
  assert.doesNotMatch(render.background, /url\(/);
});
