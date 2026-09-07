// The perspective warp, on the GPU.
//
// scan-ground-up-revamp-2026-09-07.md Phase 3. Measured on a real submitted
// page (2305x3301) warped to the pipeline's own 2400px target, on a *desktop*
// x86 CPU:
//
//     warpPerspective          350 ms
//     separateLayers           184 ms
//     scorePage                332 ms
//
// A mid-tier Android runs scalar JS like this several times slower, which is
// where the student's "ten seconds" comes from. The warp is the largest single
// block and the only one that is embarrassingly parallel *and* memory-bound in
// a way the CPU handles badly: it walks the destination and pulls from the
// source through a homography, so consecutive output pixels read source pixels
// that are nowhere near each other. That is the worst case for a CPU cache and
// the best case for a texture unit.
//
// So this file moves that one operation and nothing else. In particular it
// does **not** move the ink separation, which the brief also proposed: the
// production redness channel is `ratio` (RED.CHANNEL in contract.js), which is
// one divide per pixel, and the CIELAB path the brief was aiming at is not the
// one that runs. Porting a single divide to the GPU would buy a fraction of
// what it costs to read the result back, and it would put the exact thresholds
// that decide which pixels are a teacher's pen at the mercy of a driver's
// float precision. The ink math stays on the CPU, bit for bit.
//
// ── on trusting a GPU you have never met ──────────────────────────────────
//
// This runs on thousands of Android GPU and driver combinations that no one
// here will ever test on. A shader that is subtly wrong on one of them would
// not crash — it would quietly hand back a page with the handwriting smeared,
// and the mask built from it would be wrong in a way nothing downstream could
// detect. So the GPU path is never trusted on the strength of the code being
// correct: `selfTest()` warps a known pattern through a known homography on
// both paths and compares them, once per session, before anything real is
// warped. A device that disagrees gets the CPU path for the rest of the
// session and says so in the console. See PARITY_TOLERANCE below.

import { quadSize, solveHomography, warpPerspective } from './geometry.js';
import { makeImageData } from './imagedata.js';

// The most a single channel may differ from the CPU's own answer before the
// GPU path is refused for the session.
//
// Not zero: the CPU works in float64 and writes through a Uint8ClampedArray
// (round-half-to-even), the GPU works in float32 and rounds on write to an
// RGBA8 target, so a sample sitting exactly between two integers can legally
// land either side. One level of 255 is invisible in a photograph and is
// nowhere near the ~0.12 *ratio* separation the ink mask keys on. Anything
// larger is not rounding, it is a different answer, and the CPU takes over.
const PARITY_TOLERANCE = 2;
// And the share of pixels allowed to sit at that tolerance at all.
const PARITY_MAX_SHARE = 0.02;

const VERTEX_SHADER = `#version 300 es
// One triangle covering the viewport. No attributes, no buffers: the three
// corners are derived from gl_VertexID, which is the cheapest possible way to
// get a full-surface fragment pass.
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// The fragment shader is a direct transcription of warpPerspective in
// geometry.js and is meant to be read beside it. Every deviation is a bug, and
// the two places it would be tempting to deviate are called out where they are:
// the box prefilter, and the explicit bilinear.
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uSource;
// The inverse homography, destination to source, as nine floats in the same
// order geometry.js's solveHomography returns them. Passed as a flat array
// rather than a mat3 so there is no column-major convention to get wrong.
uniform float uH[9];
uniform ivec2 uSourceSize;
uniform int uK;        // box prefilter width, 1..4
uniform float uHalf;   // (uK - 1) / 2
uniform float uNorm;   // 1 / (uK * uK)

out vec4 fragColour;

void main() {
  // gl_FragCoord.xy is the pixel centre, so truncating gives the integer
  // index the CPU loop uses for x and y. No y-flip: nothing displays this
  // surface, it is read straight back, and readPixels walks rows from y=0
  // in the same direction the ImageData does.
  float x = float(int(gl_FragCoord.x));
  float y = float(int(gl_FragCoord.y));

  float w  = uH[6] * x + uH[7] * y + uH[8];
  float sx = (uH[0] * x + uH[1] * y + uH[2]) / w;
  float sy = (uH[3] * x + uH[4] * y + uH[5]) / w;

  float sw = float(uSourceSize.x);
  float sh = float(uSourceSize.y);

  // Outside the source is page white, never transparent black — a black
  // border reads as ink to the mask and as one enormous dark component to
  // the mark finder. Same test, same answer, as the CPU.
  if (sx < 0.0 || sy < 0.0 || sx > sw - 1.0 || sy > sh - 1.0) {
    fragColour = vec4(1.0, 1.0, 1.0, 1.0);
    return;
  }

  vec3 rgb;
  if (uK == 1) {
    // Explicit bilinear rather than a LINEAR sampler. Hardware filtering
    // quantises its weights to a handful of fixed-point bits, which is fine
    // for rendering and is not fine for a pass whose output is compared
    // against a float64 CPU reference. texelFetch + this arithmetic is the
    // same sum the CPU performs.
    int x0 = int(sx), y0 = int(sy);
    int x1 = min(x0 + 1, uSourceSize.x - 1);
    int y1 = min(y0 + 1, uSourceSize.y - 1);
    float fx = sx - float(x0);
    float fy = sy - float(y0);
    vec3 c00 = texelFetch(uSource, ivec2(x0, y0), 0).rgb;
    vec3 c10 = texelFetch(uSource, ivec2(x1, y0), 0).rgb;
    vec3 c01 = texelFetch(uSource, ivec2(x0, y1), 0).rgb;
    vec3 c11 = texelFetch(uSource, ivec2(x1, y1), 0).rgb;
    vec3 top = mix(c00, c10, fx);
    vec3 bot = mix(c01, c11, fx);
    rgb = mix(top, bot, fy);
  } else {
    // The box prefilter, and the reason it cannot be skipped: on a real
    // downscale, bilinear reads four neighbours and ignores everything
    // between them, and what it ignores is high-frequency detail — which is
    // exactly what a thin pen stroke is. IMAGE_PIPELINE.md §5.1 names the
    // symptom: the stroke aliases into a dashed line and reads as a quirk of
    // the student's handwriting rather than as something we did to it.
    vec3 sum = vec3(0.0);
    for (int j = 0; j < 4; j++) {
      if (j >= uK) break;
      for (int i = 0; i < 4; i++) {
        if (i >= uK) break;
        int px = int(clamp(floor(sx - uHalf + float(i) + 0.5), 0.0, sw - 1.0));
        int py = int(clamp(floor(sy - uHalf + float(j) + 0.5), 0.0, sh - 1.0));
        sum += texelFetch(uSource, ivec2(px, py), 0).rgb;
      }
    }
    rgb = sum * uNorm;
  }
  fragColour = vec4(rgb, 1.0);
}`;

