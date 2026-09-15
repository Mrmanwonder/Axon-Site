import fs from 'node:fs';

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`${path}: patch made no changes`);
  fs.writeFileSync(path, after);
}

function exact(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`missing ${label}`);
  return source.replace(before, after);
}

function regex(source, pattern, after, label) {
  if (!pattern.test(source)) throw new Error(`missing ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, after);
}

patch('src/scan/capture.js', (input) => {
  let s = input;
  s = exact(s,
    "import { CAPTURE, CONDITIONING, QUALITY } from './contract.js';",
    "import { CAPTURE, CONDITIONING, ENHANCE, QUALITY } from './contract.js';",
    'capture contract import');

  // Remove both forms of stabilization: the preview zoom/pan compensator and
  // the steady-window anchor that deliberately froze the overlay on an old pose.
  s = regex(s,
    /\/\/ ── preview stabilisation[\s\S]*?(?=\/\*\*\n \* Whether to take the picture\.)/,
    '',
    'preview/steady stabilization block');

  s = regex(s,
    /\/\*\*\n \* Whether to take the picture\.[\s\S]*?export function shouldAutoCapture\(\{[\s\S]*?\n\}\n\n(?=\/\*\*\n \* What the live gate says)/,
    `/**\n * Whether to take the picture.\n *\n * There is deliberately no stillness timer here. Once two independent global\n * detections agree on the document, the per-frame tracker is fully locked, and\n * the quality gate is clear, waiting for a synthetic \"steady\" state only makes\n * the scanner feel broken. Motion blur/focus still has its own real pixel gate.\n */\nexport function shouldAutoCapture({\n  autoCapture, armed, blocking, consecutiveFinds, globalConfirmations = 0,\n  trackState = 'tracking', viewportScaled = false,\n}) {\n  if (!autoCapture || !armed || blocking || viewportScaled) return false;\n  if (consecutiveFinds < CAPTURE.CONSECUTIVE_FINDS) return false;\n  if (globalConfirmations < 2) return false;\n  if (trackState !== 'tracking') return false;\n  return true;\n}\n\n`,
    'auto-capture decision');

  s = exact(s,
    `export function liveGateVerdict(\n  { glare, clipping, fill, sharpness, skew, pageLongEdge, steady, resolutionStatus = 'known' },\n  holding = null,\n) {`,
    `export const MIN_EDGE_COVERAGE = 0.72;\nexport const LIVE_SOURCE_FLOOR = Math.ceil(CONDITIONING.MIN_LONG_EDGE / ENHANCE.MAX_SCALE);\n\nexport function liveGateVerdict(\n  { glare, clipping, fill, edgeCoverage = 1, sharpness, skew, pageLongEdge, resolutionStatus = 'known' },\n  holding = null,\n) {`,
    'live gate signature');

  s = exact(s,
    `  if (resolutionStatus !== 'unknown'\n      && pageLongEdge < CONDITIONING.MIN_LONG_EDGE * easing('resolution')) {\n    return { blocking: 'resolution', hint: 'Closer — the page needs to fill more of the frame for us to read the marking' };\n  }\n  if (fill < CAPTURE.MIN_FILL * easing('distance')) {\n    return { blocking: 'distance', hint: 'Move closer so the page fills more of the frame' };\n  }`,
    `  // The final conditioning target is 2400px, but the rescue path can safely\n  // upscale a source by ENHANCE.MAX_SCALE. Blocking at the final target made\n  // some iPhone video streams mathematically impossible to satisfy.\n  if (resolutionStatus !== 'unknown'\n      && pageLongEdge < LIVE_SOURCE_FLOOR * easing('resolution')) {\n    return { blocking: 'resolution', hint: 'Move a little closer while keeping all four paper corners visible' };\n  }\n  // Area fill is aspect-ratio dependent: a portrait A4 sheet can never occupy\n  // 60% of a landscape camera frame while all four corners remain visible.\n  // Edge coverage asks the invariant question instead: does the page span most\n  // of the frame's short dimension?\n  if (edgeCoverage < MIN_EDGE_COVERAGE * easing('distance')) {\n    return { blocking: 'distance', hint: 'Move closer while keeping all four paper corners visible' };\n  }`,
    'resolution/distance gate');

  s = exact(s,
    `  if (!steady) return { blocking: null, hint: 'Hold still' };\n  return { blocking: null, hint: 'Ready' };`,
    `  return { blocking: null, hint: 'Ready' };`,
    'steady hint');

  s = exact(s,
    `  // The preview stabiliser's state, and the last frame it stepped on. \`pan\` is\n  // in CSS pixels and is what reaches --stab-x/--stab-y.\n  let stab = { slow: null, velocity: { x: 0, y: 0 }, previous: null, pan: { x: 0, y: 0 } };\n  let stabLast = 0;\n`,
    '',
    'stabilizer state');

  s = exact(s,
    `  // The pose the current steady window began at. Steadiness is measured against\n  // this rather than against the previous frame — see step().\n  let steadyAnchor = null;\n  let steadySince = 0;\n  let heldSince = 0;\n  let consecutiveFinds = 0;`,
    `  let consecutiveFinds = 0;\n  // Auto-capture is allowed only after two independent whole-frame detections\n  // agree. Per-frame corner tracking alone cannot promote a random rectangle.\n  let globalConfirmations = 0;`,
    'steady state variables');

  s = exact(s, `      fill: 0,\n      pageLongEdge: 0,`, `      fill: 0,\n      edgeCoverage: 0,\n      pageLongEdge: 0,`, 'edge coverage state');
  s = exact(s, `      steady: false,`, `      steady: true, // compatibility field; stillness no longer gates capture`, 'steady compatibility state');

  s = exact(s,
    `    quad = lastDetection = steadyAnchor = lastSearchSize = null;\n    steadySince = heldSince = consecutiveFinds = 0;`,
    `    quad = lastDetection = lastSearchSize = null;\n    consecutiveFinds = globalConfirmations = 0;`,
    'stop steady cleanup');
  s = exact(s,
    `    stab = { slow: null, velocity: { x: 0, y: 0 }, previous: null, pan: { x: 0, y: 0 } };\n    stabLast = 0;\n`,
    '',
    'stop stabilizer cleanup');

  s = s.replaceAll('lastDetection = steadyAnchor = null;', 'lastDetection = null;');
  s = s.replaceAll('steadySince = heldSince = consecutiveFinds = 0;', 'consecutiveFinds = globalConfirmations = 0;');
  s = s.replaceAll('lastDetection = steadyAnchor = guidance = null;', 'lastDetection = guidance = null;');

  s = exact(s,
    `    track = isSameDocument(track, found, trackSize.width, trackSize.height)\n      ? observe(track, {\n          topLeft: { ...found[0], confidence: 0.9 },\n          topRight: { ...found[1], confidence: 0.9 },\n          bottomRight: { ...found[2], confidence: 0.9 },\n          bottomLeft: { ...found[3], confidence: 0.9 },\n        }, now, trackSize)\n      : acquire(createTrack(), found, now, trackSize);`,
    `    const sameDetectedDocument = isSameDocument(track, found, trackSize.width, trackSize.height);\n    globalConfirmations = sameDetectedDocument ? Math.min(3, globalConfirmations + 1) : 1;\n    track = sameDetectedDocument\n      ? observe(track, {\n          topLeft: { ...found[0], confidence: 0.9 },\n          topRight: { ...found[1], confidence: 0.9 },\n          bottomRight: { ...found[2], confidence: 0.9 },\n          bottomLeft: { ...found[3], confidence: 0.9 },\n        }, now, trackSize)\n      : acquire(createTrack(), found, now, trackSize);`,
    'global confirmation tracking');

  s = regex(s,
    /    const window_ = steadyWindow\(\{[\s\S]*?    if \(next\.blocking\) armed = true;\n/,
    `    lastDetection = tracked;\n    lastSearchSize = { width: tw, height: th };\n    next.steady = true;\n    next.trackState = track.state;\n    next.trackConfidence = documentConfidence(track);\n    next.edgeCoverage = next.pageLongEdge / Math.max(1, Math.min(vw, vh));\n    // ImageCapture has a separate still-photo resolution. For canvas-grab\n    // streams, do not impose a source-pixel target the stream's short edge can\n    // never reach — that was the endless \"move closer\" failure on iPhone.\n    next.resolutionStatus =\n      capturePath === 'image-capture' || Math.min(vw, vh) < LIVE_SOURCE_FLOOR\n        ? 'unknown' : 'known';\n\n    // Follow the newest measured geometry. There is no anchor/dead-zone that can\n    // leave the brackets parked on yesterday's corner; easeQuad only removes\n    // single-frame detector noise and always converges on the live pose.\n    quad = easeQuad(\n      quad,\n      scaleQuad(tracked, { width: tw, height: th }, { width: vw, height: vh }),\n      { width: vw, height: vh },\n    );\n\n    const verdict = liveGateVerdict(next, guidance?.blocking ?? null);\n    guidance = settledGuidance(guidance, verdict, performance.now());\n    next.blocking = guidance.blocking;\n    next.hint = guidance.hint;\n\n    publish(next);\n\n    if (shouldAutoCapture({\n      autoCapture, armed, blocking: next.blocking,\n      consecutiveFinds, globalConfirmations, trackState: track.state,\n      viewportScaled: viewportScaled(),\n    })) {\n      armed = false;\n      shoot(true);\n    }\n    if (next.blocking) armed = true;\n`,
    'publish stabilization/auto-capture block');

  s = exact(s, `    stabilise(quad, toOverlay, rect, w, h);\n\n`, '', 'loop stabilizer call');
  s = regex(s,
    /    \/\/ The video now carries a transform of its own,[\s\S]*?    \}\)\);\n/,
    `    const points = quad.map(toOverlay);\n`,
    'stabilized overlay mapping');

  s = regex(s,
    /  \/\*\*\n   \* Drive the video's stabilisation transform[\s\S]*?(?=  \/\/ ── the shutter)/,
    '',
    'stabilizer implementation');

  return s;
});

