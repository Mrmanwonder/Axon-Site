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

test('dot-face presets are fine local portrait grids, never image URLs', () => {
  const faces = PRESETS.filter(preset => preset.kind === 'dot-face');
  assert.equal(faces.length, 8);
  for (const face of faces) {
    assert.equal(face.glyph.size, 36);
    assert.ok(face.glyph.points.length > 300, 'portrait needs a filled halftone silhouette, not a sparse outline');
    assert.ok(face.glyph.points.every(point =>
      Number.isInteger(point.x) && Number.isInteger(point.y)
      && point.x >= 0 && point.x < 36 && point.y >= 0 && point.y < 36
    ));
    assert.ok(face.glyph.points.every(point => [0, 1, 2].includes(point.tone)));
    assert.ok(new Set(face.glyph.points.map(point => point.tone)).size >= 2,
      'portrait needs primary and secondary dot tones');
    assert.ok(face.glyph.points.every(point => /^#[0-9a-f]{6}$/i.test(point.fill)),
      'every portrait dot should carry an explicit local palette color');
    assert.ok(new Set(face.glyph.points.map(point => point.fill)).size >= 6,
      'portrait needs distinct skin, hair, feature, lip, and clothing colors');
    assert.equal('src' in face, false);
    assert.equal('url' in face, false);
  }
  assert.equal(new Set(faces.map(face =>
    face.glyph.points.map(point => point.x + ':' + point.y + ':' + point.tone + ':' + point.fill).join('|')
  )).size, faces.length, 'each portrait silhouette should be distinct');
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