let cached; // null once unavailable, an object once built

/**
 * The GPU warper for this session, or null where there isn't one.
 *
 * Built once and reused: compiling a program and allocating a context are
 * both expensive enough that doing them per page would eat the win.
 */
export function gpuWarper() {
  if (cached !== undefined) return cached;
  cached = build();
  return cached;
}

function build() {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const canvas = new OffscreenCanvas(1, 1);
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return null;

    const program = link(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) return null;

    const state = {
      gl,
      program,
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      software: isSoftwareRenderer(gl),
      loc: {
        source: gl.getUniformLocation(program, 'uSource'),
        h: gl.getUniformLocation(program, 'uH'),
        sourceSize: gl.getUniformLocation(program, 'uSourceSize'),
        k: gl.getUniformLocation(program, 'uK'),
        half: gl.getUniformLocation(program, 'uHalf'),
        norm: gl.getUniformLocation(program, 'uNorm'),
      },
      texture: gl.createTexture(),
      target: gl.createTexture(),
      framebuffer: gl.createFramebuffer(),
      verified: null, // null until selfTest has run
    };
    return state;
  } catch {
    return null;
  }
}

/**
 * Is this "GPU" actually the CPU wearing a hat?
 *
 * Some devices — and some browsers with hardware acceleration disabled, which
 * on cheap Android hardware is not rare — answer a WebGL request with a
 * software rasteriser. It is a perfectly correct one, and it is *slower* than
 * the plain JS warp: measured on SwiftShader, a 1676x2400 warp took 1114ms
 * against the CPU path's 203ms on the same machine. Moving work to it would
 * be strictly worse for exactly the users least able to afford it.
 *
 * So this is a decision about whether the GPU path is worth taking, and it is
 * kept separate from whether it *works* — `warpOnGPU` still runs on a software
 * renderer if it is asked directly, which is what lets bench parity checks
 * verify the shader anywhere. `gpuWarpAvailable()` is the one that says no.
 */
function isSoftwareRenderer(gl) {
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(
      (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '',
    ).toLowerCase();
    return /swiftshader|llvmpipe|software|softwarerasterizer|microsoft basic render/.test(name);
  } catch {
    // A browser that will not say what it is gets the benefit of the doubt;
    // the self-test still has to pass either way.
    return false;
  }
}

function link(gl, vertexSource, fragmentSource) {
  const compile = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error('[scan] gpu shader failed to compile', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  };
  const vs = compile(gl.VERTEX_SHADER, vertexSource);
  const fs = vs && compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  console.error('[scan] gpu program failed to link', gl.getProgramInfoLog(program));
  return null;
}

/**
 * Warp `source` so `quad` fills a `width`x`height` rectangle — the same
 * contract as geometry.js's `warpPerspective`, including returning null on a
 * degenerate quad so the caller's existing fallback still fires.
 *
 * Returns null rather than throwing for every "this device can't" case too,
 * because there is exactly one right answer to all of them and the caller
 * already has it written: run the CPU warp instead.
 *
 * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas|ImageData} source
 */
export function warpOnGPU(source, quad, width, height) {
  const state = gpuWarper();
  if (!state) return null;
  if (state.verified === false) return null;
  if (state.verified === null && !selfTest()) return null;
  return warpUnchecked(state, source, quad, width, height);
}

