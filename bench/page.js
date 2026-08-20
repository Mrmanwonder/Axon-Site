// A synthetic exam page, for benchmarking the device stages.
//
// Not a substitute for the golden set — this measures speed, not accuracy, and
// the two need completely different inputs. What it has to be is *shaped* like
// the real thing: A4 at 300 DPI, ruled lines, a page of blue handwriting, red
// marking clustered in a right-hand margin, and a lighting gradient across it.
// A flat white page would make every stage look fast for the wrong reason.

export function syntheticPage(width = 2480, height = 3507, { seed = 7 } = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  // Paper, with the lighting gradient a phone held over a page actually makes.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const fall = 1 - 0.34 * Math.hypot(x / width - 0.35, y / height - 0.25);
      const v = 236 * fall + rand() * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v * 0.985; data[i + 3] = 255;
    }
  }

  const ink = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = ((y | 0) * width + (x | 0)) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  };

  // Ruled lines.
  for (let y = 300; y < height - 200; y += 92) {
    for (let x = 150; x < width - 150; x++) ink(x, y, 205, 205, 215);
  }

  // The student's answers: blue-black strokes on most of the ruled lines.
  for (let y = 300; y < height - 200; y += 92) {
    if (rand() < 0.12) continue;
    const end = 150 + (0.5 + rand() * 0.45) * (width - 500);
    for (let x = 190; x < end; x += 1) {
      const wobble = Math.sin(x * 0.09 + y) * 5;
      for (let t = -2; t <= 2; t++) ink(x, y - 14 + wobble + t, 28, 32, 76);
    }
  }

  // The teacher's marking: a marginal number per question, plus ticks, a circle
  // and an underline — clustered in a right-hand band, which is what stage 3
  // looks for and what makes stage 5 a one-dimensional search.
  const RED = [198, 34, 38];
  for (let q = 0; q < 14; q++) {
    const y = 340 + q * 220;
    for (let dy = 0; dy < 46; dy++) {
      for (let dx = 0; dx < 30; dx++) {
        if ((dx + dy) % 7 < 3) ink(width - 190 + dx, y + dy, ...RED);
      }
    }
    if (q % 3 === 0) {
      for (let t = 0; t < 26; t++) { ink(1400 + t, y + 20 + t, ...RED); ink(1426 - t, y + 20 + t, ...RED); }
    }
    if (q % 5 === 0) {
      for (let a = 0; a < 720; a++) {
        const r = 34;
        ink(900 + r * 1.6 * Math.cos(a * Math.PI / 360), y + 22 + r * Math.sin(a * Math.PI / 360), ...RED);
      }
    }
    if (q % 4 === 1) {
      for (let x = 300; x < 900; x++) { ink(x, y + 54, ...RED); ink(x, y + 55, ...RED); }
    }
  }

  return { data, width, height };
}
