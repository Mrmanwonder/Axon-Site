// Generates the Axon social templates and example slides from the real design tokens
// (src/ui/styles/tokens.css), renders them with the real Onest font, and prints
// legibility metrics. Run:  node docs/claude/social/tools/build.mjs
// Needs @playwright/test (repo devDependency) and a Chromium (CHROMIUM_PATH optional).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = new URL("../", import.meta.url).pathname;           // docs/claude/social/
const REPO = path.resolve(ROOT, "../../..");
const FONT = path.join(REPO, "public/fonts/onest-latin-var.woff2");

// ── tokens (copied from tokens.css, not invented) ──────────────────────────
const T = {
  dark:  { bg: "#000000", surface: "#151517", hair: "rgba(255,255,255,.075)", label: "#F5F5F7", label2: "rgba(235,235,245,.6)", accent: "#3A86FF", attention: "#FF9F0A", glow: "rgba(58,134,255,.26)", dot: "rgba(235,235,245,.14)" },
  light: { bg: "#F4F4F7", surface: "#FFFFFF", hair: "rgba(60,60,67,.11)",   label: "#0C0C10", label2: "#0C0C10", /* label-2 is 4.05:1 on paper-200, below AA for text; light slides use label and build hierarchy with size/weight */   accent: "#2C74E8", attention: "#C77A06", glow: "rgba(58,134,255,.26)", dot: "rgba(60,60,67,.16)" },
};
const CAUSE = { conceptual_gap: "#4C7DF0", procedural_slip: "#3FA9A0", misread_question: "#8A6FD1", incomplete: "#C98A3E", presentation: "#C46B8A", keyword_miss: "#7C9455", timed_out: "#78808F" };
// Scale from the app: 1080 / 390 = 2.77. In-app sizes × 2.77, rounded.
const BASE = { headline: 96, sub: 48, body: 40, meta: 32 };
const M = 64; // safe margin (≈ --text-gutter 22px × 2.77, rounded to the 8-pt grid)

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const lines = (arr, x, y, size, lh, fill, weight = 500, ls = "-0.036em", anchor = "start") =>
  `<text x="${x}" y="${y}" font-family="Onest, system-ui, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${fill}" text-anchor="${anchor}">` +
  arr.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`).join("") + `</text>`;

function dots(w, h, c, pitch = 36) { // fine-dot field motif: 1.5px radius at 1080
  let out = `<g fill="${c}">`;
  for (let y = pitch; y < h; y += pitch) for (let x = pitch; x < w; x += pitch) out += `<circle cx="${x}" cy="${y}" r="2"/>`;
  return out + "</g>";
}

// canvases: id → [w,h, top safe, bottom safe]
const CANVAS = { portrait: [1080, 1350, M, M], square: [1080, 1080, M, M], story: [1080, 1920, 250, 340], link: [1200, 630, 48, 48] };

function slide({ canvas = "portrait", theme = "dark", eyebrow, headline, sub, foot, index, total, glow = true, tag }) {
  const [W, H, top, bot] = CANVAS[canvas]; const t = T[theme];
  // Link cards are shown at ~390px wide from 1200px, so their text is scaled up to keep the same phone size.
  const SIZE = canvas === "link" ? { headline: 88, sub: 44, body: 44, meta: 40 } : BASE;
  const y0 = top + (canvas === "story" ? 0 : 0);
  const hl = headline.length;
  const hy = canvas === "story" ? 700 : (canvas === "square" ? 330 : 420);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${t.bg}"/>
${glow ? `<defs><radialGradient id="g" cx="82%" cy="14%" r="62%"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="rgba(58,134,255,0)"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>` : ""}
${dots(W, H, t.dot)}
${eyebrow ? lines([eyebrow.toUpperCase()], M, y0 + 24, SIZE.meta, 0, theme === "dark" ? t.accent : t.label, 650, "0.08em") : ""}
${lines(headline, M, hy, SIZE.headline, SIZE.headline * 1.06, t.label, 600)}
${sub ? lines(sub, M, hy + headline.length * SIZE.headline * 1.06 + 40, SIZE.body, 56, t.label2, 450, "-0.01em") : ""}
${tag ? `<g><rect x="${M}" y="${H - bot - 112}" rx="16" width="${tag.length * 22 + 56}" height="64" fill="none" stroke="${t.label2}" stroke-width="2" stroke-dasharray="8 8"/>${lines([tag], M + 28, H - bot - 70, SIZE.meta, 0, t.label2, 500, "0")}</g>` : ""}
${total ? lines([`${index} / ${total}`], W - M, y0 + 24, SIZE.meta, 0, t.label2, 500, "0", "end") : ""}
${foot ? lines([foot], M, H - bot, SIZE.meta, 0, t.label2, 500, "0") : lines(["axonstudy.online"], M, H - bot, SIZE.meta, 0, t.label2, 500, "0")}
</svg>`;
}