patch('src/scan/edges.js', (input) => {
  let s = input;
  s = exact(s, 'const TEXTURE_MAX = 32;', 'const TEXTURE_MAX = 30;', 'texture ceiling');
  s = exact(s,
    '    const score = verdict.paper.score * 2 + Math.min(1, support) + verdict.fill;',
    '    const score = verdict.paper.score * 2.5 + Math.min(1, support) * 1.5 + Math.min(0.35, verdict.fill) * 0.2;',
    'candidate ranking');
  s = exact(s, '  if (paper.paper < 0.85) return null;', '  if (paper.paper < 0.90) return null;', 'paper threshold');
  s = exact(s, 'const EASE_MIN = 0.25;', 'const EASE_MIN = 0.50;', 'ease minimum');
  s = exact(s, 'const EASE_MAX = 0.9;', 'const EASE_MAX = 0.95;', 'ease maximum');
  s = exact(s, 'const EASE_FULL_DRIFT = 0.2;', 'const EASE_FULL_DRIFT = 0.12;', 'ease full drift');
  return s;
});

patch('src/scan/corner-search.js', (input) => {
  let s = input;
  s = exact(s, 'const MIN_SUPPORT = 0.22;', 'const MIN_SUPPORT = 0.27;', 'corner minimum support');
  s = exact(s,
    `export function findCorner(roi, { edgeA, edgeB, tolerance = ANGLE_TOLERANCE } = {}) {`,
    `export function findCorner(roi, {\n  edgeA, edgeB, tolerance = ANGLE_TOLERANCE, expectedX = null, expectedY = null,\n} = {}) {`,
    'corner options');
  s = exact(s,
    `  const margin = Math.max(roi.width, roi.height) * 0.35;\n  if (point.x < -margin || point.y < -margin ||\n      point.x > roi.width + margin || point.y > roi.height + margin) return null;\n\n  // How close to the centre the corner landed. The window was cut around the\n  // *predicted* position, so a corner near the middle is a corner the\n  // prediction got right, which is itself evidence (§19).\n  const cx = roi.width / 2, cy = roi.height / 2;\n  const offCentre = Math.hypot(point.x - cx, point.y - cy) / Math.max(cx, cy);\n  const centrality = Math.max(0, 1 - offCentre);`,
    `  const margin = Math.max(roi.width, roi.height) * 0.12;\n  if (point.x < -margin || point.y < -margin ||\n      point.x > roi.width + margin || point.y > roi.height + margin) return null;\n\n  // Score against the actual predicted point, not the tile centre. A window is\n  // clamped at frame edges, so the prediction is often intentionally off-centre.\n  // More importantly, a strong pair of unrelated lines elsewhere in the tile\n  // must not be allowed to teleport a page corner onto a random object.\n  const ex = Number.isFinite(expectedX) ? expectedX : roi.width / 2;\n  const ey = Number.isFinite(expectedY) ? expectedY : roi.height / 2;\n  const offExpected = Math.hypot(point.x - ex, point.y - ey) / Math.max(roi.width, roi.height);\n  if (offExpected > 0.32) return null;\n  const centrality = Math.max(0, 1 - offExpected / 0.32);`,
    'corner expected-position gate');
  return s;
});