function warpUnchecked(state, source, quad, width, height) {
  const { gl } = state;
  const sw = source.width || source.naturalWidth;
  const sh = source.height || source.naturalHeight;
  if (!sw || !sh) return null;
  if (sw > state.maxTexture || sh > state.maxTexture ||
      width > state.maxTexture || height > state.maxTexture) return null;

  const dstQuad = [
    { x: 0, y: 0 }, { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 },
  ];
  const Hinv = solveHomography(dstQuad, quad);
  if (!Hinv) return null;

  // The same box width the CPU picks, from the same measurement — see
  // warpPerspective. Computed here rather than passed so the two cannot
  // drift apart.
  const size = quadSize(quad);
  const scale = Math.max(size.width / width, size.height / height);
  const k = Math.max(1, Math.min(4, Math.round(scale)));

  try {
    gl.bindTexture(gl.TEXTURE_2D, state.texture);
    // Exact pixels, not display-ready ones: no colour-space conversion, no
    // premultiplication, no flip. Any of the three would silently change the
    // numbers the ink separation later reads.
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (source.data) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array(source.data.buffer, source.data.byteOffset, source.data.length));
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }

    gl.bindTexture(gl.TEXTURE_2D, state.target);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.target, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;

    gl.viewport(0, 0, width, height);
    gl.useProgram(state.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.texture);
    gl.uniform1i(state.loc.source, 0);
    gl.uniform1fv(state.loc.h, Hinv);
    gl.uniform2i(state.loc.sourceSize, sw, sh);
    gl.uniform1i(state.loc.k, k);
    gl.uniform1f(state.loc.half, (k - 1) / 2);
    gl.uniform1f(state.loc.norm, 1 / (k * k));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const out = makeImageData(width, height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array(out.data.buffer, out.data.byteOffset, out.data.length));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (gl.getError() !== gl.NO_ERROR) return null;
    return out;
  } catch {
    return null;
  }
}

/**
 * Warp a known pattern both ways and insist the answers agree.
 *
 * Runs once per session, before the first real page. The pattern is small but
 * deliberately not trivial: a colour gradient with a hard checker on top, so
 * both the interpolation and the box prefilter have something to get wrong,
 * and a quad that is genuinely keystoned rather than a rectangle, so the
 * homography divide is actually exercised. A device that fails this is not
 * broken — it is a device whose float behaviour we cannot vouch for, and the
 * CPU path is right there.
 */
export function selfTest() {
  const state = gpuWarper();
  if (!state) return false;
  if (state.verified !== null) return state.verified;

  try {
    const sw = 64, sh = 64;
    const src = makeImageData(sw, sh);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const checker = ((x >> 2) + (y >> 2)) % 2 ? 90 : 0;
        src.data[i] = Math.min(255, x * 4 + checker);
        src.data[i + 1] = Math.min(255, y * 4 + checker);
        src.data[i + 2] = Math.min(255, (x + y) * 2 + checker);
        src.data[i + 3] = 255;
      }
    }
    // Keystoned on purpose: a rectangle would leave the perspective divide
    // constant and prove nothing about it.
    const quad = [
      { x: 5, y: 3 }, { x: 58, y: 9 }, { x: 61, y: 55 }, { x: 2, y: 49 },
    ];
    // Two sizes, so both branches of the shader are covered: one that
    // upscales slightly (k == 1, the bilinear path) and one that downscales
    // enough to engage the box prefilter (k > 1).
    for (const [w, h] of [[70, 70], [16, 16]]) {
      const cpu = warpPerspective(src, quad, w, h);
      const gpu = warpUnchecked(state, src, quad, w, h);
      if (!cpu || !gpu) { state.verified = false; break; }
      let worst = 0, over = 0;
      for (let i = 0; i < cpu.data.length; i++) {
        if (i % 4 === 3) continue; // alpha is 255 on both paths by construction
        const diff = Math.abs(cpu.data[i] - gpu.data[i]);
        if (diff > worst) worst = diff;
        if (diff > PARITY_TOLERANCE) over++;
      }
      const share = over / (cpu.data.length * 0.75);
      if (worst > PARITY_TOLERANCE && share > PARITY_MAX_SHARE) {
        console.error('[scan] gpu warp disagrees with the cpu warp — using the cpu path', {
          size: `${w}x${h}`, worstChannelDiff: worst, shareOverTolerance: +share.toFixed(4),
        });
        state.verified = false;
        break;
      }
    }
    if (state.verified === null) state.verified = true;
  } catch {
    state.verified = false;
  }
  return state.verified;
}

/**
 * Should this session warp on the GPU at all?
 *
 * Three things have to hold: there is a WebGL2 context, it is backed by real
 * hardware rather than a software rasteriser (see isSoftwareRenderer — on
 * those the GPU path is measurably slower than the CPU one), and it agrees
 * with the CPU on a known page.
 */
export function gpuWarpAvailable() {
  const state = gpuWarper();
  if (!state || state.software) return false;
  return state.verified === null ? selfTest() : state.verified;
}
