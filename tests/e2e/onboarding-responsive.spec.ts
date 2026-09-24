import { expect, test } from "@playwright/test";

const widths = [320, 360, 390, 414, 768];

test("onboarding curriculum controls remain inside their card at phone and tablet widths", async ({ page }) => {
  await page.goto("/tests/browser/index.html");

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <link rel="stylesheet" href="/src/ui/components/CurriculumEditor.css">
          <style>
            :root {
              --gutter: 16px;
              --text-gutter: 20px;
              --hairline: rgba(255,255,255,.12);
              --surface: #171719;
              --surface-sunk: #0f0f11;
              --label: #fff;
              --label-2: #d5d5d8;
              --label-3: #77777e;
              --accent: #3a86ff;
              --accent-wash: rgba(58,134,255,.14);
              --attention: #ff9f0a;
              --fs-meta: 12px;
              --fw-medium: 500;
              --fw-semibold: 600;
              --spring: cubic-bezier(.1,.9,.2,1);
              --d-theme: 180ms;
              --font-sans: system-ui, sans-serif;
              --r-card: 22px;
            }
            * { box-sizing: border-box; }
            html, body { margin: 0; width: 100%; overflow-x: clip; background: #000; }
            body { font-family: system-ui, sans-serif; padding: 24px 0; }
          </style>
        </head>
        <body>
          <div class="curriculum-editor">
            <div class="curriculum-stage-card">
              <div class="curriculum-stage-card-row">
                <span class="curriculum-row-icon"></span>
                <span class="curriculum-row-copy"><b>Class</b><small>A Level · Year 13</small></span>
                <div class="curriculum-class-selector" style="--active-index:3">
                  <span class="curriculum-selector-glider"></span>
                  <button>9</button><button>10</button><button>11</button><button aria-pressed="true">12</button>
                </div>
              </div>
              <div class="curriculum-stage-divider"></div>
              <div class="curriculum-stage-card-row">
                <span class="curriculum-row-icon"></span>
                <span class="curriculum-row-copy"><b>Board</b><small>Senior Secondary</small></span>
                <div class="curriculum-board-selector" style="--active-index:1">
                  <span class="curriculum-selector-glider"></span>
                  <button>Cambridge</button><button aria-pressed="true">CBSE</button><button>IBDP</button>
                </div>
              </div>
            </div>

            <div class="curriculum-subject-heading"><div class="sectitle">Subjects</div></div>
            <div class="curriculum-chip-grid">
              <div class="curriculum-chip-wrap"><button class="curriculum-subject-chip"><span>AIR CONDITIONING AND REFRIGERATION</span><small>827</small></button></div>
              <div class="curriculum-chip-wrap"><button class="curriculum-subject-chip"><span>English - Language and Literature</span><small>8695</small></button></div>
              <div class="curriculum-chip-wrap"><button class="curriculum-subject-chip"><span>Global Perspectives &amp; Research</span><small>9239</small></button></div>
              <div class="curriculum-chip-wrap"><button class="curriculum-subject-chip"><span>Physics</span><small>9702</small></button></div>
            </div>
          </div>
        </body>
      </html>
    `);

    await page.waitForFunction(() => {
      const selector = document.querySelector(".curriculum-class-selector");
      return selector && getComputedStyle(selector).display === "grid";
    });

    const geometry = await page.evaluate(() => {
      const card = document.querySelector(".curriculum-stage-card")!.getBoundingClientRect();
      const selectors = [...document.querySelectorAll<HTMLElement>(".curriculum-class-selector,.curriculum-board-selector")]
        .map(node => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width };
        });
      const grid = document.querySelector(".curriculum-chip-grid")!.getBoundingClientRect();
      const chips = [...document.querySelectorAll<HTMLElement>(".curriculum-subject-chip")].map(node => {
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          whiteSpace: getComputedStyle(node).whiteSpace,
        };
      });
      return {
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        card: { left: card.left, right: card.right, width: card.width },
        grid: { left: grid.left, right: grid.right, width: grid.width },
        selectors,
        chips,
      };
    });

    expect(geometry.scrollWidth, `page overflow at ${width}px`).toBeLessThanOrEqual(geometry.viewport);
    for (const selector of geometry.selectors) {
      expect(selector.left, `selector starts outside card at ${width}px`).toBeGreaterThanOrEqual(geometry.card.left - 1);
      expect(selector.right, `selector ends outside card at ${width}px`).toBeLessThanOrEqual(geometry.card.right + 1);
      expect(selector.width).toBeGreaterThan(0);
    }
    for (const chip of geometry.chips) {
      expect(chip.left, `chip starts outside grid at ${width}px`).toBeGreaterThanOrEqual(geometry.grid.left - 1);
      expect(chip.right, `chip ends outside grid at ${width}px`).toBeLessThanOrEqual(geometry.grid.right + 1);
      expect(chip.height, `chip wrapped vertically at ${width}px`).toBeLessThanOrEqual(43);
      expect(chip.whiteSpace).toBe("nowrap");
    }
  }
});