patch('src/scan/detect-worker.js', (input) => {
  let s = input;
  s = exact(s,
    `    const found = findCorner(tileAt(tiles, dx, dy, size), { edgeA: w.edgeA, edgeB: w.edgeB });`,
    `    const found = findCorner(tileAt(tiles, dx, dy, size), {\n      edgeA: w.edgeA, edgeB: w.edgeB, expectedX: w.expectedX, expectedY: w.expectedY,\n    });`,
    'worker expected corner position');
  return s;
});

patch('src/scan/track.js', (input) => {
  let s = input;
  s = exact(s,
    `    const seen = observations ? observations[id] : undefined;\n\n    if (seen && Number.isFinite(seen.x) && Number.isFinite(seen.y)) {`,
    `    const seen = observations ? observations[id] : undefined;\n    const reliable = seen && Number.isFinite(seen.x) && Number.isFinite(seen.y)\n      && (seen.confidence ?? 0) >= 0.42;\n\n    if (reliable) {`,
    'tracker low-confidence rejection');
  s = exact(s,
    `    windows.push({ id, sx, sy, size, edgeA: a, edgeB: b });`,
    `    windows.push({\n      id, sx, sy, size, edgeA: a, edgeB: b,\n      expectedX: centre.x - sx, expectedY: centre.y - sy,\n    });`,
    'tracking expected point');
  s = exact(s,
    `export function needsGlobal(track, now, { idleMs = 900, refreshMs = 4000 } = {}) {`,
    `export function needsGlobal(track, now, { idleMs = 500, refreshMs = 1500 } = {}) {`,
    'global refresh cadence');
  s = exact(s,
    `  if (track.state === 'searching') return now - track.lastGlobalDetection >= idleMs;\n  if (track.state === 'recovering') return now - track.lastGlobalDetection >= idleMs;\n  // A tracking page is re-checked occasionally and cheaply, so a track that has\n  // slid onto a notebook edge cannot stay there indefinitely.\n  return now - track.lastGlobalDetection >= refreshMs;`,
    `  if (['searching', 'locking', 'reacquiring', 'recovering'].includes(track.state))\n    return now - track.lastGlobalDetection >= idleMs;\n  // A healthy track is still revalidated frequently enough that a slow drift\n  // onto a notebook/desk edge cannot survive for several seconds.\n  return now - track.lastGlobalDetection >= refreshMs;`,
    'global refresh states');
  return s;
});

