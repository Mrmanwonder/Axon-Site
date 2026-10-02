import { devices, expect, test } from "@playwright/test";

/*
 * AXO-68 · automated rows of the browser/device/visual-mode matrix.
 *
 * Emulated Android Chrome (Pixel 7) on the production build, signed out, in
 * light and dark, with and without reduced motion. Each cell checks three
 * things a person would otherwise have to eyeball:
 *   - the theme the OS asked for is the one painted;
 *   - no red anywhere in UI chrome (red belongs to teacher ink and sign-out);
 *   - with reduced motion, nothing is still animating once the page settles.
 *
 * This is emulation, recorded as such. It does not replace the real-device
 * rows in docs/claude_release-acceptance-matrix-2026-10-01.md.
 */

const origin = "http://127.0.0.1:5175";
const { defaultBrowserType: _engine, ...pixel } = devices["Pixel 7"];

/** Saturated red: hue within 15° of 0, saturation > 55 %, mid lightness. */
const RED_PROBE = `(() => {
  const hits = [];
  const toHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  };
  const isRed = (css) => {
    const m = css && css.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.25)) return false;
    const [h, s, l] = toHsl(+m[1], +m[2], +m[3]);
    return (h <= 15 || h >= 345) && s > 0.55 && l > 0.25 && l < 0.75;
  };
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[data-ink], [data-allow-red]")) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    for (const prop of ["color", "backgroundColor", "borderTopColor", "outlineColor", "fill", "stroke"]) {
      if (prop.startsWith("border") && cs.borderTopWidth === "0px") continue;
      if (prop === "outlineColor" && cs.outlineStyle === "none") continue;
      if (isRed(cs[prop])) hits.push(el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") + " " + prop + "=" + cs[prop]);
    }
  }
  return hits;
})()`;

for (const colorScheme of ["light", "dark"] as const) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test.describe(`Android Chrome (Pixel 7, emulated) · ${colorScheme} · motion ${reducedMotion}`, () => {
      test.use({ ...pixel, colorScheme, reducedMotion });

      test("theme, no red in chrome, motion honoured", async ({ page, browserName }) => {
        test.skip(browserName !== "chromium", "Android Chrome emulation runs on the Chromium engine only.");
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        await page.goto(origin, { waitUntil: "networkidle" });
        await page.waitForTimeout(600);

        const bg = await page.evaluate(() => {
          const pick = (el: Element) => getComputedStyle(el).backgroundColor;
          const body = pick(document.body);
          return body === "rgba(0, 0, 0, 0)" ? pick(document.documentElement) : body;
        });
        const [r, g, b] = (bg.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        if (colorScheme === "dark") expect(luminance, `background ${bg}`).toBeLessThan(0.25);
        else expect(luminance, `background ${bg}`).toBeGreaterThan(0.75);

        const red = await page.evaluate(RED_PROBE) as string[];
        expect(red, red.join("\n")).toEqual([]);

        if (reducedMotion === "reduce") {
          const running = await page.evaluate(() =>
            document.getAnimations()
              .filter((a) => a.playState === "running")
              .map((a) => {
                const t = a.effect?.getTiming();
                return { name: (a as CSSAnimation).animationName ?? a.constructor.name, duration: Number(t?.duration ?? 0), iterations: t?.iterations };
              })
              .filter((a) => a.duration > 1));
          expect(running, JSON.stringify(running)).toEqual([]);
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "horizontal page scroll").toBeLessThanOrEqual(0);
        expect(errors).toEqual([]);
      });
    });
  }
}