const examples = {
  "post01-cover-feature-launch": slide({ eyebrow: "Axon", headline: ["See where", "your marks", "went."], sub: ["Scan a marked paper. Axon explains", "each lost mark from your teacher's", "own marks and comments."], index: 1, total: 5 }),
  "post04-s1-marking-misconception": slide({ eyebrow: "Marking misconception", headline: ["Your answer", "is right.", "The mark", "went for…"], sub: ["Presentation costs marks too."], index: 1, total: 4 }),
  "post04-s2-marking-misconception": slide({ eyebrow: "Marking misconception", headline: ["…the unit,", "left off the", "final line."], sub: ["A correct value without its unit", "can lose the mark. Check the last line."], index: 2, total: 4, tag: "Illustrative example · not a real paper" }),
  "post07-cover-build-in-public": slide({ eyebrow: "Build in public", headline: ["We don't", "predict your", "grade."], sub: ["Your teacher marks the paper. Axon", "explains the marks they gave."], index: 1, total: 3 }),
  "story-launch": slide({ canvas: "story", eyebrow: "Axon", headline: ["See where", "your marks", "went."], sub: ["Scan a marked paper."], glow: true }),
  "square-insight-light": slide({ canvas: "square", theme: "light", eyebrow: "Study insight", headline: ["Write the formula", "on its own line", "before you substitute."], sub: ["One habit. Visible in the working."] }),
};

// Reference board: acceptable vs unacceptable, built from the same tokens.
function board() {
  const t = T.dark, W = 1600, H = 1000, F = 'font-family="Onest, system-ui, sans-serif"';
  const cell = (x, y, w, h, title, note, body, ok) => `<g><rect x="${x}" y="${y}" rx="24" width="${w}" height="${h}" fill="${t.surface}" stroke="${ok ? t.accent : "rgba(235,235,245,.32)"}" stroke-width="2" ${ok ? "" : 'stroke-dasharray="10 10"'}/><g transform="translate(${x - 40},${y - 140})">${body}</g><text x="${x + 28}" y="${y + h - 62}" ${F} font-size="26" font-weight="600" fill="${t.label}">${esc(title)}</text><text x="${x + 28}" y="${y + h - 28}" ${F} font-size="22" fill="${t.label2}">${esc(note)}</text></g>`;
  const cw = 360, ch = 380, gx = 30, x0 = 40;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  out += `<text x="40" y="64" ${F} font-size="34" font-weight="650" fill="${t.label}">Social reference board</text><text x="40" y="100" ${F} font-size="22" fill="${t.label2}">Solid outline = acceptable. Dashed = not Axon. Built from tokens.css.</text>`;
  const ok = [
    ["Flat black, one accent", "Token bg, one blue glow", `<rect x="60" y="150" width="320" height="170" rx="16" fill="#000"/><circle cx="330" cy="190" r="70" fill="rgba(58,134,255,.26)"/><text x="80" y="260" ${F} font-size="40" font-weight="600" fill="${t.label}">See where</text><text x="80" y="304" ${F} font-size="40" font-weight="600" fill="${t.label}">marks went.</text>`],
    ["Cause hues, equal weight", "Enum order, no ramp", Object.values(CAUSE).map((c, i) => `<circle cx="${92 + i * 44}" cy="240" r="17" fill="${c}"/>`).join("") + `<text x="80" y="300" ${F} font-size="22" fill="${t.label2}">kind, not severity</text>`],
    ["Real UI, synthetic data", "One screen or card, no bezel", `<rect x="120" y="140" width="130" height="190" rx="22" fill="#000" stroke="${t.hair}" stroke-width="2"/><rect x="134" y="160" width="102" height="34" rx="8" fill="${t.surface}"/><rect x="134" y="204" width="102" height="60" rx="8" fill="${t.surface}"/><rect x="134" y="274" width="60" height="12" rx="6" fill="${t.accent}"/>`],
    ["Teacher's ink only", "Red only as pen on paper", `<rect x="70" y="150" width="300" height="170" rx="10" fill="#EDEDF1"/><path d="M92 196H320M92 230H284M92 264H210" stroke="#3A3A3E" stroke-width="5" stroke-linecap="round"/><path d="M300 250l16 16 30-36" stroke="#D8462F" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`],
  ];
  const no = [
    ["Neon mesh gradient", "Stock 'AI' background", `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a3df0"/><stop offset=".5" stop-color="#2b6cff"/><stop offset="1" stop-color="#18d0c8"/></linearGradient></defs><rect x="60" y="150" width="320" height="170" rx="16" fill="url(#m)"/>`],
    ["Giant score / percentage", "A big number is a verdict", `<circle cx="140" cy="235" r="56" fill="none" stroke="#78808F" stroke-width="14"/><text x="215" y="255" ${F} font-size="64" font-weight="700" fill="${t.label}">78%</text>`],
    ["Robot, brain, glowing chip", "Generic AI imagery", `<rect x="130" y="170" width="180" height="130" rx="30" fill="#3A3A3E"/><circle cx="180" cy="225" r="18" fill="#9bd"/><circle cx="260" cy="225" r="18" fill="#9bd"/><rect x="190" y="266" width="60" height="10" rx="5" fill="#9bd"/><rect x="210" y="140" width="20" height="30" fill="#3A3A3E"/>`],
    ["Badge, streak, confetti", "Pressure and gamification", `<rect x="70" y="170" width="300" height="70" rx="35" fill="#5a5a60"/><text x="100" y="218" ${F} font-size="32" font-weight="700" fill="#fff">12-day streak</text><circle cx="120" cy="280" r="8" fill="#FF9F0A"/><circle cx="190" cy="300" r="8" fill="#4C7DF0"/><circle cx="260" cy="275" r="8" fill="#3FA9A0"/><circle cx="330" cy="295" r="8" fill="#8A6FD1"/>`],
  ];
  ok.forEach((c, i) => out += cell(x0 + i * (cw + gx), 140, cw, ch + 20, c[0], c[1], c[2], true));
  no.forEach((c, i) => out += cell(x0 + i * (cw + gx), 560, cw, ch + 20, c[0], c[1], c[2], false));
  return out + "</svg>";
}
examples["reference-board"] = board();