patch('bench/capture.test.mjs', (input) => {
  let s = input;
  s = exact(s,
    `  GUIDANCE_DWELL_MS, GUIDANCE_HYSTERESIS,\n  liveGateVerdict, settledGuidance, shouldAutoCapture, stabApply, stabiliseStep, steadyWindow,\n} from '../src/scan/capture.js';`,
    `  GUIDANCE_DWELL_MS, GUIDANCE_HYSTERESIS, LIVE_SOURCE_FLOOR, MIN_EDGE_COVERAGE,\n  liveGateVerdict, settledGuidance, shouldAutoCapture,\n} from '../src/scan/capture.js';`,
    'capture test imports');
  s = exact(s,
    `import { CAPTURE, CONDITIONING, QUALITY } from '../src/scan/contract.js';`,
    `import { CAPTURE, CONDITIONING, QUALITY } from '../src/scan/contract.js';`,
    'capture contract test import');

  // Keep the page() helper for easing tests, remove the entire steady-window suite.
  s = regex(s,
    /test\('a first sighting opens the window rather than closing it'[\s\S]*?(?=\/\/ ── the shutter decision)/,
    '',
    'steady-window tests');

  s = exact(s,
    `const ready = {\n  autoCapture: true, armed: true, blocking: null,\n  steady: true, heldFor: 5000, consecutiveFinds: 8,\n};`,
    `const ready = {\n  autoCapture: true, armed: true, blocking: null,\n  consecutiveFinds: 8, globalConfirmations: 2,\n};`,
    'ready shutter fixture');
  s = exact(s, `test('a steady unblocked page fires', () => {`, `test('an unblocked independently confirmed page fires', () => {`, 'ready test name');

  s = exact(s,
    `test('a page held long enough fires even if it never reads as steady', () => {\n  const restless = { ...ready, steady: false };\n  assert.equal(shouldAutoCapture({ ...restless, heldFor: 0 }), false);\n  assert.equal(shouldAutoCapture({ ...restless, heldFor: CAPTURE.PATIENCE_MS - 1 }), false);\n  assert.equal(shouldAutoCapture({ ...restless, heldFor: CAPTURE.PATIENCE_MS }), true);\n});\n\ntest('patience does not override the gate', () => {\n  assert.equal(\n    shouldAutoCapture({ ...ready, steady: false, heldFor: 60000, blocking: 'focus' }),\n    false,\n  );\n});\n`,
    `test('one global detection cannot auto-capture a random rectangle', () => {\n  assert.equal(shouldAutoCapture({ ...ready, globalConfirmations: 1 }), false);\n  assert.equal(shouldAutoCapture({ ...ready, globalConfirmations: 2 }), true);\n});\n\ntest('quality blocking still overrides a confirmed lock', () => {\n  assert.equal(shouldAutoCapture({ ...ready, blocking: 'focus' }), false);\n});\n`,
    'patience tests replacement');

  s = exact(s,
    `const clean = {\n  glare: 0, clipping: 0, fill: CAPTURE.MIN_FILL + 0.1, sharpness: QUALITY.BLUR_WARN + 0.1,\n  skew: 0, pageLongEdge: CONDITIONING.MIN_LONG_EDGE + 100, steady: true,\n};`,
    `const clean = {\n  glare: 0, clipping: 0, fill: 0.4, edgeCoverage: MIN_EDGE_COVERAGE + 0.1,\n  sharpness: QUALITY.BLUR_WARN + 0.1, skew: 0, pageLongEdge: LIVE_SOURCE_FLOOR + 100,\n};`,
    'clean live-gate fixture');
  s = exact(s, `test('every signal clean and steady reads Ready', () => {`, `test('every signal clean reads Ready without a stillness requirement', () => {`, 'clean gate test name');

  s = regex(s,
    /test\('not yet steady, otherwise clean, blocks nothing but says so'[\s\S]*?\n\}\);\n\n/,
    '',
    'steady guidance test');
  s = s.replaceAll('CONDITIONING.MIN_LONG_EDGE - 1', 'LIVE_SOURCE_FLOOR - 1');
  s = s.replaceAll('CONDITIONING.MIN_LONG_EDGE);', 'LIVE_SOURCE_FLOOR);');
  s = exact(s,
    `test('too far away blocks on distance, once resolution is clear', () => {\n  const v = liveGateVerdict({ ...clean, fill: CAPTURE.MIN_FILL - 0.01 });`,
    `test('too far away blocks on edge coverage, independent of frame aspect ratio', () => {\n  const v = liveGateVerdict({ ...clean, edgeCoverage: MIN_EDGE_COVERAGE - 0.01 });`,
    'distance test');
  s = exact(s,
    `  const onTheLine = { ...clean, fill: CAPTURE.MIN_FILL };`,
    `  const onTheLine = { ...clean, edgeCoverage: MIN_EDGE_COVERAGE };`,
    'distance hysteresis line');
  s = exact(s,
    `  const clear = { ...clean, fill: CAPTURE.MIN_FILL * (1 + GUIDANCE_HYSTERESIS) + 0.001 };`,
    `  const clear = { ...clean, edgeCoverage: MIN_EDGE_COVERAGE * (1 + GUIDANCE_HYSTERESIS) + 0.001 };`,
    'distance hysteresis clear');
  s = exact(s,
    `    \`moved ${moved.toFixed(1)}px of 12 in one frame — that is a snap, not damping\`);`,
    `    \`moved ${moved.toFixed(1)}px of 12 in one frame — smoothing is no longer responsive\`);`,
    'ease message');
  s = exact(s,
    `  assert.ok(moved > 0 && moved < 12 * 0.35,`,
    `  assert.ok(moved > 12 * 0.35 && moved < 12 * 0.70,`,
    'ease responsiveness expectation');

  s = regex(s,
    /\/\/ ── preview stabilisation ─[\s\S]*$/,
    '',
    'preview stabilisation tests');

  // A narrow-looking page in a landscape feed can have low area fill while its
  // useful edge coverage is excellent. That must not produce the old impossible prompt.
  const insertAfter = `test('too far away blocks on edge coverage, independent of frame aspect ratio', () => {\n  const v = liveGateVerdict({ ...clean, edgeCoverage: MIN_EDGE_COVERAGE - 0.01 });\n  assert.equal(v.blocking, 'distance');\n});\n`;
  s = exact(s, insertAfter, insertAfter + `\ntest('low area fill alone does not block a fully framed portrait page', () => {\n  const v = liveGateVerdict({ ...clean, fill: 0.32, edgeCoverage: MIN_EDGE_COVERAGE + 0.08 });\n  assert.equal(v.blocking, null);\n  assert.equal(v.hint, 'Ready');\n});\n`, 'aspect-ratio regression test');

  return s;
});

patch('bench/tracking.test.mjs', (input) => {
  let s = input;
  const anchor = `test('a corner survives moderate sensor noise', () => {\n  const roi = cornerImage(64, 32, 32, 'br', { noise: 26 });\n  const found = findCorner(roi, { edgeA: 0, edgeB: 90 });\n  assert.ok(found, 'noise lost a corner that is plainly there');\n  assert.ok(Math.hypot(found.x - 32, found.y - 32) <= 3.5,\n    \`found (${found.x.toFixed(1)},${found.y.toFixed(1)}) under noise\`);\n});\n`;
  s = exact(s, anchor, anchor + `\ntest('a strong unrelated corner far from the prediction is rejected', () => {\n  const roi = cornerImage(64, 50, 50, 'br');\n  const found = findCorner(roi, { edgeA: 0, edgeB: 90, expectedX: 14, expectedY: 14 });\n  assert.equal(found, null, 'tracker jumped from its predicted paper corner to an unrelated rectangle');\n});\n`, 'predicted-corner regression test');
  return s;
});

console.log('scanner remediation patch applied');