const templates = {
  "tpl-portrait-4x5-dark": slide({ eyebrow: "Format name", headline: ["Headline in", "two to four", "short lines."], sub: ["Supporting line, one idea,", "two lines at most."], index: 1, total: 5 }),
  "tpl-portrait-4x5-light": slide({ theme: "light", eyebrow: "Format name", headline: ["Headline in", "two to four", "short lines."], sub: ["Supporting line, one idea,", "two lines at most."], index: 1, total: 5 }),
  "tpl-square-1x1-dark": slide({ canvas: "square", eyebrow: "Format name", headline: ["Headline in", "two to three", "lines."], sub: ["Supporting line."] }),
  "tpl-story-9x16-dark": slide({ canvas: "story", eyebrow: "Format name", headline: ["Headline in", "two to four", "short lines."], sub: ["Supporting line."] }),
  "tpl-link-card-1200x630-dark": slide({ canvas: "link", eyebrow: "Axon", headline: ["Headline."], sub: ["Supporting line."], glow: true }),
};

// ── contrast ───────────────────────────────────────────────────────────────
const hex = (h) => { const m = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)); };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (rgb, a, bg) => rgb.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));
const pairs = [];
for (const th of ["dark", "light"]) {
  const bg = hex(T[th].bg);
  const l2 = th === "dark" ? over([235, 235, 245], 0.6, bg) : over([60, 60, 67], 0.68, bg);
  pairs.push([th, "label on bg", ratio(hex(T[th].label), bg)], [th, "label-2 on bg", ratio(l2, bg)], [th, "accent on bg", ratio(hex(T[th].accent), bg)], [th, "attention on bg", ratio(hex(T[th].attention), bg)]);
  for (const [k, c] of Object.entries(CAUSE)) pairs.push([th, `cause ${k} on bg`, ratio(hex(c), bg)]);
}

// ── render ─────────────────────────────────────────────────────────────────
const font64 = fs.readFileSync(FONT).toString("base64");
const html = (svg) => `<!doctype html><meta charset=utf-8><style>@font-face{font-family:Onest;font-weight:100 900;src:url(data:font/woff2;base64,${font64}) format("woff2")}html,body{margin:0;background:#888}svg{display:block}</style>${svg}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const results = [];
for (const [dir, set] of [["templates", templates], ["examples", examples]]) {
  for (const [name, svg] of Object.entries(set)) {
    fs.writeFileSync(path.join(ROOT, dir, name + ".svg"), svg);
    const [W, H] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); await page.setContent(html(svg)); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(ROOT, dir, name + ".png") });
    // phone preview: the slide shown at 390 css px wide (what a feed shows), DPR 3
    const scale = 390 / W;
    const ph = await browser.newContext({ viewport: { width: 390, height: Math.round(H * scale) }, deviceScaleFactor: 3 });
    const pp = await ph.newPage(); await pp.setContent(html(svg.replace(`width="${W}" height="${H}"`, `width="390" height="${Math.round(H * scale)}"`)));
    await pp.evaluate(() => document.fonts.ready);
    await pp.screenshot({ path: path.join(ROOT, dir, name + ".phone390.png") });
    // smallest text actually rendered, in phone css px
    const minPx = Math.min(...[...svg.matchAll(/font-size="(\d+)"/g)].map((m) => +m[1])) * scale;
    const fontLoaded = await page.evaluate(() => document.fonts.check("600 40px Onest"));
    results.push({ file: `${dir}/${name}`, canvas: `${W}x${H}`, smallestTextOnPhone_px: +minPx.toFixed(1), onestLoaded: fontLoaded });
    await ctx.close(); await ph.close();
  }
}
await browser.close();
console.table(results);
console.table(pairs.map(([th, what, r]) => ({ theme: th, pair: what, ratio: +r.toFixed(2), AA_normal: r >= 4.5, AA_large: r >= 3 })));
